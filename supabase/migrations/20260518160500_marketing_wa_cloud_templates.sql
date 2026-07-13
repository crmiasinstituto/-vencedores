-- ============================================================
-- Marketing Module — whatsapp_cloud_templates [SQUAAD]
-- ============================================================
-- Templates Meta WhatsApp Cloud API (CATEGORY: MARKETING/UTILITY/AUTHENTICATION).
-- Status: PENDING/APPROVED/REJECTED/PAUSED/DELETED/DRAFT (Meta).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_cloud_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_template_id text UNIQUE,
  meta_waba_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  variables_count int DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','PAUSED','DELETED','DRAFT')),
  rejection_reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (name, language)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_cloud_templates_status ON public.whatsapp_cloud_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_cloud_templates_category ON public.whatsapp_cloud_templates(category);

ALTER TABLE public.whatsapp_cloud_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_cloud_templates_authenticated_all ON public.whatsapp_cloud_templates;
CREATE POLICY whatsapp_cloud_templates_authenticated_all ON public.whatsapp_cloud_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_whatsapp_cloud_templates_updated_at ON public.whatsapp_cloud_templates;
CREATE TRIGGER trg_whatsapp_cloud_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_cloud_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_email_updated_at();

-- FK opcional: liga wa_campaigns.cloud_template_id (criado em 20260518160300)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='wa_campaigns')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE table_name='wa_campaigns' AND constraint_name='wa_campaigns_cloud_template_id_fkey'
     ) THEN
    ALTER TABLE public.wa_campaigns
      ADD CONSTRAINT wa_campaigns_cloud_template_id_fkey
      FOREIGN KEY (cloud_template_id) REFERENCES public.whatsapp_cloud_templates(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Tags internas pra organizar templates (do pacote, simplificadas)
CREATE TABLE IF NOT EXISTS public.whatsapp_template_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.whatsapp_cloud_templates(id) ON DELETE CASCADE,
  tag text NOT NULL,
  UNIQUE (template_id, tag)
);

ALTER TABLE public.whatsapp_template_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS whatsapp_template_tags_authenticated_all ON public.whatsapp_template_tags;
CREATE POLICY whatsapp_template_tags_authenticated_all ON public.whatsapp_template_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.whatsapp_cloud_templates IS
  'Templates Meta WhatsApp Cloud API. UI cria → POST Meta Graph → status=PENDING → cron sync atualiza.';

SELECT 'marketing_wa_cloud_templates OK' as result;
