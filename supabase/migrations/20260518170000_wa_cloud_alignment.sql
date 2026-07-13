-- ============================================================
-- WA Cloud API — Alinhamento de schema [SQUAAD]
-- ============================================================
-- Idempotente: garante colunas e RPCs que o backend Cloud API
-- (wa-send-cloud, wa-cloud-webhook, wa-blast-processor, disc-morning-blast)
-- precisa pra funcionar. Pode rodar via Management API direto.
--
-- NÃO altera colunas existentes. Só ADD COLUMN IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION, expansão de CHECK constraints
-- e adição de status novos a wa_campaign_leads.
-- ============================================================

-- ------------------------------------------------------------
-- 1) whatsapp_instances: adiciona 'purpose'
--    (CHECK do provider já está OK no banco: aceita uazapi+cloud_api.
--     Frontend foi padronizado pra usar 'cloud_api' como canônico.)
-- ------------------------------------------------------------
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS purpose text DEFAULT 'inbox';

COMMENT ON COLUMN public.whatsapp_instances.purpose IS
  'inbox (atendimento normal) | campaign (dedicada anti-ban pra blast)';

-- ------------------------------------------------------------
-- 2) whatsapp_messages: campos de status Cloud API
-- ------------------------------------------------------------
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at      timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS updated_at   timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid
  ON public.whatsapp_messages(whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3) wa_campaign_leads: status estendidos + colunas Cloud
-- ------------------------------------------------------------
ALTER TABLE public.wa_campaign_leads
  ADD COLUMN IF NOT EXISTS responded_at        timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at           timestamptz,
  ADD COLUMN IF NOT EXISTS retry_count         int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message       text,
  ADD COLUMN IF NOT EXISTS instance_id         uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_message    text,
  ADD COLUMN IF NOT EXISTS response_message_id text,
  ADD COLUMN IF NOT EXISTS updated_at          timestamptz DEFAULT now();

-- Expande CHECK do status pra aceitar 'responded' e 'blocked' (idempotente)
DO $$
DECLARE
  v_constraint_name text;
  v_already_ok      boolean;
BEGIN
  SELECT c.conname,
         pg_get_constraintdef(c.oid) ~ 'responded' AND pg_get_constraintdef(c.oid) ~ 'blocked'
    INTO v_constraint_name, v_already_ok
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'wa_campaign_leads'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) ~ 'status'
   LIMIT 1;

  IF v_constraint_name IS NULL THEN
    ALTER TABLE public.wa_campaign_leads
      ADD CONSTRAINT wa_campaign_leads_status_check
      CHECK (status IN ('pending','sending','sent','delivered','read','responded','failed','blocked','skipped'));
  ELSIF NOT v_already_ok THEN
    EXECUTE format('ALTER TABLE public.wa_campaign_leads DROP CONSTRAINT %I', v_constraint_name);
    ALTER TABLE public.wa_campaign_leads
      ADD CONSTRAINT wa_campaign_leads_status_check
      CHECK (status IN ('pending','sending','sent','delivered','read','responded','failed','blocked','skipped'));
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4) wa_campaigns: contadores extras + pause/responded
-- ------------------------------------------------------------
ALTER TABLE public.wa_campaigns
  ADD COLUMN IF NOT EXISTS delivered_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS read_count      int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responded_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_count   int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paused_at       timestamptz,
  ADD COLUMN IF NOT EXISTS pause_reason    text;

-- ------------------------------------------------------------
-- 5) wa_campaign_instance_stats: bloqueio/cooldown
-- ------------------------------------------------------------
ALTER TABLE public.wa_campaign_instance_stats
  ADD COLUMN IF NOT EXISTS blocks_detected_day int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_block_at       timestamptz,
  ADD COLUMN IF NOT EXISTS cooldown_until      timestamptz;

-- ------------------------------------------------------------
-- 6) whatsapp_cloud_templates: tags e métricas inline
-- ------------------------------------------------------------
ALTER TABLE public.whatsapp_cloud_templates
  ADD COLUMN IF NOT EXISTS internal_tags    text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS example_values   jsonb  DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS total_sent       int    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_delivered  int    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_read       int    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_failed     int    DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at     timestamptz;

