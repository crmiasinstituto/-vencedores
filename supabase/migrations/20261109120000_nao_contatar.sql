-- "Não contatar": trava única por lead, respeitada por e-mail, WhatsApp, campanhas e automações.
--
-- Em vez de mexer em cada RPC de audiência, a trava liga as supressões que todas já respeitam:
--   • e-mail   → email_opted_out = true (populate_email_campaign_leads / contagem já excluem)
--   • WhatsApp → tag 'whatsapp_optout' (populate_wa_campaign_leads / contagem já excluem)
-- O motor de automação (email-automation-tick) também confere nao_contatar nos passos de WhatsApp.
--
-- Liga de três jeitos: botão no lead (origem 'manual'), resposta da pessoa no WhatsApp pedindo
-- pra parar (origem 'resposta', detectado aqui no banco) e pela própria equipe via SQL.

alter table public.crm_leads
  add column if not exists nao_contatar boolean not null default false,
  add column if not exists nao_contatar_motivo text,
  add column if not exists nao_contatar_em timestamptz,
  add column if not exists nao_contatar_origem text;

create index if not exists idx_crm_leads_nao_contatar on public.crm_leads (nao_contatar) where nao_contatar;

-- Sincroniza as supressões quando a trava muda.
create or replace function public.crm_leads_sync_nao_contatar()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if not new.nao_contatar then return new; end if;
  elsif new.nao_contatar is not distinct from old.nao_contatar then
    return new;
  end if;

  if new.nao_contatar then
    new.nao_contatar_em := coalesce(new.nao_contatar_em, now());
    new.email_opted_out := true;
    new.email_opted_out_at := coalesce(new.email_opted_out_at, now());
    if not ('whatsapp_optout' = any(coalesce(new.tags, '{}'))) then
      new.tags := array_append(coalesce(new.tags, '{}'), 'whatsapp_optout');
    end if;
  else
    -- Liberado de novo pela equipe: volta a poder receber.
    new.nao_contatar_em := null;
    new.nao_contatar_motivo := null;
    new.nao_contatar_origem := null;
    new.email_opted_out := false;
    new.email_opted_out_at := null;
    new.tags := array_remove(coalesce(new.tags, '{}'), 'whatsapp_optout');
  end if;
  return new;
end $$;

drop trigger if exists trg_crm_leads_nao_contatar on public.crm_leads;
create trigger trg_crm_leads_nao_contatar
  before insert or update of nao_contatar on public.crm_leads
  for each row execute function public.crm_leads_sync_nao_contatar();

-- Detecta pedido pra parar de receber. Conservador: frases claras, ou a mensagem inteira
-- sendo só a palavra (ex.: "SAIR", "PARAR"). "não" sozinho NÃO conta (é resposta comum).
create or replace function public.wa_pede_para_parar(p text)
returns boolean language sql immutable set search_path = public as $$
  with t as (select regexp_replace(public.wa_normaliza_texto(p), '[^a-z0-9 ]', ' ', 'g') as s)
  select
    trim(regexp_replace(s, '\s+', ' ', 'g')) in (
      'sair', 'parar', 'pare', 'stop', 'cancelar', 'remover', 'descadastrar', 'sair da lista',
      'nao tenho interesse', 'sem interesse', 'nao quero', 'nao quero receber', 'nao me mande mais'
    )
    or s ~ '(nao|n) (tenho|tenhu) (mais )?(nenhum )?interesse'
    or s ~ '(^| )sem interesse'
    or s ~ '(nao|n) (quero|desejo|gostaria de) (mais )?(receber|participar|essas? mensage|mensage|contato)'
    or s ~ '(nao|n) (me )?(mande|mandem|envie|enviem|manda|envia) (mais|nada)'
    -- "para" sozinho é preposição ("fique à vontade para enviar"): só conta "para DE enviar".
    or s ~ '(^| )(pare|parem|parar)( de)? (me )?(mandar|enviar|mandarem|enviarem|ligar)'
    or s ~ '(^| )(para|deixe|deixa|deixem) de (me )?(mandar|enviar|mandarem|enviarem|ligar)'
    or s ~ '(me )?(tira|tire|tirem|remova|remove|removam|exclua|exclui|excluam) (meu (numero|contato|nome)|(da|dessa|desta|de) (sua |s )?(lista|listas|grupo|contatos?))'
    or s ~ 'descadastr'
  from t;
$$;

-- Toda mensagem recebida passa pelo detector.
create or replace function public.whatsapp_messages_detecta_optout()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_lead uuid;
begin
  if new.direction <> 'inbound' or coalesce(new.content, '') = '' then return new; end if;
  if not public.wa_pede_para_parar(new.content) then return new; end if;

  v_lead := new.lead_id;
  if v_lead is null and new.remote_phone is not null then
    select id into v_lead from crm_leads
    where whatsapp = regexp_replace(new.remote_phone, '\D', '', 'g') limit 1;
  end if;
  if v_lead is null then return new; end if;

  update crm_leads
     set nao_contatar = true,
         nao_contatar_origem = 'resposta',
         nao_contatar_motivo = left('Respondeu: "' || new.content || '"', 300),
         nao_contatar_em = now()
   where id = v_lead and not nao_contatar;

  if found then
    insert into crm_activities (lead_id, activity_type, description, metadata)
    values (v_lead, 'nao_contatar',
            left('Marcado como NÃO CONTATAR: respondeu "' || new.content || '"', 500),
            jsonb_build_object('origem', 'resposta', 'whatsapp_message_id', new.id));
    insert into admin_notifications (type, title, description, link, severity, lead_id, metadata)
    values ('nao_contatar', 'Lead pediu pra não receber mais mensagens',
            left(new.content, 200), '/admin/crm?lead=' || v_lead, 'warning', v_lead,
            jsonb_build_object('origem', 'resposta'));
  end if;
  return new;
exception when others then
  -- Nunca derruba o recebimento da mensagem por causa do detector.
  return new;
end $$;

drop trigger if exists trg_whatsapp_messages_optout on public.whatsapp_messages;
create trigger trg_whatsapp_messages_optout
  after insert on public.whatsapp_messages
  for each row execute function public.whatsapp_messages_detecta_optout();

-- Quantos estão bloqueados (pra tela de campanha mostrar).
create or replace function public.contagem_nao_contatar()
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from crm_leads where nao_contatar and public.is_admin();
$$;
grant execute on function public.contagem_nao_contatar() to authenticated;
