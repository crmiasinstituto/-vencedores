-- Tentativa de compra que a Eduzz avisa e o CRM ignorava.
--
-- Desde 03/08 chegaram 328 webhooks e só os 149 `invoice_paid` viraram alguma coisa. O resto
-- ficava parado em webhook_event_log:
--   sun.cart_abandonment            50  — chegou no checkout e não terminou
--   myeduzz.contract_card_attempted 84  — cartão recusado/bloqueado
--   myeduzz.contract_pix_attempted   6  — gerou pix e não pagou
--   myeduzz.invoice_recovering      14  — a Eduzz está tentando recuperar
--
-- É o lead mais quente que existe: a pessoa chegou na tela de pagamento. O carrinho
-- abandonado ainda traz `saleRecoveryUrl`, o link pra ela retomar de onde parou.

-- Coluna dedicada no board RPG10X, entre "Inscritos" e "Compradores".
do $$
declare v_board uuid := 'ec124cc1-68a4-4e69-a61d-76e4abf03532';
begin
  if not exists (select 1 from public.crm_columns where board_id = v_board and name = 'Tentou comprar') then
    update public.crm_columns set sort_order = sort_order + 1
     where board_id = v_board and sort_order >= 1;
    insert into public.crm_columns (board_id, name, color, sort_order)
    values (v_board, 'Tentou comprar', '#f59e0b', 1);
  end if;
end $$;

-- Lê um evento cru da Eduzz e devolve o que interessa, já normalizado.
create or replace function public.eduzz_tentativa_extrai(p_raw jsonb)
returns table (
  evento text, nome text, email text, telefone text,
  motivo text, link_recuperacao text, quando timestamptz
)
language sql
immutable
as $$
  with e as (select (p_raw->>'texto')::jsonb as j),
  d as (select (select j from e) as j, ((select j from e)->'data') as data)
  select
    (select j->>'event' from d),
    nullif(trim(coalesce(
      (select data->'customer'->>'name' from d),
      (select data->'buyer'->>'name' from d))), ''),
    lower(nullif(trim(coalesce(
      (select data->'customer'->>'email' from d),
      (select data->'buyer'->>'email' from d))), '')),
    nullif(regexp_replace(coalesce(
      (select data->'customer'->>'phone' from d),
      (select data->'customer'->>'cellphone' from d),
      (select data->'buyer'->>'cellphone' from d),
      (select data->'buyer'->>'phone' from d), ''), '[^0-9]', '', 'g'), ''),
    coalesce(
      (select data->'invoice'->>'failReasonMessage' from d),
      (select data->'invoice'->>'failReason' from d),
      (select data->>'lastStep' from d)),
    (select data->>'saleRecoveryUrl' from d),
    coalesce(
      ((select data->>'updatedAt' from d))::timestamptz,
      ((select data->'invoice'->>'attemptDate' from d))::timestamptz,
      now())
$$;

-- Tags por tipo de tentativa. "tentou-comprar" é a que o time olha; a segunda diz o quê.
create or replace function public.eduzz_tentativa_tags(p_evento text)
returns text[]
language sql immutable
as $$
  select case p_evento
    when 'sun.cart_abandonment'            then array['tentou-comprar','carrinho-abandonado','rpg10x-32-edicao']
    when 'myeduzz.contract_card_attempted' then array['tentou-comprar','pagamento-recusado','rpg10x-32-edicao']
    when 'myeduzz.contract_pix_attempted'  then array['tentou-comprar','pix-nao-pago','rpg10x-32-edicao']
    when 'myeduzz.invoice_recovering'      then array['tentou-comprar','em-recuperacao','rpg10x-32-edicao']
    when 'myeduzz.invoice_expired'         then array['tentou-comprar','boleto-expirado','rpg10x-32-edicao']
    else '{}'::text[] end;
$$;

create or replace function public.eduzz_processa_tentativa(p_raw jsonb, p_quando timestamptz)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  t record;
  v_tags text[];
  v_lead uuid;
  v_board uuid := 'ec124cc1-68a4-4e69-a61d-76e4abf03532';
  v_coluna uuid;
  v_obs text;
begin
  select * into t from public.eduzz_tentativa_extrai(p_raw);
  v_tags := public.eduzz_tentativa_tags(t.evento);
  if array_length(v_tags, 1) is null then return null; end if;
  if t.email is null and t.telefone is null then return null; end if;

  select id into v_coluna from public.crm_columns
   where board_id = v_board and name = 'Tentou comprar' limit 1;

  -- Casa por e-mail, senão pelos últimos 8 dígitos do telefone (mesma tolerância que o
  -- resto do CRM usa — DDI e nono dígito variam demais pra comparar string inteira).
  select id into v_lead from public.crm_leads
   where (t.email is not null and lower(email) = t.email)
      or (t.telefone is not null and length(t.telefone) >= 8
          and whatsapp like '%' || right(t.telefone, 8))
   order by updated_at desc limit 1;

  v_obs := format('[%s] %s%s',
    to_char(t.quando at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
    coalesce(t.motivo, t.evento),
    case when t.link_recuperacao is not null
      then E'\nRetomar: ' || t.link_recuperacao else '' end);

  if v_lead is null then
    insert into public.crm_leads (name, email, whatsapp, source, board_id, column_id, tags, notes)
    values (
      coalesce(t.nome, 'Sem nome'), t.email, t.telefone, 'eduzz-tentativa',
      v_board, v_coluna, v_tags, v_obs
    )
    returning id into v_lead;
  else
    -- Quem JÁ comprou não volta pra fila de tentativa: ele desistiu antes e comprou depois.
    update public.crm_leads l set
      tags = (select array_agg(distinct x) from unnest(coalesce(l.tags,'{}') || v_tags) x),
      notes = case
        when coalesce(l.notes,'') like '%' || v_obs || '%' then l.notes
        else trim(both E'\n' from coalesce(l.notes,'') || E'\n' || v_obs) end,
      column_id = case
        when coalesce(l.tags,'{}') @> array['ja-comprou'] then l.column_id
        else coalesce(v_coluna, l.column_id) end,
      board_id = case
        when coalesce(l.tags,'{}') @> array['ja-comprou'] then l.board_id
        else v_board end,
      updated_at = now()
    where l.id = v_lead;
  end if;

  return v_lead;
end $$;

-- Dali pra frente, automático.
create or replace function public.tg_eduzz_tentativa()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_lead uuid;
begin
  begin
    v_lead := public.eduzz_processa_tentativa(new.raw_payload, new.created_at);
    if v_lead is not null then
      update public.webhook_event_log set crm_lead_id = v_lead where id = new.id;
    end if;
  exception when others then
    -- Nunca derrubar a ingestão do webhook por causa disso.
    raise warning 'eduzz_tentativa falhou para %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists trg_eduzz_tentativa on public.webhook_event_log;
create trigger trg_eduzz_tentativa
  after insert on public.webhook_event_log
  for each row execute function public.tg_eduzz_tentativa();
