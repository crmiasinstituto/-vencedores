-- ═══════════════════════════════════════════════════════════════════════════
-- Motor de disparo de campanha: reserva atômica + trava anti-duplicação.
--
-- Por que existe: a edge function resolvia a audiência por query em crm_leads
-- (capada em 1000 linhas pelo PostgREST) em vez de ler a fila real, e gastava
-- ~1,3s por destinatário — morria no teto de CPU no meio do lote, sem ninguém
-- pra retomar. Aqui a fila é a fonte da verdade, e o direito de enviar é
-- conquistado no banco (INSERT em email_sends) antes de qualquer chamada ao
-- Resend: quem não conseguiu criar a linha não recebe.
-- ═══════════════════════════════════════════════════════════════════════════

-- A UI já rotula 'skipped' e 'unsubscribed'; só a constraint do banco não os aceitava.
alter table public.email_campaign_leads drop constraint if exists email_campaign_leads_status_check;
alter table public.email_campaign_leads add constraint email_campaign_leads_status_check
  check (status = any (array['pending','sending','sent','delivered','opened','clicked','bounced','complained','unsubscribed','failed','skipped']));

-- ── 1. Reserva um lote da fila ────────────────────────────────────────────
-- Uma transação, e cada linha da fila é atualizada UMA vez só (dois UPDATE na
-- mesma linha dentro do mesmo comando fariam o segundo ser ignorado calado).
create or replace function public.email_campanha_reservar_lote(
  p_campaign_id uuid,
  p_limite int default 100
)
returns table (send_id uuid, lead_id uuid, email text, nome text, token uuid)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  return query
  with candidatos as (
    select l.id as fila_id, l.lead_id, l.email
    from email_campaign_leads l
    where l.campaign_id = p_campaign_id
      and l.status = 'pending'
      and l.email is not null
      and l.email <> ''
    order by l.id
    for update skip locked
    limit p_limite
  ),
  -- Opt-out em qualquer uma das três listas tira o destinatário do lote.
  bloqueados as (
    select c.fila_id
    from candidatos c
    where exists (select 1 from email_unsubscribes u where lower(u.email) = lower(c.email))
       or exists (
            select 1 from email_subscribers s
            where lower(s.email) = lower(c.email)
              and s.status in ('unsubscribed','bounced','complained')
          )
       or exists (
            select 1 from crm_leads cl
            where cl.id = c.lead_id and coalesce(cl.email_opted_out, false) = true
          )
  ),
  -- Garante inscrição (e token) pro rodapé de descadastro.
  inscritos as (
    insert into email_subscribers (email, lead_id, status, consent_source, consent_at)
    select c.email, c.lead_id, 'subscribed', 'campaign_send', now()
    from candidatos c
    where c.fila_id not in (select fila_id from bloqueados)
    on conflict (email) do nothing
    returning email, unsubscribe_token
  ),
  -- A RESERVA. Índice único (campaign_id, lower(email)): quem já tem linha
  -- nesta campanha não volta daqui — logo, não é enviado de novo.
  registrados as (
    insert into email_sends (campaign_id, lead_id, email, status)
    select p_campaign_id, c.lead_id, c.email, 'pending'
    from candidatos c
    where c.fila_id not in (select fila_id from bloqueados)
    on conflict do nothing
    returning id, email, lead_id
  ),
  -- Único UPDATE na fila, com os três destinos possíveis:
  --   skipped    = opt-out
  --   sending    = reservado agora, será enviado nesta invocação
  --   sent       = já tinha linha em email_sends (recebeu numa passada anterior)
  atualiza_fila as (
    update email_campaign_leads l
    set status = case
          when l.id in (select fila_id from bloqueados) then 'skipped'
          when exists (select 1 from registrados g where lower(g.email) = lower(l.email)) then 'sending'
          else 'sent'
        end,
        error_message = case when l.id in (select fila_id from bloqueados) then 'opt-out' else l.error_message end
    where l.id in (select fila_id from candidatos)
    returning l.id
  )
  select
    reg.id as send_id,
    reg.lead_id,
    reg.email,
    (select cl.name from crm_leads cl where cl.id = reg.lead_id) as nome,
    coalesce(
      (select i.unsubscribe_token from inscritos i where lower(i.email) = lower(reg.email) limit 1),
      (select s.unsubscribe_token from email_subscribers s where lower(s.email) = lower(reg.email) order by s.created_at limit 1)
    ) as token
  from registrados reg;
