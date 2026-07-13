-- Create table to track onboarding changes history
CREATE TABLE public.client_onboarding_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL DEFAULT 'client',
  change_reason TEXT,
  changed_fields JSONB,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_onboarding_changes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (admin panel uses service key)
CREATE POLICY "Allow public read client_onboarding_changes"
  ON public.client_onboarding_changes
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert client_onboarding_changes"
  ON public.client_onboarding_changes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update client_onboarding_changes"
  ON public.client_onboarding_changes
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete client_onboarding_changes"
  ON public.client_onboarding_changes
  FOR DELETE
  USING (true);

-- Add new columns to clients table for AI insights and Instagram data
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS instagram_profile_pic_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS instagram_data JSONB DEFAULT NULL;