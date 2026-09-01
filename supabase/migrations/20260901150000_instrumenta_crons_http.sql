-- Passa os jobs de cron que chamam edge function pelo wrapper cron_http_call,
-- para que o painel consiga mostrar o status HTTP real (e nao o "succeeded"
-- que o pg_cron devolve so por ter enfileirado a requisicao).
--
-- Efeito colateral bom: as chaves anon/service_role saem de dentro de cron.job
-- (onde ficavam em texto puro no comando) e passam a viver numa tabela sem
-- policy de leitura, acessivel so por funcao security definer.
--
-- url, body e timeout de cada job sao preservados exatamente como estavam.
-- Backup dos comandos originais foi tirado antes de aplicar.

create table if not exists public.system_automation_secrets (
  name  text primary key,
  value text not null
);
alter table public.system_automation_secrets enable row level security;
-- sem policy: ninguem le via PostgREST. So security definer alcanca.

insert into public.system_automation_secrets (name, value)
select 'anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bWx3c2F3cm1naGhiYXdpYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NjI5NjUsImV4cCI6MjA5OTUzODk2NX0.mmnCM6HjBlADVpARI3S-2rSUWdZYpEMbf8hTO5fhwoM'
on conflict (name) do nothing;

insert into public.system_automation_secrets (name, value)
select 'service_key', '***SERVICE_ROLE_REMOVIDA***'
on conflict (name) do nothing;

-- Chamada de edge function a partir do cron, com telemetria.
create or replace function public.cron_edge_call(
  p_job     text,
  p_fn      text,
  p_body    jsonb   default '{}'::jsonb,
  p_role    text    default 'service',       -- 'anon' | 'service'
  p_timeout int     default 5000,            -- default do pg_net; preserva o comportamento antigo
  p_extra_headers jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_key text; v_headers jsonb;
begin
  select value into v_key from public.system_automation_secrets
   where name = case when p_role = 'anon' then 'anon_key' else 'service_key' end;

  v_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_key
  ) || coalesce(p_extra_headers, '{}'::jsonb);

  return public.cron_http_call(
    p_job,
    'https://iymlwsawrmghhbawiavz.supabase.co/functions/v1/' || p_fn,
    v_headers,
    p_body,
    p_timeout
  );
end $$;

-- ---------------------------------------------------------------- rewrite dos jobs

select cron.alter_job((select jobid from cron.job where jobname='ai-cadences-tick'),
  command := $c$select public.cron_edge_call('ai-cadences-tick','process-ai-agent-cadences','{}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='ai-analyze-conversations'),
  command := $c$select public.cron_edge_call('ai-analyze-conversations','analyze-agent-conversations','{"hours":24,"limit":30}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='event-reminders-tick'),
  command := $c$select public.cron_edge_call('event-reminders-tick','process-event-reminders','{}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='gcal-pull-tick'),
  command := $c$select public.cron_edge_call('gcal-pull-tick','sync-google-calendar','{"action":"pull"}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='admin-notif-tick'),
  command := $c$select public.cron_edge_call('admin-notif-tick','generate-admin-notifications','{}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='email-automation-tick'),
  command := $c$select public.cron_edge_call('email-automation-tick','email-automation-tick','{}'::jsonb,'service',60000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='wa-blast-processor-tick'),
  command := $c$select public.cron_edge_call('wa-blast-processor-tick','wa-blast-processor','{}'::jsonb,'service',60000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='email-automation-daily'),
  command := $c$select public.cron_edge_call('email-automation-daily','email-automation-daily','{}'::jsonb,'service',120000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='marketing-midia-cron'),
  command := $c$select public.cron_edge_call('marketing-midia-cron','marketing-midia','{"action":"schedule_tick"}'::jsonb,'service',120000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='billing-reminders-daily'),
  command := $c$select public.cron_edge_call('billing-reminders-daily','billing-reminders','{}'::jsonb,'anon',5000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='weekly-group-report'),
  command := $c$select public.cron_edge_call('weekly-group-report','weekly-group-report','{}'::jsonb,'anon',120000);$c$);

select cron.alter_job((select jobid from cron.job where jobname='gcal-push-tick'),
  command := $c$select public.cron_edge_call('gcal-push-tick','sync-google-calendar','{"action":"push"}'::jsonb,'anon',60000);$c$);

-- Esse tem FROM: dispara uma chamada por campanha travada em "sending".
-- O header User-Agent e obrigatorio — sem ele o Resend recusa.
select cron.alter_job((select jobid from cron.job where jobname='email-campanha-retomar'),
  command := $c$
  select public.cron_edge_call(
    'email-campanha-retomar','send-email-campaign',
    jsonb_build_object('campaign_id', c.id),'service',5000,
    jsonb_build_object('User-Agent','Mozilla/5.0')
  )
  from email_campaigns c
  where c.status = 'sending'
    and coalesce(c.source_type, 'campaign') = 'campaign'
    and exists (
      select 1 from email_campaign_leads l
      where l.campaign_id = c.id and l.status = 'pending'
    );
  $c$);

-- instagram-followup-check usa extensions.http_post (sincrono, outra extensao)
-- e fica como esta; o painel marca esse job como "sem telemetria".
