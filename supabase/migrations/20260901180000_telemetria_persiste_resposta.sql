-- O pg_net limpa net._http_response depois de algumas horas. Como o painel lia a
-- resposta de la, todo job diario (cobranca, relatorio semanal, analise de conversas)
-- aparecia sem status — o painel ficava cego exatamente nos jobs que rodam pouco.
-- Foi o que aconteceu com billing-reminders-daily: rodou 13:00 UTC e as 19:00 a
-- resposta ja nao existia mais.
--
-- Agora a resposta e copiada para system_automation_runs antes de sumir.

alter table public.system_automation_runs
  add column if not exists status_code int,
  add column if not exists response    text,
  add column if not exists timed_out   boolean,
  add column if not exists concluded_at timestamptz;

create index if not exists system_automation_runs_pendentes_idx
  on public.system_automation_runs (started_at)
  where concluded_at is null;

-- Copia o resultado das chamadas ainda nao concluidas.
create or replace function public.system_automation_conciliar()
returns int
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_n int;
begin
  with fechadas as (
    update public.system_automation_runs r
       set status_code  = resp.status_code,
           response     = left(coalesce(resp.content, resp.error_msg, ''), 500),
           timed_out    = resp.timed_out,
           concluded_at = now()
      from net._http_response resp
     where resp.id = r.request_id
       and r.concluded_at is null
    returning 1
  )
  select count(*) into v_n from fechadas;

  -- Requisicao que sumiu do pg_net sem nunca ter resposta: marca como perdida para
  -- nao ficar pendente pra sempre e reprocessada a cada minuto.
  update public.system_automation_runs r
     set concluded_at = now(),
         response = coalesce(r.response, 'sem resposta registrada (limpa pelo pg_net)')
   where r.concluded_at is null
     and r.started_at < now() - interval '6 hours';

  return v_n;
end $$;

-- Roda junto de cada disparo. cron_http_call e chamada de minuto em minuto pelo
-- email-automation-tick, entao nenhuma resposta chega perto das 6 horas de vida.
create or replace function public.cron_http_call(
  p_job     text,
  p_url     text,
  p_headers jsonb,
  p_body    jsonb default '{}'::jsonb,
  p_timeout int   default 60000
) returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_req bigint;
begin
  perform public.system_automation_conciliar();

  select net.http_post(
    url := p_url, body := p_body, params := '{}'::jsonb,
    headers := p_headers, timeout_milliseconds := p_timeout
  ) into v_req;

  insert into public.system_automation_runs (jobname, request_id) values (p_job, v_req);
  delete from public.system_automation_runs where started_at < now() - interval '30 days';
  return v_req;
end $$;

-- O painel passa a ler a resposta persistida, caindo em net._http_response so
-- enquanto a chamada mais recente ainda nao foi conciliada.
create or replace function public.list_system_automations()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'cron'
as $$
declare v_crons jsonb; v_triggers jsonb;
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;

  select coalesce(jsonb_agg(x order by x->>'category', x->>'label'), '[]'::jsonb) into v_crons
  from (
    select jsonb_build_object(
      'key',          j.jobname,
      'source',       'cron',
      'kind',         case when j.command ~ 'http' then 'http' else 'sql' end,
      'label',        coalesce(m.label, j.jobname),
      'description',  m.description,
      'category',     coalesce(m.category, 'Outros'),
      'schedule',     j.schedule,
      'active',       j.active,
      'last_run_at',  r.start_time,
      'cron_status',  r.status,
      'cron_message', r.return_message,
      'http_status',  coalesce(sar.status_code, resp.status_code),
      'http_at',      sar.started_at,
      'http_body',    left(coalesce(sar.response, resp.content, resp.error_msg, ''), 200),
      'timed_out',    coalesce(sar.timed_out, resp.timed_out),
      'instrumented', (sar.request_id is not null),
      'soft_error',   (
        coalesce(sar.status_code, resp.status_code) between 200 and 299
        and coalesce(sar.response, resp.content, '') ~ '"(ok|success)"\s*:\s*false'
      )
    ) as x
    from cron.job j
    left join public.system_automation_meta m on m.key = j.jobname and m.source = 'cron'
    left join lateral (
      select d.status, d.start_time, d.return_message
      from cron.job_run_details d
      where d.jobid = j.jobid and d.start_time is not null
      order by d.start_time desc limit 1
    ) r on true
    left join lateral (
      select s.request_id, s.status_code, s.response, s.timed_out, s.started_at
      from public.system_automation_runs s
      where s.jobname = j.jobname
      order by s.started_at desc limit 1
    ) sar on true
    left join net._http_response resp on resp.id = sar.request_id
  ) t;

  select coalesce(jsonb_agg(x order by x->>'category', x->>'label'), '[]'::jsonb) into v_triggers
  from (
    select jsonb_build_object(
      'key',         m.key,
      'source',      'trigger',
      'kind',        'trigger',
      'label',       m.label,
      'description', m.description,
      'category',    m.category,
      'target_table',m.target_table,
      'active',      (tg.tgname is not null and tg.tgenabled <> 'D'),
      'exists',      (tg.tgname is not null)
    ) as x
    from public.system_automation_meta m
    left join pg_trigger tg on tg.tgname = m.key and not tg.tgisinternal
    where m.source = 'trigger'
  ) t;

  return jsonb_build_object(
    'crons', v_crons,
    'triggers', v_triggers,
    'http_errors_24h', (
      select count(*) from public.system_automation_runs
      where started_at > now() - interval '24 hours'
        and (status_code >= 400 or timed_out or response ~ '"(ok|success)"\s*:\s*false')
    )
  );
end $$;

grant execute on function public.list_system_automations() to authenticated;

-- Fecha o que ja esta pendente agora.
select public.system_automation_conciliar();
