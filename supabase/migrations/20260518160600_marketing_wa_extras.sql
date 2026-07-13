-- ============================================================
-- Marketing Module — WA blast extras (colunas + cron)
-- ============================================================
ALTER TABLE public.wa_campaign_leads
  ADD COLUMN IF NOT EXISTS instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_message text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_wa_campaign_leads_updated_at ON public.wa_campaign_leads;
CREATE TRIGGER trg_wa_campaign_leads_updated_at
  BEFORE UPDATE ON public.wa_campaign_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_email_updated_at();

-- Cron pra wa-blast-processor a cada 2 min
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-blast-processor-tick') THEN
    PERFORM cron.unschedule('wa-blast-processor-tick');
  END IF;
END $$;

SELECT cron.schedule(
  'wa-blast-processor-tick',
  '*/2 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/wa-blast-processor',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $cron$
);

SELECT 'marketing_wa_extras OK' as result;
