-- Cadencia de mensagens DENTRO de grupos de WhatsApp.
--
-- Diferente do no "inviteGroup" das automacoes de lead (que manda o LINK do grupo
-- pro lead, 1:1), aqui a mensagem e postada NO grupo. So a uazapi consegue postar
-- em grupo — a Cloud API oficial da Meta nao envia para grupos.
--
-- Motor 100% SQL + pg_cron, no mesmo padrao de broadcast_events_to_groups(),
-- porque o projeto esta em 100/100 edge functions (ver memoria).

-- ---------------------------------------------------------------- tabelas

create table if not exists public.wa_group_cadences (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  instance_id   uuid references public.whatsapp_instances(id) on delete set null,
  group_jids    jsonb not null default '[]'::jsonb,
  status        text  not null default 'draft',   -- draft | running | paused | completed
  start_at      timestamptz,                      -- null = comeca ao ativar
  started_at    timestamptz,
  completed_at  timestamptz,
  window_start  time not null default '08:00',    -- janela de envio (America/Sao_Paulo)
  window_end    time not null default '21:00',
  max_per_run   int  not null default 8,          -- envios por rodada do cron (anti-flood)
  sent_count    int  not null default 0,
  failed_count  int  not null default 0,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint wa_group_cadences_status_chk
    check (status in ('draft','running','paused','completed'))
);

create table if not exists public.wa_group_cadence_steps (
  id           uuid primary key default gen_random_uuid(),
  cadence_id   uuid not null references public.wa_group_cadences(id) on delete cascade,
  step_order   int  not null,
  delay_value  int  not null default 0,           -- espera desde o passo anterior
  delay_unit   text not null default 'dias',      -- minutos | horas | dias
  send_at_time time,                              -- opcional: fixa o horario do dia
  message      text not null,
  media_url    text,
  media_type   text,                              -- image | video | document | audio
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint wa_group_cadence_steps_unit_chk check (delay_unit in ('minutos','horas','dias')),
  constraint wa_group_cadence_steps_order_uq unique (cadence_id, step_order)
);

create table if not exists public.wa_group_cadence_sends (
  id          uuid primary key default gen_random_uuid(),
  cadence_id  uuid not null references public.wa_group_cadences(id) on delete cascade,
  step_id     uuid not null references public.wa_group_cadence_steps(id) on delete cascade,
  group_jid   text not null,
  group_name  text,
  status      text not null default 'sent',       -- sent | failed
  request_id  bigint,
  error       text,
  sent_at     timestamptz not null default now()
);

-- A trava contra mensagem repetida no grupo: cada passo sai UMA vez por grupo.
-- E um indice unico, entao a garantia e do banco, nao da logica da funcao.
create unique index if not exists wa_group_cadence_sends_step_group_uq
  on public.wa_group_cadence_sends (step_id, group_jid);

create index if not exists wa_group_cadence_steps_cadence_idx
  on public.wa_group_cadence_steps (cadence_id, step_order);
create index if not exists wa_group_cadence_sends_cadence_idx
  on public.wa_group_cadence_sends (cadence_id, sent_at desc);

-- ---------------------------------------------------------------- updated_at

create or replace function public.wa_group_cadence_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_wa_group_cadences_updated_at on public.wa_group_cadences;
create trigger trg_wa_group_cadences_updated_at
  before update on public.wa_group_cadences
  for each row execute function public.wa_group_cadence_touch();

drop trigger if exists trg_wa_group_cadence_steps_updated_at on public.wa_group_cadence_steps;
create trigger trg_wa_group_cadence_steps_updated_at
  before update on public.wa_group_cadence_steps
  for each row execute function public.wa_group_cadence_touch();

-- ---------------------------------------------------------------- RLS

alter table public.wa_group_cadences       enable row level security;
alter table public.wa_group_cadence_steps  enable row level security;
alter table public.wa_group_cadence_sends  enable row level security;

