
-- Create meetings table for Google Meet transcription
CREATE TABLE public.meetings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  user_id uuid,
  title text NOT NULL DEFAULT '',
  meeting_url text,
  status text NOT NULL DEFAULT 'scheduled',
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer DEFAULT 0,
  transcription text,
  transcriptions jsonb DEFAULT '[]'::jsonb,
  ai_summary text,
  ai_key_points jsonb DEFAULT '[]'::jsonb,
  ai_suggested_tasks jsonb DEFAULT '[]'::jsonb,
  ai_sentiment text,
  ai_processed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Public access policies (same pattern as other tables)
CREATE POLICY "Allow public read meetings" ON public.meetings FOR SELECT USING (true);
CREATE POLICY "Allow public insert meetings" ON public.meetings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update meetings" ON public.meetings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete meetings" ON public.meetings FOR DELETE USING (true);

-- Index for lead lookup
CREATE INDEX idx_meetings_lead_id ON public.meetings(lead_id);
CREATE INDEX idx_meetings_status ON public.meetings(status);