end;
$$;

-- ── 2. Confirma o que o Resend aceitou ────────────────────────────────────
create or replace function public.email_campanha_confirmar(p_itens jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_qtd int;
begin
  with itens as (
    select (x->>'send_id')::uuid as send_id,
           nullif(x->>'resend_id','') as resend_id
    from jsonb_array_elements(p_itens) x
  ),
  up_sends as (
    update email_sends e
    set status = 'sent', sent_at = now(), resend_id = i.resend_id
    from itens i
    where e.id = i.send_id
    returning e.campaign_id, e.email, i.resend_id
  )
  update email_campaign_leads l
  set status = 'sent', sent_at = now(), resend_id = u.resend_id
  from up_sends u
  where l.campaign_id = u.campaign_id and lower(l.email) = lower(u.email);

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- ── 3. Devolve o lote à fila ──────────────────────────────────────────────
-- Só para recusa explícita do Resend (HTTP de erro = nada foi enviado).
-- Apaga a linha de email_sends pra trava não impedir a retentativa.
-- NUNCA chamar com resposta desconhecida (timeout/rede) — nesse caso, falhar.
create or replace function public.email_campanha_devolver(p_send_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_qtd int;
begin
  with apagados as (
    delete from email_sends e
    where e.id = any(p_send_ids) and e.status = 'pending'
    returning e.campaign_id, e.email
  )
  update email_campaign_leads l
  set status = 'pending'
  from apagados a
  where l.campaign_id = a.campaign_id and lower(l.email) = lower(a.email);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- ── 4. Falha definitiva: resposta desconhecida, não reenviar ──────────────
create or replace function public.email_campanha_falhar(p_send_ids uuid[], p_erro text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_qtd int;
begin
  with falhos as (
    update email_sends e
    set status = 'failed', error_message = left(p_erro, 500)
    where e.id = any(p_send_ids) and e.status = 'pending'
    returning e.campaign_id, e.email
  )
  update email_campaign_leads l
  set status = 'failed', error_message = left(p_erro, 500)
  from falhos f
  where l.campaign_id = f.campaign_id and lower(l.email) = lower(f.email);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

-- ── 5. Progresso ──────────────────────────────────────────────────────────
create or replace function public.email_campanha_progresso(p_campaign_id uuid)
returns table (pendentes bigint, processando bigint, enviados bigint, falhas bigint, pulados bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'sending'),
    count(*) filter (where status = 'sent'),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'skipped')
  from email_campaign_leads
  where campaign_id = p_campaign_id;
$$;

revoke all on function public.email_campanha_reservar_lote(uuid, int) from public, anon, authenticated;
revoke all on function public.email_campanha_confirmar(jsonb) from public, anon, authenticated;
revoke all on function public.email_campanha_devolver(uuid[]) from public, anon, authenticated;
revoke all on function public.email_campanha_falhar(uuid[], text) from public, anon, authenticated;
grant execute on function public.email_campanha_reservar_lote(uuid, int) to service_role;
grant execute on function public.email_campanha_confirmar(jsonb) to service_role;
grant execute on function public.email_campanha_devolver(uuid[]) to service_role;
grant execute on function public.email_campanha_falhar(uuid[], text) to service_role;
grant execute on function public.email_campanha_progresso(uuid) to service_role, authenticated;

-- ── 6. Reabre falhas pra retentativa ("Corrigir e reenviar" no painel) ────
-- Apaga a linha de email_sends failed (senão a trava barra) e volta a fila.
create or replace function public.email_campanha_reabrir_falhas(
  p_campaign_id uuid,
  p_lead_ids uuid[] default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_qtd int;
begin
  with apagados as (
    delete from email_sends e
    where e.campaign_id = p_campaign_id
      and e.status = 'failed'
      and (p_lead_ids is null or e.lead_id = any(p_lead_ids))
    returning e.campaign_id, e.email
  )
  update email_campaign_leads l
  set status = 'pending', error_message = null
  from apagados a
  where l.campaign_id = a.campaign_id and lower(l.email) = lower(a.email);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

revoke all on function public.email_campanha_reabrir_falhas(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.email_campanha_reabrir_falhas(uuid, uuid[]) to service_role;
create or replace function public.email_campanha_reservar_lote(
  p_campaign_id uuid,
  p_limite int default 100
)
returns table (send_id uuid, lead_id uuid, email text, nome text, token uuid)
language plpgsql
security definer
set search_path = public
as $BODY$
#variable_conflict use_column
begin
  return query
  with candidatos as (
    select l.id as fila_id, l.lead_id, l.email
    from email_campaign_leads l
    where l.campaign_id = p_campaign_id
      and l.status = 'pending'
      and l.email is not null
      and l.email <> ''
    order by l.id
    for update skip locked
    limit p_limite
  ),
  -- Endereço que o Resend recusa. O /emails/batch é tudo-ou-nada: um único
  -- e-mail com acento ou domínio digitado errado derruba os 100 do lote com
  -- HTTP 422, e a invocação seguinte reencontra o mesmo — foi o que parou a
  -- campanha em 812/17212 em 27/08. Fica de fora da fila, marcado como falha.
  invalidos as (
    select c.fila_id
    from candidatos c
    where c.email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$'
  ),
  -- Opt-out em qualquer uma das três listas tira o destinatário do lote.
  bloqueados as (
    select c.fila_id
    from candidatos c
    where c.fila_id not in (select fila_id from invalidos)
      and (
        exists (select 1 from email_unsubscribes u where lower(u.email) = lower(c.email))
        or exists (
             select 1 from email_subscribers s
             where lower(s.email) = lower(c.email)
               and s.status in ('unsubscribed','bounced','complained')
           )
        or exists (
             select 1 from crm_leads cl
             where cl.id = c.lead_id and coalesce(cl.email_opted_out, false) = true
           )
      )
  ),
  aptos as (
    select c.* from candidatos c
    where c.fila_id not in (select fila_id from invalidos)
      and c.fila_id not in (select fila_id from bloqueados)
  ),
  inscritos as (
    insert into email_subscribers (email, lead_id, status, consent_source, consent_at)
    select a.email, a.lead_id, 'subscribed', 'campaign_send', now()
    from aptos a
    on conflict (email) do nothing
    returning email, unsubscribe_token
  ),
  -- A RESERVA. Índice único (campaign_id, lower(email)): quem já tem linha
  -- nesta campanha não volta daqui — logo, não é enviado de novo.
  registrados as (
    insert into email_sends (campaign_id, lead_id, email, status)
    select p_campaign_id, a.lead_id, a.email, 'pending'
    from aptos a
    on conflict do nothing
    returning id, email, lead_id
  ),
  -- Único UPDATE na fila (dois UPDATE na mesma linha dentro do mesmo comando
  -- fariam o segundo ser ignorado calado):
  --   failed   = endereço inválido
  --   skipped  = opt-out
  --   sending  = reservado agora, será enviado nesta invocação
  --   sent     = já tinha linha em email_sends (recebeu numa passada anterior)
  atualiza_fila as (
    update email_campaign_leads l
    set status = case
          when l.id in (select fila_id from invalidos) then 'failed'
          when l.id in (select fila_id from bloqueados) then 'skipped'
          when exists (select 1 from registrados g where lower(g.email) = lower(l.email)) then 'sending'
          else 'sent'
        end,
        error_message = case
          when l.id in (select fila_id from invalidos) then 'endereço de e-mail inválido'
          when l.id in (select fila_id from bloqueados) then 'opt-out'
          else l.error_message
        end
    where l.id in (select fila_id from candidatos)
    returning l.id
  )
  select
    reg.id as send_id,
    reg.lead_id,
    reg.email,
    (select cl.name from crm_leads cl where cl.id = reg.lead_id) as nome,
    coalesce(
      (select i.unsubscribe_token from inscritos i where lower(i.email) = lower(reg.email) limit 1),
      (select s.unsubscribe_token from email_subscribers s where lower(s.email) = lower(reg.email) order by s.created_at limit 1)
    ) as token
  from registrados reg;
end;
$BODY$;
-- (a versão final de email_campanha_reservar_lote, com o filtro de endereço inválido, está no fim deste arquivo)
