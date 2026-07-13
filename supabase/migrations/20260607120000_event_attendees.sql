-- ============================================================================
-- Inscritos / Credenciamento de Eventos Coletivos
--
-- Camada de "lista de inscritos" pendurada em collective_events. Une 4 origens
-- numa lista unica por evento:
--   compra   -> comprou (Kirvano / Asaas), importado automatico
--   cortesia -> convidado sem pagar, adicionado manual
--   auto     -> auto-cadastro pelo QR publico do evento (walk-in se identifica)
--   manual   -> digitado na mao pelo admin
--
-- Cada inscrito ganha um checkin_code (QR pessoal) pra credenciamento rapido.
-- Cada evento ganha um public_signup_token (QR publico de auto-cadastro).
-- ============================================================================

-- 1) Token publico de auto-cadastro + flag no evento ------------------------
alter table public.collective_events
  add column if not exists public_signup_token text,
  add column if not exists signup_enabled boolean not null default true;

-- backfill token pros eventos que ja existem
update public.collective_events
   set public_signup_token = encode(gen_random_bytes(9), 'base64')
 where public_signup_token is null;

-- normaliza base64 url-safe (sem / + =) pra caber em QR/URL
update public.collective_events
   set public_signup_token = replace(replace(replace(public_signup_token, '/', ''), '+', ''), '=', '')
 where public_signup_token ~ '[/+=]';

create unique index if not exists idx_collective_events_signup_token
  on public.collective_events (public_signup_token);

-- 2) Tabela de inscritos -----------------------------------------------------
create table if not exists public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.collective_events(id) on delete cascade,

  -- identificacao
  name text not null,
  whatsapp text,
  email text,
  cpf text,
  instagram text,
  company text,
  role text,

  -- origem e bilhete
  origin text not null default 'manual'
    check (origin in ('compra','cortesia','auto','manual')),
  product text,                 -- MentorIA, Metodo SQUAAD, Enterprise, Treinamento SQUAAD, Masterclass IA...
  product_slug text,
  amount numeric(12,2),
  payment_method text,          -- pix, credit_card, debit_card, boleto, dinheiro, cortesia
  payment_status text not null default 'pending'
    check (payment_status in ('paid','pending','courtesy','free','refunded')),

  -- credenciamento
  checkin_code text not null default replace(replace(replace(encode(gen_random_bytes(9),'base64'),'/',''),'+',''),'=',''),
  checked_in_at timestamptz,
  checked_in_by uuid,

  -- enriquecimento Instagram
  instagram_profile_pic_url text,
  instagram_data jsonb,
  instagram_scraped_at timestamptz,

  -- ligacoes
  crm_lead_id uuid,
  sales_event_id uuid,
  member_payment_id uuid,
  gateway_payment_id text,
  gateway_invoice_url text,

  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- dedup: 1 inscrito por (evento + whatsapp). Email NAO e unico de proposito:
-- compradores reais compartilham email (familia, mesmo contato), entao email e
-- so indice de busca.
create unique index if not exists idx_event_attendees_event_whatsapp
  on public.event_attendees (event_id, whatsapp) where whatsapp is not null;
create index if not exists idx_event_attendees_event_email
  on public.event_attendees (event_id, lower(email)) where email is not null;
create unique index if not exists idx_event_attendees_checkin_code
  on public.event_attendees (checkin_code);
create index if not exists idx_event_attendees_event on public.event_attendees (event_id);
create index if not exists idx_event_attendees_gateway on public.event_attendees (gateway_payment_id) where gateway_payment_id is not null;

-- updated_at trigger
create or replace function public.touch_event_attendees_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_event_attendees_touch on public.event_attendees;
create trigger trg_event_attendees_touch before update on public.event_attendees
  for each row execute function public.touch_event_attendees_updated_at();

-- 3) RLS ---------------------------------------------------------------------
alter table public.event_attendees enable row level security;

-- admin logado (authenticated) gerencia tudo; escrita publica vai por edge/service_role
drop policy if exists event_attendees_authenticated_all on public.event_attendees;
create policy event_attendees_authenticated_all on public.event_attendees
  for all to authenticated using (true) with check (true);

drop policy if exists event_attendees_service_all on public.event_attendees;
create policy event_attendees_service_all on public.event_attendees
  for all to service_role using (true) with check (true);