drop policy if exists wa_group_cadences_admin on public.wa_group_cadences;
create policy wa_group_cadences_admin on public.wa_group_cadences
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wa_group_cadence_steps_admin on public.wa_group_cadence_steps;
create policy wa_group_cadence_steps_admin on public.wa_group_cadence_steps
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists wa_group_cadence_sends_admin on public.wa_group_cadence_sends;
create policy wa_group_cadence_sends_admin on public.wa_group_cadence_sends
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- motor

-- Quando cada passo deve sair, contado a partir do inicio da cadencia.
create or replace function public.wa_group_cadence_step_due_at(
  p_started_at timestamptz,
  p_cadence_id uuid,
  p_step_order int
) returns timestamptz
language sql stable as $$
  with acumulado as (
    select coalesce(sum(
      case s.delay_unit
        when 'minutos' then make_interval(mins  => s.delay_value)
        when 'horas'   then make_interval(hours => s.delay_value)
        else                make_interval(days  => s.delay_value)
      end
    ), interval '0') as total
    from public.wa_group_cadence_steps s
    where s.cadence_id = p_cadence_id and s.step_order <= p_step_order
  ),
  alvo as (
    select p_started_at + (select total from acumulado) as base
  )
  select case
    when st.send_at_time is null then a.base
    -- send_at_time fixa o horario do dia, no fuso de Sao Paulo
    else ((a.base at time zone 'America/Sao_Paulo')::date + st.send_at_time)
         at time zone 'America/Sao_Paulo'
  end
  from alvo a
  join public.wa_group_cadence_steps st
    on st.cadence_id = p_cadence_id and st.step_order = p_step_order;
$$;

create or replace function public.run_wa_group_cadences()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  cad          record;
  passo        record;
  gj           text;
  v_token      text;
  v_url        text;
  v_due        timestamptz;
  v_agora_local time;
  v_enviados   int := 0;
  v_erros      int := 0;
  v_no_run     int;
  v_req        bigint;
  v_reservado  uuid;
  v_nome_grupo text;
  v_texto      text;
  v_pendentes  int;
