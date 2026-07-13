-- ===========================================================
-- instagram_snapshots — snapshots semanais para rastrear evolução
-- de posicionamento dos leads (especialmente após DISC/PDF).
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.instagram_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identificação
  username TEXT NOT NULL,
  full_name TEXT,
  biography TEXT,
  category TEXT,
  external_url TEXT,
  profile_pic_url TEXT,

  -- Contagens
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0,

  -- Flags
  is_verified BOOLEAN DEFAULT false,
  is_business BOOLEAN DEFAULT false,
  is_private BOOLEAN DEFAULT false,

  -- Métricas dos posts recentes (até 12 últimos)
  posts_metrics JSONB,        -- [{type, likes, comments, caption, taken_at}, ...]
  engagement_rate NUMERIC,    -- (avg likes+comments) / followers
  posts_last_30d INTEGER,     -- contagem de posts no último mês
  avg_likes NUMERIC,
  avg_comments NUMERIC,
  top_hashtags TEXT[],

  -- Resposta crua (pra debug e features futuras)
  raw_profile JSONB,
  raw_posts JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instagram_snapshots_lead_id_scraped
  ON public.instagram_snapshots(lead_id, scraped_at DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_snapshots_username
  ON public.instagram_snapshots(username);

ALTER TABLE public.instagram_snapshots ENABLE ROW LEVEL SECURITY;

-- só leitura via service_role e admin autenticado
DROP POLICY IF EXISTS "admin_read_instagram_snapshots" ON public.instagram_snapshots;
CREATE POLICY "admin_read_instagram_snapshots"
  ON public.instagram_snapshots FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE public.instagram_snapshots IS
  'Snapshots semanais do Instagram dos leads via ScrapeCreators. Permite ver evolução de posicionamento (followers, engajamento, bio) ao longo do tempo — especialmente útil pra medir efeito do DISC/PDF entregue.';

-- agendamento semanal via pg_cron (domingo 4h BRT = 7h UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('instagram-weekly-snapshot') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'instagram-weekly-snapshot'
    );
    PERFORM cron.schedule(
      'instagram-weekly-snapshot',
      '0 7 * * 0',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.settings.supabase_url', true) || '/functions/v1/instagram-snapshot-cron',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
            'Content-Type', 'application/json',
            'x-cron-trigger', 'instagram-weekly-snapshot'
          ),
          body := jsonb_build_object('mode', 'weekly')
        );
      $cron$
    );
  END IF;
END $$;
