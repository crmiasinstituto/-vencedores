-- ============================================================
-- Cron 4h pra marketing-meta (action: cron_tick)
--
-- Roda a cada 4 horas em horario UTC (00:00, 04:00, 08:00, 12:00, 16:00, 20:00),
-- que da em BRT (21:00, 01:00, 05:00, 09:00, 13:00, 17:00).
--
-- Ajuste a expressao cron pra rodar nos horarios de pico (9h, 13h, 17h BRT)
-- mudando pra '0 12,16,20 * * *' (3 reports/dia) se 6/dia for excessivo.
--
-- Tambem cria tabela system_cron_log opcional pra auditar execucoes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_cron_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name text NOT NULL,
  success boolean NOT NULL,
  result jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_cron_log_job_date
  ON public.system_cron_log(job_name, created_at DESC);

ALTER TABLE public.system_cron_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_cron_log admin only"
  ON public.system_cron_log
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Agendamento via pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    -- Limpa schedule anterior se existir (qualquer nome legado tambem)
    PERFORM cron.unschedule('marketing-midia-cron')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marketing-midia-cron');
    PERFORM cron.unschedule('marketing-meta-cron')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'marketing-meta-cron');

    -- A cada 4 horas no minuto 0, chama marketing-meta com action cron_tick
    PERFORM cron.schedule(
      'marketing-meta-cron',
      '0 */4 * * *',
      $cron$
        SELECT net.http_post(
          url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/marketing-meta',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := '{"action": "cron_tick"}'::jsonb
        );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron ou pg_net nao disponivel. Acione marketing-meta (cron_tick) via HTTP manualmente.';
  END IF;
END $$;