begin
  v_agora_local := (now() at time zone 'America/Sao_Paulo')::time;

  for cad in
    select * from public.wa_group_cadences
    where status in ('draft','running')
      and (status = 'running' or (start_at is not null and start_at <= now()))
    order by created_at
  loop
    -- fora da janela de envio: nao posta de madrugada
    if v_agora_local < cad.window_start or v_agora_local > cad.window_end then
      continue;
    end if;

    -- primeira rodada: carimba o inicio
    if cad.started_at is null then
      update public.wa_group_cadences
        set started_at = coalesce(start_at, now()), status = 'running'
        where id = cad.id
        returning started_at into cad.started_at;
      cad.status := 'running';
    end if;

    -- credenciais da instancia (uazapi e a unica que posta em grupo)
    select i.instance_token, coalesce(i.api_url, 'https://squaad.uazapi.com')
      into v_token, v_url
      from public.whatsapp_instances i
     where i.provider = 'uazapi'
       and i.instance_token is not null
       and (cad.instance_id is null or i.id = cad.instance_id)
     order by (i.id = cad.instance_id) desc
     limit 1;

    if v_token is null then
      continue;  -- sem instancia utilizavel, tenta na proxima rodada
    end if;

    v_no_run := 0;

    for passo in
      select * from public.wa_group_cadence_steps
      where cadence_id = cad.id order by step_order
    loop
      v_due := public.wa_group_cadence_step_due_at(cad.started_at, cad.id, passo.step_order);
      exit when v_due > now();          -- passos sao sequenciais: se esse nao venceu, os proximos tambem nao

      for gj in select jsonb_array_elements_text(cad.group_jids) loop
        exit when v_no_run >= cad.max_per_run;

        -- dedup: o indice unico e a garantia; isso aqui so evita o trabalho
        if exists (
          select 1 from public.wa_group_cadence_sends s
          where s.step_id = passo.id and s.group_jid = gj
        ) then
          continue;
        end if;

        select name into v_nome_grupo from public.whatsapp_groups where group_jid = gj;
        v_texto := replace(passo.message, '{{grupo}}', coalesce(v_nome_grupo, ''));

        -- RESERVA ANTES DE ENVIAR. Se duas rodadas do cron se cruzarem, a segunda
        -- perde o insert no indice unico e nao chega a postar — o grupo nao recebe
        -- a mesma mensagem duas vezes. Enviar primeiro e gravar depois inverteria
        -- isso: a duplicata ja teria ido pro grupo.
        v_reservado := null;
        begin
          insert into public.wa_group_cadence_sends
            (cadence_id, step_id, group_jid, group_name, status)
          values (cad.id, passo.id, gj, v_nome_grupo, 'sending')
          returning id into v_reservado;
        exception when unique_violation then
          continue;   -- outra rodada ja reservou esse (passo, grupo)
        end;

        begin
          if passo.media_url is not null and passo.media_url <> '' then
            select net.http_post(
              v_url || '/send/media',
              jsonb_build_object(
                'number', replace(gj, '@g.us', '') || '@g.us',
                'type',   coalesce(passo.media_type, 'image'),
                'file',   passo.media_url,
                'text',   v_texto
              ),
              '{}'::jsonb,
              jsonb_build_object('Content-Type','application/json','token',v_token),
              8000
            ) into v_req;
          else
            select net.http_post(
              v_url || '/send/text',
              jsonb_build_object(
                'number', replace(gj, '@g.us', '') || '@g.us',
                'text',   v_texto
              ),
              '{}'::jsonb,
              jsonb_build_object('Content-Type','application/json','token',v_token),
              8000
            ) into v_req;
          end if;

          update public.wa_group_cadence_sends
            set status = 'sent', request_id = v_req
            where id = v_reservado;

          v_enviados := v_enviados + 1;

        exception when others then
          update public.wa_group_cadence_sends
            set status = 'failed', error = sqlerrm
            where id = v_reservado;
          v_erros := v_erros + 1;
        end;

        v_no_run := v_no_run + 1;
      end loop;

      exit when v_no_run >= cad.max_per_run;
    end loop;

    -- contadores + conclusao
    update public.wa_group_cadences c set
      sent_count   = (select count(*) from public.wa_group_cadence_sends s where s.cadence_id = c.id and s.status='sent'),
      failed_count = (select count(*) from public.wa_group_cadence_sends s where s.cadence_id = c.id and s.status='failed')
    where c.id = cad.id;

    select
      (select count(*) from public.wa_group_cadence_steps where cadence_id = cad.id)
      * jsonb_array_length(cad.group_jids)
      - (select count(*) from public.wa_group_cadence_sends where cadence_id = cad.id)
    into v_pendentes;

    if v_pendentes <= 0 and (select count(*) from public.wa_group_cadence_steps where cadence_id = cad.id) > 0 then
      update public.wa_group_cadences
        set status = 'completed', completed_at = now()
        where id = cad.id and status = 'running';
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'enviados', v_enviados, 'erros', v_erros);
end $$;

-- Disparo manual de um passo (botao "testar agora" no front), respeitando o dedup.
create or replace function public.wa_group_cadence_start(p_cadence_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;
  update public.wa_group_cadences
    set status = 'running', started_at = coalesce(started_at, now()), completed_at = null
    where id = p_cadence_id;
  return public.run_wa_group_cadences();
end $$;

grant execute on function public.wa_group_cadence_start(uuid) to authenticated;

-- ---------------------------------------------------------------- cron

select cron.unschedule('wa-group-cadence-tick')
  where exists (select 1 from cron.job where jobname = 'wa-group-cadence-tick');

select cron.schedule(
  'wa-group-cadence-tick',
  '*/5 * * * *',
  $cron$ select public.run_wa_group_cadences(); $cron$
);
