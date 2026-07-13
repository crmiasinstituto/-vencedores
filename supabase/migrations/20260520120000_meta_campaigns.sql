-- ============================================================
-- meta_campaigns + meta_publish_log
--
-- Rastreia o que o CRM subiu via Graph API v21.0 (campanhas, adsets, creatives, ads),
-- separado da tabela marketing_campaigns (que e tracking manual de UTM/spend).
--
-- A edge marketing-midia-publish escreve aqui apos cada sucesso na cascata
-- de chamadas a Meta API. meta_publish_log guarda req/resp de cada step
-- pra forense quando algo falha (erro 1443048, scope faltando, etc).
--
-- Aplicar via Supabase Management API (db push tem historico de problema
-- de divergencia neste projeto, ver memoria project_migration_divergence).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- IDs retornados pelo Meta
  meta_campaign_id text NOT NULL,
  meta_adset_ids jsonb DEFAULT '[]'::jsonb,
  meta_creative_ids jsonb DEFAULT '[]'::jsonb,
  meta_ad_ids jsonb DEFAULT '[]'::jsonb,
  meta_image_hashes jsonb DEFAULT '[]'::jsonb,

  -- Contexto SQUAAD
  name text NOT NULL,
  objective text NOT NULL,
  phase text,
  budget_total numeric(12,2),
  ticket numeric(12,2),
  cpl_max numeric(12,2),
  briefing_json jsonb DEFAULT '{}'::jsonb,

  -- Status no Meta. NUNCA ativa via codigo direto, admin ativa manual.
  -- Sincronizado periodicamente via insights pull.
  status text DEFAULT 'paused' CHECK (status IN ('draft', 'paused', 'active', 'archived')),

  -- Relacionamentos opcionais
  marketing_event_id uuid,
  initiative_id uuid,
  created_by uuid,

  -- Sync
  last_synced_at timestamptz,
  last_insights_json jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON public.meta_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_created_at ON public.meta_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_event ON public.meta_campaigns(marketing_event_id);

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_campaigns admin only"
  ON public.meta_campaigns
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- meta_publish_log: trilha de auditoria de cada chamada Meta API
-- durante o publish. Quando algo falha, voce le esse log pra entender
-- qual step quebrou e qual foi o request/response exato.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_publish_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meta_campaign_id uuid REFERENCES public.meta_campaigns(id) ON DELETE CASCADE,

  step text NOT NULL CHECK (step IN (
    'create_campaign',
    'upload_image',
    'create_adset',
    'create_creative',
    'create_ad',
    'activate',
    'pause',
    'sync_insights'
  )),

  success boolean NOT NULL DEFAULT false,
  request_json jsonb,
  response_json jsonb,
  error_message text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_publish_log_campaign ON public.meta_publish_log(meta_campaign_id);
CREATE INDEX IF NOT EXISTS idx_meta_publish_log_step_failures ON public.meta_publish_log(step, success) WHERE success = false;

ALTER TABLE public.meta_publish_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meta_publish_log admin only"
  ON public.meta_publish_log
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- updated_at automatico
CREATE OR REPLACE FUNCTION public.touch_meta_campaigns_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meta_campaigns_updated_at ON public.meta_campaigns;
CREATE TRIGGER trg_meta_campaigns_updated_at
  BEFORE UPDATE ON public.meta_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_meta_campaigns_updated_at();
