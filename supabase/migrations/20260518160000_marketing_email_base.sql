-- ============================================================
-- Marketing Module — Email Base (single-tenant) [SQUAAD adapted]
-- ============================================================
-- Adapta o pacote marketing-module-package/01-database/migrations/001 ao schema do CRM:
--   * leads        → crm_leads (kanban board+column)
--   * deals        → não existe; pular trigger
--   * pipeline_stage_id → column_id
-- Adiciona travas anti-ban e LGPD em crm_leads (opt-in WA, opt-out email).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Travas LGPD/anti-ban em crm_leads
-- ============================================================
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email_opted_out boolean DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email_opted_out_at timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS whatsapp_opt_in_source text;

COMMENT ON COLUMN public.crm_leads.whatsapp_opt_in IS
  'Trava anti-ban: lead precisa ter dado opt-in explícito para entrar em blast WhatsApp (wa_campaigns).';

-- ============================================================
-- 2. email_config singleton
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_config (
  id text PRIMARY KEY DEFAULT 'singleton' CHECK (id = 'singleton'),
  resend_api_key text,
  resend_webhook_secret text,
  from_email text,
  from_name text,
  reply_to text,
  company_address text,
  company_name text,
  app_url text DEFAULT 'https://squaadcrm.com',
  is_active boolean DEFAULT false,
  domain_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS email_config_authenticated_all ON public.email_config;
CREATE POLICY email_config_authenticated_all ON public.email_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.email_config (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. Tabelas de email
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text,
  preheader text,
  content_json jsonb,
  html_content text,
  thumbnail_url text,
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  criteria jsonb DEFAULT '{}'::jsonb,
  is_dynamic boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed','unsubscribed','bounced','complained')),
  unsubscribe_token uuid DEFAULT gen_random_uuid() UNIQUE,
  consent_source text,
  consent_at timestamptz,
  consent_ip text,
  unsubscribed_at timestamptz,
  bounce_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_unsubscribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  unsubscribed_at timestamptz DEFAULT now(),
  reason text
);

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  subject text NOT NULL,
  preheader text,
  template_id uuid REFERENCES public.email_templates(id),
  content_json jsonb,
  html_content text,
  html_cache text,
  list_id uuid REFERENCES public.email_lists(id),
  audience_filters jsonb DEFAULT '{}'::jsonb,
  from_name text,
  from_email text,
  reply_to text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','completed','failed','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  total_leads int DEFAULT 0,
  total_recipients int DEFAULT 0,
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  total_sent int DEFAULT 0,
  total_delivered int DEFAULT 0,
  total_opened int DEFAULT 0,
  total_clicked int DEFAULT 0,
  total_bounced int DEFAULT 0,
  total_unsubscribed int DEFAULT 0,
  settings jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','delivered','opened','clicked','bounced','complained','failed')),
  resend_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE TABLE IF NOT EXISTS public.email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  automation_run_id uuid,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  resend_id text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','sent','delivered','opened','clicked','bounced','complained','failed')),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  open_count int DEFAULT 0,
  clicked_at timestamptz,
  click_count int DEFAULT 0,
  clicked_url text,
  bounced_at timestamptz,
  bounce_reason text,
  error_message text,
  html text,
  user_agent text,
  device_type text,
  unsubscribed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid REFERENCES public.email_sends(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_event text,
  trigger_filter jsonb DEFAULT '{}'::jsonb,
  flow_json jsonb,
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid REFERENCES public.email_automations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  current_node_id text,
  scheduled_next_at timestamptz,
  status text DEFAULT 'active'
    CHECK (status IN ('active','completed','paused','failed','cancelled')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  context jsonb DEFAULT '{}'::jsonb,
  UNIQUE (automation_id, lead_id)
);

-- ============================================================
-- 4. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON public.email_templates(name);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_lists_active ON public.email_lists(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_email_subscribers_lead ON public.email_subscribers(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_subscribers_status ON public.email_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status) WHERE status IN ('scheduled','sending');
CREATE INDEX IF NOT EXISTS idx_email_campaign_leads_campaign ON public.email_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_campaign_leads_status ON public.email_campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_lead ON public.email_sends(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_resend ON public.email_sends(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON public.email_sends(status);
CREATE INDEX IF NOT EXISTS idx_email_events_send ON public.email_events(send_id);
CREATE INDEX IF NOT EXISTS idx_email_automations_active ON public.email_automations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_runs_scheduled
  ON public.email_automation_runs(scheduled_next_at) WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS email_events_unique_event
  ON public.email_events (send_id, event_type, (payload->>'created_at'));

-- ============================================================
-- 5. updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_email_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'email_config','email_templates','email_lists','email_subscribers',
    'email_campaigns','email_automations'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_email_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 6. RLS policies (authenticated all — single-tenant padrão)
-- ============================================================
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_runs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'email_templates','email_lists','email_subscribers','email_unsubscribes',
    'email_campaigns','email_campaign_leads','email_sends','email_events',
    'email_automations','email_automation_runs'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_authenticated_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 7. Storage bucket pra imagens dos emails
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_assets_public_read' AND schemaname='storage') THEN
    CREATE POLICY email_assets_public_read ON storage.objects FOR SELECT
    USING (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_assets_authenticated_write' AND schemaname='storage') THEN
    CREATE POLICY email_assets_authenticated_write ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_assets_authenticated_update' AND schemaname='storage') THEN
    CREATE POLICY email_assets_authenticated_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'email-assets');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='email_assets_authenticated_delete' AND schemaname='storage') THEN
    CREATE POLICY email_assets_authenticated_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'email-assets');
  END IF;
END $$;

-- ============================================================
-- 8. DB trigger pra automações em crm_leads
-- ============================================================
CREATE OR REPLACE FUNCTION public.dispatch_email_automation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event TEXT;
  v_lead_id UUID;
  v_context JSONB := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME = 'crm_leads' THEN
    IF TG_OP = 'INSERT' THEN
      v_event := 'lead_created';
      v_lead_id := NEW.id;
    ELSIF TG_OP = 'UPDATE' AND OLD.column_id IS DISTINCT FROM NEW.column_id THEN
      v_event := 'lead_column_changed';
      v_lead_id := NEW.id;
      v_context := jsonb_build_object(
        'from_column', OLD.column_id,
        'to_column', NEW.column_id,
        'board_id', NEW.board_id
      );
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-trigger',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'event', v_event,
      'lead_id', v_lead_id,
      'context', v_context
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_email_automation_crm_leads ON public.crm_leads;
CREATE TRIGGER trg_email_automation_crm_leads
  AFTER INSERT OR UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_email_automation_event();

-- ============================================================
-- 9. Cron: tick email-automation a cada 1 min
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'email-automation-tick') THEN
    PERFORM cron.unschedule('email-automation-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'email-automation-tick',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/email-automation-tick',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);

COMMENT ON TABLE public.email_config IS 'Config Resend (singleton). 1 ÚNICA row. Sem tenant_id.';
COMMENT ON TABLE public.email_templates IS 'Templates reutilizáveis pra campanhas e automações.';
COMMENT ON TABLE public.email_campaigns IS 'Campanhas one-shot. Single-tenant.';
COMMENT ON TABLE public.email_campaign_leads IS 'Mirror dos destinatários por campanha.';
COMMENT ON TABLE public.email_sends IS 'Cada envio individual (1 linha por destinatário).';
COMMENT ON TABLE public.email_events IS 'Auditoria bruta dos webhooks Resend.';
COMMENT ON TABLE public.email_automations IS 'Fluxos visuais React Flow.';
COMMENT ON TABLE public.email_automation_runs IS 'Execuções (1 por lead × automação).';

SELECT 'marketing_email_base OK' as result;