-- 4) RPC publica: resolve dados do evento pelo token de auto-cadastro --------
-- usada pela pagina publica /inscricao/<token> (anon + admin logado)
create or replace function public.resolve_event_signup(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_event record; v_count int;
begin
  select id, title, description, event_format, scheduled_at, duration_minutes,
         venue_name, venue_address, venue_complement, venue_map_url,
         signup_enabled, status
    into v_event
  from public.collective_events
  where public_signup_token = p_token;

  if v_event.id is null then
    return jsonb_build_object('found', false);
  end if;

  select count(*) into v_count from public.event_attendees where event_id = v_event.id;

  return jsonb_build_object(
    'found', true,
    'signup_enabled', coalesce(v_event.signup_enabled, true),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'description', v_event.description,
      'event_format', v_event.event_format,
      'scheduled_at', v_event.scheduled_at,
      'duration_minutes', v_event.duration_minutes,
      'venue_name', v_event.venue_name,
      'venue_address', v_event.venue_address,
      'venue_complement', v_event.venue_complement,
      'venue_map_url', v_event.venue_map_url
    ),
    'attendee_count', v_count
  );
end;
$$;
grant execute on function public.resolve_event_signup(text) to anon, authenticated;

-- 5) RPC publica: auto-cadastro (insere/atualiza inscrito origem 'auto') -----
-- usada pelo edge event-self-register; tambem pode ser chamada direto.
create or replace function public.register_event_attendee(
  p_token text,
  p_name text,
  p_whatsapp text default null,
  p_email text default null,
  p_cpf text default null,
  p_instagram text default null,
  p_company text default null,
  p_role text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_enabled boolean;
  v_phone text;
  v_id uuid;
  v_code text;
begin
  select id, coalesce(signup_enabled, true) into v_event_id, v_enabled
  from public.collective_events where public_signup_token = p_token;

  if v_event_id is null then
    return jsonb_build_object('ok', false, 'error', 'Evento nao encontrado');
  end if;
  if not v_enabled then
    return jsonb_build_object('ok', false, 'error', 'Inscricoes encerradas');
  end if;
  if coalesce(trim(p_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Nome obrigatorio');
  end if;

  -- normaliza whatsapp (so digitos, prefixo 55)
  v_phone := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_phone <> '' and left(v_phone, 2) <> '55' then v_phone := '55' || v_phone; end if;
  if v_phone = '' then v_phone := null; end if;

  -- upsert por whatsapp; senao por email; senao insere novo
  select id into v_id from public.event_attendees
   where event_id = v_event_id and (
     (v_phone is not null and whatsapp = v_phone) or
     (v_phone is null and p_email is not null and lower(email) = lower(p_email))
   ) limit 1;

  if v_id is not null then
    update public.event_attendees set
      name = coalesce(nullif(trim(p_name), ''), name),
      email = coalesce(nullif(trim(p_email), ''), email),
      cpf = coalesce(nullif(regexp_replace(coalesce(p_cpf,''), '\D','','g'), ''), cpf),
      instagram = coalesce(nullif(replace(trim(p_instagram), '@', ''), ''), instagram),
      company = coalesce(nullif(trim(p_company), ''), company),
      role = coalesce(nullif(trim(p_role), ''), role),
      updated_at = now()
    where id = v_id
    returning checkin_code into v_code;
    return jsonb_build_object('ok', true, 'attendee_id', v_id, 'checkin_code', v_code, 'updated', true);
  end if;

  insert into public.event_attendees (event_id, name, whatsapp, email, cpf, instagram, company, role, origin, payment_status)
  values (
    v_event_id, trim(p_name), v_phone, nullif(trim(p_email), ''),
    nullif(regexp_replace(coalesce(p_cpf,''), '\D','','g'), ''),
    nullif(replace(trim(coalesce(p_instagram,'')), '@', ''), ''),
    nullif(trim(coalesce(p_company,'')), ''), nullif(trim(coalesce(p_role,'')), ''),
    'auto', 'free'
  )
  returning id, checkin_code into v_id, v_code;

  return jsonb_build_object('ok', true, 'attendee_id', v_id, 'checkin_code', v_code, 'updated', false);
end;
$$;
grant execute on function public.register_event_attendee(text,text,text,text,text,text,text,text) to anon, authenticated;

-- 6) RPC admin: importa compradores de um board CRM (ex: masterclass-ia) -----
-- puxa leads da coluna "Comprou" + ultimo sales_events e joga na lista origem 'compra'
create or replace function public.import_event_buyers(p_event_id uuid, p_board_slug text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_board_id uuid; v_inserted int := 0;
begin
  select id into v_board_id from public.crm_boards where slug = p_board_slug;
  if v_board_id is null then return 0; end if;

  with comprou as (
    select distinct on (l.whatsapp)
           l.id as lead_id, l.name, l.whatsapp, l.email, l.cpf
    from public.crm_leads l
    join public.crm_columns c on c.id = l.column_id
    where l.board_id = v_board_id and c.name = 'Comprou' and l.whatsapp is not null
    order by l.whatsapp, l.updated_at desc nulls last
  ),
  enriched as (
    select cp.*,
           se.id as sales_event_id, se.product_name, se.amount, se.payment_method,
           se.instagram, se.instagram_profile_pic_url
    from comprou cp
    left join lateral (
      select * from public.sales_events s
      where s.crm_lead_id = cp.lead_id
      order by s.created_at desc limit 1
    ) se on true
  ),
  ins as (
    insert into public.event_attendees (
      event_id, name, whatsapp, email, cpf, instagram, instagram_profile_pic_url,
      origin, product, amount, payment_method, payment_status,
      crm_lead_id, sales_event_id
    )
    select p_event_id, e.name, e.whatsapp, e.email, e.cpf, replace(coalesce(e.instagram,''),'@',''),
           e.instagram_profile_pic_url, 'compra',
           coalesce(e.product_name, 'Masterclass IA'), e.amount,
           coalesce(e.payment_method, 'kirvano'), 'paid', e.lead_id, e.sales_event_id
    from enriched e
    on conflict (event_id, whatsapp) where whatsapp is not null do update set
      crm_lead_id = excluded.crm_lead_id,
      sales_event_id = coalesce(excluded.sales_event_id, public.event_attendees.sales_event_id),
      product = coalesce(public.event_attendees.product, excluded.product),
      payment_status = 'paid',
      instagram = coalesce(nullif(public.event_attendees.instagram,''), excluded.instagram),
      instagram_profile_pic_url = coalesce(public.event_attendees.instagram_profile_pic_url, excluded.instagram_profile_pic_url),
      updated_at = now()
    returning 1
  )
  select count(*) into v_inserted from ins;

  return v_inserted;
end;
$$;
grant execute on function public.import_event_buyers(uuid, text) to authenticated, service_role;

-- 7) RPC admin: check-in / desfazer ------------------------------------------
create or replace function public.toggle_event_checkin(p_attendee_id uuid, p_checked boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row record;
begin
  update public.event_attendees
     set checked_in_at = case when p_checked then now() else null end,
         updated_at = now()
   where id = p_attendee_id
   returning id, name, checked_in_at into v_row;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'Inscrito nao encontrado');
  end if;
  return jsonb_build_object('ok', true, 'attendee_id', v_row.id, 'checked_in_at', v_row.checked_in_at);
end;
$$;
grant execute on function public.toggle_event_checkin(uuid, boolean) to authenticated, service_role;

-- check-in por codigo de QR pessoal (scanner aponta e marca)
create or replace function public.checkin_by_code(p_event_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_row record;
begin
  select id, name, checked_in_at into v_row
  from public.event_attendees
  where event_id = p_event_id and checkin_code = p_code;
  if v_row.id is null then
    return jsonb_build_object('ok', false, 'error', 'QR nao confere com este evento');
  end if;
  update public.event_attendees set checked_in_at = coalesce(checked_in_at, now()), updated_at = now()
   where id = v_row.id;
  return jsonb_build_object('ok', true, 'attendee_id', v_row.id, 'name', v_row.name,
                            'already', v_row.checked_in_at is not null);
end;
$$;
grant execute on function public.checkin_by_code(uuid, text) to authenticated, service_role;

-- 8) RPC: grava foto/bio do scrap de Instagram num inscrito --------------------
-- chamada pelo frontend (publico ou admin) logo apos analyze-instagram-profile.
create or replace function public.save_attendee_instagram(p_attendee_id uuid, p_pic text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update public.event_attendees set
    instagram_profile_pic_url = coalesce(nullif(p_pic, ''), instagram_profile_pic_url),
    instagram_data = coalesce(p_data, instagram_data),
    instagram_scraped_at = now(),
    updated_at = now()
  where id = p_attendee_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'inscrito nao encontrado'); end if;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.save_attendee_instagram(uuid, text, jsonb) to anon, authenticated, service_role;

-- 9) RPC: traz quem confirmou presenca pelo link da campanha pra lista ---------
create or replace function public.import_event_confirmed_invites(p_event_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_inserted int := 0;
begin
  with confirmados as (
    select distinct on (l.whatsapp)
           i.lead_id, l.name, l.whatsapp, l.email, l.cpf, l.instagram
    from public.collective_event_invites i
    join public.crm_leads l on l.id = i.lead_id
    where i.event_id = p_event_id and i.rsvp_at is not null and l.whatsapp is not null
    order by l.whatsapp, i.rsvp_at desc
  ),
  ins as (
    insert into public.event_attendees (event_id, name, whatsapp, email, cpf, instagram, origin, payment_status, crm_lead_id)
    select p_event_id, c.name, c.whatsapp, c.email, c.cpf, replace(coalesce(c.instagram,''),'@',''),
           'manual', 'free', c.lead_id
    from confirmados c
    on conflict (event_id, whatsapp) where whatsapp is not null do update set
      crm_lead_id = coalesce(public.event_attendees.crm_lead_id, excluded.crm_lead_id),
      updated_at = now()
    returning 1
  )
  select count(*) into v_inserted from ins;
  return v_inserted;
end; $$;
grant execute on function public.import_event_confirmed_invites(uuid) to authenticated, service_role;
