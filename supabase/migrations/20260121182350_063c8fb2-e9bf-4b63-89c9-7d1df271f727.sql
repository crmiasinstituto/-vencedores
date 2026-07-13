-- Tabela principal de participantes VHS
CREATE TABLE public.vhs_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id),
  
  -- Identificação
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  
  -- Token de acesso único
  onboarding_token TEXT UNIQUE NOT NULL,
  
  -- Step 1: Momento Atual
  current_situation TEXT,
  monthly_income TEXT,
  work_hours_weekly TEXT,
  main_frustration TEXT,
  
  -- Step 2: Vida Pessoal
  age_range TEXT,
  marital_status TEXT,
  has_children BOOLEAN,
  children_count INTEGER,
  family_dependents INTEGER,
  
  -- Step 3: Sonhos
  biggest_dream TEXT,
  dream_deadline TEXT,
  what_would_change TEXT,
  dream_income TEXT,
  
  -- Step 4: Dores
  feels_undervalued BOOLEAN,
  salary_covers_bills BOOLEAN,
  has_financial_freedom BOOLEAN,
  main_pain_points TEXT[],
  
  -- Step 5: 2026
  goals_2026 TEXT[],
  priority_goal TEXT,
  why_this_event TEXT,
  commitment_level INTEGER,
  
  -- Step 6: Expectativas
  expects_from_event TEXT,
  already_knows_ai BOOLEAN,
  ai_experience_level TEXT,
  main_doubts TEXT,
  
  -- Rastreamento de Jornada
  landing_accessed_at TIMESTAMPTZ,
  popup_filled_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ,
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_step INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de progresso por step
CREATE TABLE public.vhs_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID REFERENCES public.vhs_participants(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,
  step_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vhs_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vhs_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Policies para acesso público (onboarding é acessado via token único)
CREATE POLICY "Allow public read with token" ON public.vhs_participants
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON public.vhs_participants
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON public.vhs_participants
  FOR UPDATE USING (true);

CREATE POLICY "Allow progress read" ON public.vhs_onboarding_progress
  FOR SELECT USING (true);

CREATE POLICY "Allow progress insert" ON public.vhs_onboarding_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow progress update" ON public.vhs_onboarding_progress
  FOR UPDATE USING (true);

-- Trigger para updated_at
CREATE TRIGGER update_vhs_participants_updated_at
  BEFORE UPDATE ON public.vhs_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_vhs_participants_token ON public.vhs_participants(onboarding_token);
CREATE INDEX idx_vhs_participants_whatsapp ON public.vhs_participants(whatsapp);
CREATE INDEX idx_vhs_participants_lead_id ON public.vhs_participants(lead_id);
CREATE INDEX idx_vhs_progress_participant ON public.vhs_onboarding_progress(participant_id);