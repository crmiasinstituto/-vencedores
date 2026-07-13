CREATE TABLE IF NOT EXISTS public.integration_keys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  service text NOT NULL UNIQUE,
  api_key text,
  api_secret text,
  account_id text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.integration_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on integration_keys" ON public.integration_keys FOR ALL USING (true) WITH CHECK (true);

-- Seed default services
INSERT INTO public.integration_keys (service) VALUES
  ('openai'),
  ('uazapi'),
  ('wavoip'),
  ('soniox'),
  ('google_places'),
  ('meta_ads'),
  ('instagram'),
  ('anthropic'),
  ('google_calendar')
ON CONFLICT (service) DO NOTHING;
