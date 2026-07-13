-- ============================================================
-- Collective Events: cron jobs + resync H-24
-- ============================================================
-- 1) Dispatcher a cada 5min chama edge collective-event-dispatcher
-- 2) Resync a cada hora chama populate_collective_invites pra eventos H-24
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper: invoca edge function via pg_net
CREATE OR REPLACE FUNCTION public.invoke_collective_event_dispatcher()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_anon_key text;
  v_service_key text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'invoke_collective_event_dispatcher: vault secrets missing';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := v_url || '/functions/v1/collective-event-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key,
      'apikey', v_service_key
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Resync de segmento até H-24: pega eventos com scheduled_at em até 24h, resync_enabled,
-- e chama populate_collective_invites pra incluir leads novos.
CREATE OR REPLACE FUNCTION public.resync_collective_events_h24()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_inserted integer;
  v_total integer := 0;
  v_events_processed integer := 0;
BEGIN
  FOR v_event IN
    SELECT id, scheduled_at
    FROM public.collective_events
    WHERE status = 'scheduled'
      AND segment_resync_enabled = true
      AND scheduled_at > now()
      AND scheduled_at < now() + interval '24 hours'
  LOOP
    v_inserted := public.populate_collective_invites(v_event.id);
    v_total := v_total + v_inserted;
    v_events_processed := v_events_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'events_processed', v_events_processed,
    'invites_added', v_total
  );
END;
$$;

-- ============================================================
-- Cron jobs
-- ============================================================
-- Dispatcher a cada 5 min
DO $$
BEGIN
  PERFORM cron.unschedule('collective_event_dispatcher_5min');
EXCEPTION WHEN OTHERS THEN
  -- não existia
  NULL;
END $$;

SELECT cron.schedule(
  'collective_event_dispatcher_5min',
  '*/5 * * * *',
  $$SELECT public.invoke_collective_event_dispatcher();$$
);

-- Resync a cada hora
DO $$
BEGIN
  PERFORM cron.unschedule('collective_event_resync_hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'collective_event_resync_hourly',
  '0 * * * *',
  $$SELECT public.resync_collective_events_h24();$$
);

COMMENT ON FUNCTION public.resync_collective_events_h24() IS
  'Roda hora a hora: pra eventos com scheduled_at em até 24h, varre o segmento e adiciona invites pra leads novos. Dispatcher pega esses invites no próximo ciclo (até 5min).';

COMMENT ON FUNCTION public.invoke_collective_event_dispatcher() IS
  'Helper pg_net que aciona edge collective-event-dispatcher. Usa vault secrets (project_url, service_role_key).';
