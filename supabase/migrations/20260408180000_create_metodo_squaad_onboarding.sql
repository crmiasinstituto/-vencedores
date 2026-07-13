CREATE TABLE IF NOT EXISTS public.metodo_squaad_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- From CRM lead
  crm_lead_id uuid REFERENCES public.crm_leads(id),

  -- Profile
  name text NOT NULL,
  company text,
  role text,
  whatsapp text NOT NULL,
  email text,
  expectation text,

  -- AI Goals (selected topics)
  ai_goals text[] DEFAULT '{}',
  custom_goal text,

  -- Level Assessment
  ai_level text DEFAULT 'iniciante', -- iniciante, intermediario, avancado
  uses_ai_tools boolean DEFAULT false,
  ai_tools_used text,
  biggest_challenge text,
  weekly_hours text DEFAULT '4h',

  -- Payment
  payment_method text, -- pix, boleto, cartao_avista, cartao_3x, cartao_6x, cartao_12x
  payment_status text DEFAULT 'pendente', -- pendente, pago, cancelado
  payment_value numeric(10,2),

  -- Personalized plan
  personalized_plan jsonb DEFAULT '[]'::jsonb,

  -- Onboarding
  onboarding_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  onboarding_step integer DEFAULT 1,
  status text DEFAULT 'pending', -- pending, in_progress, completed, paid

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.metodo_squaad_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on metodo_squaad_enrollments" ON public.metodo_squaad_enrollments FOR ALL USING (true) WITH CHECK (true);
