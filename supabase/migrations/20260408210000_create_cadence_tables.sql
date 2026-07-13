CREATE TABLE IF NOT EXISTS public.cadence_sequences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  steps jsonb DEFAULT '[]'::jsonb,
  -- steps format: [{"step": 1, "delay_hours": 0, "message_template": "...", "channel": "whatsapp"}, ...]
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cadence_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cadence_id uuid REFERENCES public.cadence_sequences(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  current_step integer DEFAULT 1,
  status text DEFAULT 'active', -- active, paused, completed, cancelled
  next_send_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cadence_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadence_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on cadence_sequences" ON public.cadence_sequences FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cadence_enrollments" ON public.cadence_enrollments FOR ALL USING (true) WITH CHECK (true);
