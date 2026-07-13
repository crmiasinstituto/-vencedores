CREATE TABLE IF NOT EXISTS public.candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  position text,
  status text DEFAULT 'registered', -- registered, interview_scheduled, interviewed, approved, rejected
  photo_url text,
  resume_notes text,
  interview_date timestamptz,
  interview_url text,
  interview_notes text,
  ai_analysis jsonb,
  rating integer, -- 1-5 stars
  assigned_to text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on candidates" ON public.candidates FOR ALL USING (true) WITH CHECK (true);
