-- ============================================================
-- Automation Triggers V2 — Expansão dos gatilhos do módulo Marketing
-- ============================================================
-- Adiciona suporte aos seguintes eventos novos:
--   crm_leads:
--     - lead_column_changed (mudança de column_id)        [já no trigger existente, fica explícito]
--     - lead_board_changed  (mudança de board_id)
--     - lead_tag_added      (novo elemento no array tags)
--     - lead_score_threshold (lead_score cruza valor X — filter precisa do threshold)
--   email_events (via INSERT da edge process-email-event):
--     - email_opened
--     - email_clicked
--   Cron diário (9h UTC-3):
--     - lead_birthday     (data hoje = crm_leads.birthday)
--     - lead_inactive     (sem interação há X dias — filter define X)
-- ============================================================

-- 1) Recria a trigger function de crm_leads pra emitir mais eventos
CREATE OR REPLACE FUNCTION public.dispatch_email_automation_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_lead_id UUID;
  v_context JSONB := '{}'::jsonb;
  v_new_tags TEXT[];
  v_old_tags TEXT[];
  v_added_tags TEXT[];
BEGIN
  IF TG_TABLE_NAME = 'crm_leads' THEN
    IF TG_OP = 'INSERT' THEN
      v_event := 'lead_created';
      v_lead_id := NEW.id;
      v_context := jsonb_build_object(
        'source', NEW.source,
        'board_id', NEW.board_id,
        'column_id', NEW.column_id
      );
    ELSIF TG_OP = 'UPDATE' THEN
      -- Column changed
      IF OLD.column_id IS DISTINCT FROM NEW.column_id THEN
        v_event := 'lead_column_changed';
        v_lead_id := NEW.id;
        v_context := jsonb_build_object(
          'from_column', OLD.column_id,
          'to_column', NEW.column_id,
          'board_id', NEW.board_id
        );
        PERFORM net.http_post(
          url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('event', v_event, 'lead_id', v_lead_id, 'context', v_context)
        );
      END IF;

      -- Board changed
      IF OLD.board_id IS DISTINCT FROM NEW.board_id THEN
        v_event := 'lead_board_changed';
        v_lead_id := NEW.id;
        v_context := jsonb_build_object(
          'from_board', OLD.board_id,
          'to_board', NEW.board_id
        );
        PERFORM net.http_post(
          url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('event', v_event, 'lead_id', v_lead_id, 'context', v_context)
        );
      END IF;

      -- Tag added: detecta tags novas no array
      v_new_tags := COALESCE(NEW.tags, ARRAY[]::TEXT[]);
      v_old_tags := COALESCE(OLD.tags, ARRAY[]::TEXT[]);
      SELECT ARRAY(SELECT unnest(v_new_tags) EXCEPT SELECT unnest(v_old_tags)) INTO v_added_tags;
      IF array_length(v_added_tags, 1) > 0 THEN
        FOREACH v_event IN ARRAY v_added_tags LOOP
          PERFORM net.http_post(
            url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
              'event', 'lead_tag_added',
              'lead_id', NEW.id,
              'context', jsonb_build_object('tag', v_event, 'all_tags', NEW.tags)
            )
          );
        END LOOP;
      END IF;

      -- Score threshold: avisa quando lead_score muda
      IF OLD.lead_score IS DISTINCT FROM NEW.lead_score AND NEW.lead_score IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'event', 'lead_score_changed',
            'lead_id', NEW.id,
            'context', jsonb_build_object(
              'old_score', OLD.lead_score,
              'new_score', NEW.lead_score
            )
          )
        );
      END IF;

      RETURN NEW; -- já disparou tudo necessário, retorna sem o fallback abaixo
    END IF;
  END IF;

  -- Fallback pra INSERT (continua disparando o lead_created)
  IF v_event IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('event', v_event, 'lead_id', v_lead_id, 'context', v_context)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

-- Recria o trigger (já existia, mas garante)
DROP TRIGGER IF EXISTS trg_email_automation_crm_leads ON public.crm_leads;
CREATE TRIGGER trg_email_automation_crm_leads
  AFTER INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_email_automation_event();

-- ============================================================
-- 2) Trigger em email_events: dispara automação quando email aberto/clicado
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_email_engagement_event()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_lead_id UUID;
  v_campaign_id UUID;
BEGIN
  IF NEW.event_type NOT IN ('email.opened', 'email.clicked') THEN
    RETURN NEW;
  END IF;

  SELECT lead_id, campaign_id INTO v_lead_id, v_campaign_id
  FROM email_sends WHERE id = NEW.send_id;

  IF v_lead_id IS NULL THEN RETURN NEW; END IF;

  v_event := CASE NEW.event_type
    WHEN 'email.opened' THEN 'email_opened'
    WHEN 'email.clicked' THEN 'email_clicked'
  END;

  PERFORM net.http_post(
    url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event', v_event,
      'lead_id', v_lead_id,
      'context', jsonb_build_object('campaign_id', v_campaign_id, 'event_type', NEW.event_type)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_engagement_dispatch ON public.email_events;
CREATE TRIGGER trg_email_engagement_dispatch
  AFTER INSERT ON public.email_events
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_email_engagement_event();

-- ============================================================
-- 3) Coluna birthday em crm_leads (se ainda não existe)
-- ============================================================
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS birthday date,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

-- ============================================================
-- 4) Cron diário 12:00 UTC (9h Brasil) — chama edge automation-daily-cron
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-automation-daily') THEN
    PERFORM cron.unschedule('email-automation-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'email-automation-daily',
  '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-daily',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);

SELECT 'automation_triggers_v2 OK' AS result;
