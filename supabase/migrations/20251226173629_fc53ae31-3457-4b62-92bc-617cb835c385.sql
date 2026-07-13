-- Tabela para armazenar planejamento de eventos
CREATE TABLE public.event_planning (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Fase 1: Definição de ICP
  icp_identity JSONB DEFAULT '{}'::jsonb,
  icp_pains JSONB DEFAULT '{}'::jsonb,
  icp_desires JSONB DEFAULT '{}'::jsonb,
  icp_objections JSONB DEFAULT '{}'::jsonb,
  
  -- Fase 2: Posicionamento
  positioning_transformation JSONB DEFAULT '{}'::jsonb,
  positioning_differential JSONB DEFAULT '{}'::jsonb,
  
  -- Fase 3: Primal Branding
  branding_belief TEXT,
  branding_enemy JSONB DEFAULT '[]'::jsonb,
  branding_language JSONB DEFAULT '[]'::jsonb,
  branding_ritual JSONB DEFAULT '{}'::jsonb,
  
  -- Fundadores
  founders JSONB DEFAULT '[]'::jsonb,
  
  -- Playbook gerado
  generated_playbook JSONB,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft',
  current_phase INTEGER NOT NULL DEFAULT 1
);

-- Enable RLS
ALTER TABLE public.event_planning ENABLE ROW LEVEL SECURITY;

-- Policies for public access (evento público)
CREATE POLICY "Allow public insert event_planning" 
ON public.event_planning 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public read event_planning" 
ON public.event_planning 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public update event_planning" 
ON public.event_planning 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete event_planning" 
ON public.event_planning 
FOR DELETE 
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_event_planning_updated_at
BEFORE UPDATE ON public.event_planning
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();