-- ------------------------------------------------------------
-- 7) RPC wa_can_send_now(p_instance_id uuid)
--    Usada por disc-morning-blast antes do batch.
--    Retorna { can: bool, reason: text, sent_today: int, sent_hour: int }
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_can_send_now(p_instance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_stats RECORD;
  v_inst  RECORD;
  v_hour_ms bigint;
BEGIN
  SELECT * INTO v_inst FROM whatsapp_instances WHERE id = p_instance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('can', false, 'reason', 'instance_not_found');
  END IF;
  IF v_inst.status = 'disconnected' THEN
    RETURN jsonb_build_object('can', false, 'reason', 'disconnected');
  END IF;

  SELECT * INTO v_stats FROM wa_campaign_instance_stats WHERE instance_id = p_instance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('can', true, 'reason', 'no_stats', 'sent_today', 0, 'sent_hour', 0);
  END IF;

  -- Cooldown ativo (bloqueio detectado)
  IF v_stats.cooldown_until IS NOT NULL AND v_stats.cooldown_until > now() THEN
    RETURN jsonb_build_object('can', false, 'reason', 'cooldown', 'cooldown_until', v_stats.cooldown_until);
  END IF;

  -- Limites globais: 300/dia, 100/hora (anti-ban Carlos 17/05)
  IF (v_stats.sent_today IS NOT NULL AND v_stats.sent_today >= 300) THEN
    RETURN jsonb_build_object('can', false, 'reason', 'day_limit', 'sent_today', v_stats.sent_today);
  END IF;
  IF v_stats.last_hour_window_at IS NOT NULL
     AND (extract(epoch from (now() - v_stats.last_hour_window_at)) < 3600)
     AND (v_stats.sent_this_hour IS NOT NULL AND v_stats.sent_this_hour >= 100) THEN
    RETURN jsonb_build_object('can', false, 'reason', 'hour_limit', 'sent_hour', v_stats.sent_this_hour);
  END IF;

  RETURN jsonb_build_object(
    'can', true,
    'reason', 'ok',
    'sent_today', coalesce(v_stats.sent_today, 0),
    'sent_hour', coalesce(v_stats.sent_this_hour, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_can_send_now(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 8) RPC increment_campaign_responded(p_campaign_id uuid)
--    Atomic increment usado pelo webhook ao detectar resposta.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_campaign_responded(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE wa_campaigns
  SET responded_count = coalesce(responded_count, 0) + 1,
      updated_at = now()
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_campaign_responded(uuid) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 9) RPC wa_increment_instance_stat (fallback usado por wa-send-cloud)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_increment_instance_stat(
  p_instance_id uuid,
  p_date date DEFAULT current_date,
  p_sent int DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Stats são por instância (não por (instance, date)) no schema atual.
  -- Mantém compat com ambas as variantes.
  INSERT INTO wa_campaign_instance_stats AS s (
    instance_id, sent_today, sent_this_hour,
    last_sent_at, last_hour_window_at, last_day_window_at, updated_at
  )
  VALUES (p_instance_id, p_sent, p_sent, v_now, v_now, v_now, v_now)
  ON CONFLICT (instance_id) DO UPDATE SET
    sent_today = CASE
      WHEN s.last_day_window_at IS NOT NULL AND s.last_day_window_at::date = current_date
      THEN coalesce(s.sent_today, 0) + p_sent
      ELSE p_sent
    END,
    sent_this_hour = CASE
      WHEN s.last_hour_window_at IS NOT NULL
           AND extract(epoch from (v_now - s.last_hour_window_at)) < 3600
      THEN coalesce(s.sent_this_hour, 0) + p_sent
      ELSE p_sent
    END,
    last_sent_at = v_now,
    last_hour_window_at = CASE
      WHEN s.last_hour_window_at IS NOT NULL
           AND extract(epoch from (v_now - s.last_hour_window_at)) < 3600
      THEN s.last_hour_window_at
      ELSE v_now
    END,
    last_day_window_at = CASE
      WHEN s.last_day_window_at IS NOT NULL AND s.last_day_window_at::date = current_date
      THEN s.last_day_window_at
      ELSE v_now
    END,
    updated_at = v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_increment_instance_stat(uuid, date, int) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 10) Trigger updated_at em wa_campaign_leads e whatsapp_messages
--     Cria função local fallback se public.set_email_updated_at não existir.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_campaign_leads_updated_at ON public.wa_campaign_leads;
CREATE TRIGGER trg_wa_campaign_leads_updated_at
  BEFORE UPDATE ON public.wa_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.wa_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
CREATE TRIGGER trg_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_set_updated_at();

SELECT 'wa_cloud_alignment OK' AS result;
