CREATE TABLE IF NOT EXISTS public.utm_links (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://wa.me/5575999999999',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  full_url text,
  clicks integer DEFAULT 0,
  leads_generated integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  platform text DEFAULT 'meta', -- meta, google, tiktok, manual
  status text DEFAULT 'active', -- active, paused, completed
  budget numeric(12,2),
  spent numeric(12,2) DEFAULT 0,
  leads integer DEFAULT 0,
  conversions integer DEFAULT 0,
  cpl numeric(12,2),
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.utm_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on utm_links" ON public.utm_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_campaigns" ON public.marketing_campaigns FOR ALL USING (true) WITH CHECK (true);
