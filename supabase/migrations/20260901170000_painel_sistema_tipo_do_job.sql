-- Refina o painel: nem todo job de cron chama edge function. Os que rodam SQL puro
-- (notify_meetings, broadcast_events_to_groups, run_wa_group_cadences...) tem o
-- resultado de verdade no return_message do proprio cron, entao marca-los como
-- "sem telemetria" seria enganoso — nao falta telemetria, nao existe HTTP ali.

drop function if exists public.public_teste_list_sys();
drop function if exists public._teste_list_sys();

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
      -- resposta HTTP real; so existe para os jobs que passam pelo wrapper
      'http_status',  resp.status_code,
      'http_at',      resp.created,
      'http_body',    left(coalesce(resp.content, resp.error_msg, ''), 200),
      'instrumented', (sar.request_id is not null),
      -- o job respondeu 200 mas com {"ok":false,...}? isso e falha disfarcada
      'soft_error',   (resp.status_code between 200 and 299 and resp.content ~ '"ok"\s*:\s*false')
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
      select s.request_id
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
      select count(*) from net._http_response
      where created > now() - interval '24 hours' and (status_code >= 400 or status_code is null)
    )
  );
end $$;

grant execute on function public.list_system_automations() to authenticated;
