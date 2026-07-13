-- ============================================================
-- Marketing Module — WhatsApp Blast (wa_campaigns) [SQUAAD]
-- ============================================================
-- Cria do zero. Renomeia o `campaigns` do pacote para `wa_campaigns`
-- (evita colisão com marketing_campaigns existente, que é UTM/Ads spend tracking).
--
-- TRAVAS ANTI-BAN (Carlos tomou ban 17/05/2025 após blast):
--   - dedicated_instance_id NOT NULL: blast em instância dedicada, não na principal
--   - confirmed_opt_in_only DEFAULT true: só lead com whatsapp_opt_in=true
--   - max_per_hour <= 100, max_per_day <= 300 (CHECK rígido)
--   - cooldown 45-90s entre mensagens (mínimo 30s)
-- ============================================================

-- ============================================================
-- 1. Adiciona campos provider/Meta em whatsapp_instances
-- ============================================================
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'uazapi'
    CHECK (provider IN ('uazapi','cloud_api')),
  ADD COLUMN IF NOT EXISTS business_account_id text,
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS api_url text,
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS is_dedicated_blast boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.whatsapp_instances.is_dedicated_blast IS
  'Trava anti-ban: marque true APENAS em instâncias separadas para blast (nunca a principal de atendimento).';

-- ============================================================
-- 2. wa_campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,

  -- Provider
  provider text NOT NULL DEFAULT 'uazapi'
    CHECK (provider IN ('uazapi','cloud_api')),

  -- Conteúdo: UAZAPI = texto livre; cloud_api = template Meta
  message_text text,
  cloud_template_id uuid,
  cloud_template_params jsonb DEFAULT '[]'::jsonb,
  media_url text,
  media_type text CHECK (media_type IS NULL OR media_type IN ('image','video','document','audio')),

  -- Audiência
  audience_filters jsonb DEFAULT '{}'::jsonb,
  total_leads int DEFAULT 0,
  audience_count int DEFAULT 0,

  -- Execução
  dedicated_instance_id uuid NOT NULL REFERENCES public.whatsapp_instances(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','paused','completed','failed','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,

  -- TRAVAS anti-ban
  confirmed_opt_in_only boolean NOT NULL DEFAULT true,
  max_per_hour int NOT NULL DEFAULT 30 CHECK (max_per_hour > 0 AND max_per_hour <= 100),
  max_per_day int NOT NULL DEFAULT 100 CHECK (max_per_day > 0 AND max_per_day <= 300),
  cooldown_min_seconds int NOT NULL DEFAULT 45 CHECK (cooldown_min_seconds >= 30),
  cooldown_max_seconds int NOT NULL DEFAULT 90,
  warmup_required boolean NOT NULL DEFAULT true,

  -- Counters
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,

  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CHECK (cooldown_max_seconds >= cooldown_min_seconds)
);

CREATE TABLE IF NOT EXISTS public.wa_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.wa_campaigns(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  whatsapp text NOT NULL,
  assigned_to text,
  status text DEFAULT 'pending'
    CHECK (status IN ('pending','sending','sent','delivered','read','failed','skipped')),
  whatsapp_message_id text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (campaign_id, whatsapp)
);

-- Health/rate-limit por instância
CREATE TABLE IF NOT EXISTS public.wa_campaign_instance_stats (
  instance_id uuid PRIMARY KEY REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  sent_today int DEFAULT 0,
  sent_this_hour int DEFAULT 0,
  last_sent_at timestamptz,
  last_hour_window_at timestamptz,
  last_day_window_at timestamptz,
  warmup_messages_today int DEFAULT 0,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Índices
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status ON public.wa_campaigns(status) WHERE status IN ('scheduled','sending');
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_instance ON public.wa_campaigns(dedicated_instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaigns_provider ON public.wa_campaigns(provider);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_leads_campaign ON public.wa_campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_leads_status ON public.wa_campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_wa_campaign_leads_lead ON public.wa_campaign_leads(lead_id);

-- ============================================================
-- 4. RLS
-- ============================================================
ALTER TABLE public.wa_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_campaign_instance_stats ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['wa_campaigns','wa_campaign_leads','wa_campaign_instance_stats']) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_authenticated_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 5. updated_at trigger
-- ============================================================
DROP TRIGGER IF EXISTS trg_wa_campaigns_updated_at ON public.wa_campaigns;
CREATE TRIGGER trg_wa_campaigns_updated_at
  BEFORE UPDATE ON public.wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_email_updated_at();

DROP TRIGGER IF EXISTS trg_wa_campaign_instance_stats_updated_at ON public.wa_campaign_instance_stats;
CREATE TRIGGER trg_wa_campaign_instance_stats_updated_at
  BEFORE UPDATE ON public.wa_campaign_instance_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_email_updated_at();

-- ============================================================
-- 6. Guard: bloqueia start de wa_campaign sem instância dedicada
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_wa_campaign_safe(p_campaign_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_instance_id uuid;
  v_is_dedicated boolean;
BEGIN
  SELECT c.dedicated_instance_id, i.is_dedicated_blast
    INTO v_instance_id, v_is_dedicated
  FROM wa_campaigns c
  JOIN whatsapp_instances i ON i.id = c.dedicated_instance_id
  WHERE c.id = p_campaign_id;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'wa_campaign %: dedicated_instance_id é obrigatório', p_campaign_id;
  END IF;

  IF v_is_dedicated IS NOT TRUE THEN
    RAISE EXCEPTION 'wa_campaign %: instância % não está marcada como is_dedicated_blast=true (anti-ban)', p_campaign_id, v_instance_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_wa_campaign_safe(uuid) TO authenticated;

COMMENT ON TABLE public.wa_campaigns IS
  'Campanhas WhatsApp em blast. SEMPRE em instância dedicada (anti-ban Carlos 17/05/2025).';
COMMENT ON TABLE public.wa_campaign_leads IS
  'Destinatários de wa_campaigns. Status individual + WhatsApp message id.';
COMMENT ON TABLE public.wa_campaign_instance_stats IS
  'Health/rate-limit por instância UAZAPI/cloud_api. Atualizado pelo processor.';

SELECT 'marketing_wa_campaigns_base OK' as result;
