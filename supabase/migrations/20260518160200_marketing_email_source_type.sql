-- ============================================================
-- Marketing Module — email_campaigns.source_type + automation_id
-- ============================================================
-- Separa campanhas reais de "shells" criadas por automações.

ALTER TABLE public.email_campaigns
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'campaign'
    CHECK (source_type IN ('campaign', 'automation', 'test')),
  ADD COLUMN IF NOT EXISTS automation_id uuid REFERENCES public.email_automations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_campaigns_source
  ON public.email_campaigns(source_type);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_automation
  ON public.email_campaigns(automation_id) WHERE automation_id IS NOT NULL;

SELECT 'marketing_email_source_type OK' as result;
