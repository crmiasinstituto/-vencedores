-- ============================================================
-- 03_cron_jobs.template.sql
-- Recria os 18 cron jobs no PROJETO NOVO.
-- Os jobs originais tinham o endereco e as chaves da SQUAAD cravados; aqui viraram
-- placeholders. O clone.sh substitui antes de aplicar:
--   __PROJECT_REF__        -> ref do projeto novo (ex: abcdwxyz)
--   __ANON_KEY__           -> anon key do projeto novo
--   __SERVICE_ROLE_KEY__   -> service_role key do projeto novo
-- cron.schedule(nome, ...) substitui o job se o nome ja existir (idempotente).
-- ============================================================

select cron.schedule('meeting-reminders-check', '*/15 * * * *', $job$ SELECT public.notify_meetings(); $job$);

select cron.schedule('instagram-followup-check', '*/30 * * * *', $job$ SELECT extensions.http_post('https://__PROJECT_REF__.supabase.co/functions/v1/instagram-followup', '{"minutes_threshold": 60}'::jsonb, '{"Content-Type": "application/json", "apikey": "__ANON_KEY__"}'::jsonb); $job$);

select cron.schedule('ai-cadences-tick', '*/2 * * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/process-ai-agent-cadences', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{}'::jsonb ); $job$);

select cron.schedule('ai-analyze-conversations', '15 3 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/analyze-agent-conversations', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{"hours":24,"limit":30}'::jsonb ); $job$);

select cron.schedule('event-reminders-tick', '* * * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/process-event-reminders', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{}'::jsonb ); $job$);

select cron.schedule('gcal-pull-tick', '*/15 * * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/sync-google-calendar', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{"action":"pull"}'::jsonb ); $job$);

select cron.schedule('admin-notif-tick', '*/10 * * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/generate-admin-notifications', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{}'::jsonb ); $job$);

select cron.schedule('email-automation-tick', '* * * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/email-automation-tick', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb ); $job$);

select cron.schedule('wa-blast-processor-tick', '*/2 10-23,0-2 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/wa-blast-processor', headers := jsonb_build_object('Authorization', 'Bearer __SERVICE_ROLE_KEY__', 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 60000 ); $job$);

select cron.schedule('engagement-daily-alert', '0 12 * * *', $job$ SELECT public.run_daily_engagement_alert(); $job$);

select cron.schedule('email-automation-daily', '0 12 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/email-automation-daily', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb ); $job$);

select cron.schedule('marketing-midia-cron', '0 */4 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/marketing-midia-cron', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{}'::jsonb ); $job$);

select cron.schedule('disc-pdf-fallback', '*/5 10-23 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/disc-pdf-fallback', headers := jsonb_build_object('Authorization', 'Bearer __SERVICE_ROLE_KEY__', 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 180000 ); $job$);

select cron.schedule('collective_event_dispatch_sql_1min', '* * * * *', $job$
DO $inner$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.collective_events WHERE status='scheduled' AND scheduled_at > now() LOOP
    PERFORM public.dispatch_collective_event_batch(r.id, 200);
    PERFORM public.dispatch_collective_event_reminders(r.id, 300);
  END LOOP;
END $inner$;
$job$);

select cron.schedule('billing-reminders-daily', '0 13 * * *', $job$ SELECT net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/billing-reminders', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer __ANON_KEY__'), body := '{}'::jsonb ); $job$);

select cron.schedule('weekly-group-report', '30 20 * * 5', $job$ select net.http_post( url := 'https://__PROJECT_REF__.supabase.co/functions/v1/weekly-group-report', headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer __ANON_KEY__'), body := '{}'::jsonb, timeout_milliseconds := 120000 ); $job$);

select cron.schedule('gcal-push-tick', '*/10 * * * *', $job$ select net.http_post( url:='https://__PROJECT_REF__.supabase.co/functions/v1/sync-google-calendar', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer __ANON_KEY__'), body:='{"action":"push"}'::jsonb, timeout_milliseconds:=60000 ); $job$);

select cron.schedule('event-group-broadcast', '*/10 * * * *', $job$ select public.broadcast_events_to_groups(); $job$);
