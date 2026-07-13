-- ===========================================
-- CRM KANBAN - ESTRUTURA COMPLETA
-- ===========================================

-- Tabela: crm_boards (Quadros/Produtos)
CREATE TABLE public.crm_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#FAC800',
  icon TEXT DEFAULT 'briefcase',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: crm_columns (Colunas do Kanban)
CREATE TABLE public.crm_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  sort_order INTEGER DEFAULT 0,
  is_final_stage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: crm_leads (Leads do CRM)
CREATE TABLE public.crm_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  column_id UUID REFERENCES public.crm_columns(id) ON DELETE SET NULL,
  
  -- Dados básicos
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  instagram TEXT,
  instagram_profile_pic_url TEXT,
  company_name TEXT,
  
  -- Dados de qualificação
  notes TEXT,
  tags TEXT[],
  lead_score INTEGER DEFAULT 0,
  potential_value NUMERIC,
  
  -- Agendamentos
  scheduled_call_at TIMESTAMPTZ,
  call_reminder_sent BOOLEAN DEFAULT false,
  
  -- Origem
  source TEXT DEFAULT 'manual',
  source_lead_id UUID,
  
  -- Metadados
  assigned_to TEXT,
  priority TEXT DEFAULT 'medium',
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  closed_at TIMESTAMPTZ,
  lost_reason TEXT
);

-- Tabela: crm_activities (Histórico de Atividades)
CREATE TABLE public.crm_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  board_id UUID REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Para mudanças de coluna
  from_column_name TEXT,
  to_column_name TEXT,
  
  -- Nome do board para exibição
  board_name TEXT,
  
  -- Metadados
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: crm_call_reminders (Lembretes de Calls)
CREATE TABLE public.crm_call_reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  reminder_minutes_before INTEGER DEFAULT 5,
  is_dismissed BOOLEAN DEFAULT false,
  is_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- ENABLE RLS
-- ===========================================

ALTER TABLE public.crm_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_call_reminders ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS POLICIES (Public access for admin)
-- ===========================================

-- crm_boards policies
CREATE POLICY "Allow public read crm_boards" ON public.crm_boards FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_boards" ON public.crm_boards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_boards" ON public.crm_boards FOR UPDATE USING (true);
CREATE POLICY "Allow public delete crm_boards" ON public.crm_boards FOR DELETE USING (true);

-- crm_columns policies
CREATE POLICY "Allow public read crm_columns" ON public.crm_columns FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_columns" ON public.crm_columns FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_columns" ON public.crm_columns FOR UPDATE USING (true);
CREATE POLICY "Allow public delete crm_columns" ON public.crm_columns FOR DELETE USING (true);

-- crm_leads policies
CREATE POLICY "Allow public read crm_leads" ON public.crm_leads FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_leads" ON public.crm_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_leads" ON public.crm_leads FOR UPDATE USING (true);
CREATE POLICY "Allow public delete crm_leads" ON public.crm_leads FOR DELETE USING (true);

-- crm_activities policies
CREATE POLICY "Allow public read crm_activities" ON public.crm_activities FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_activities" ON public.crm_activities FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_activities" ON public.crm_activities FOR UPDATE USING (true);
CREATE POLICY "Allow public delete crm_activities" ON public.crm_activities FOR DELETE USING (true);

-- crm_call_reminders policies
CREATE POLICY "Allow public read crm_call_reminders" ON public.crm_call_reminders FOR SELECT USING (true);
CREATE POLICY "Allow public insert crm_call_reminders" ON public.crm_call_reminders FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update crm_call_reminders" ON public.crm_call_reminders FOR UPDATE USING (true);
CREATE POLICY "Allow public delete crm_call_reminders" ON public.crm_call_reminders FOR DELETE USING (true);

-- ===========================================
-- TRIGGERS PARA UPDATED_AT
-- ===========================================

CREATE TRIGGER update_crm_boards_updated_at
  BEFORE UPDATE ON public.crm_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- DADOS INICIAIS - BOARDS
-- ===========================================

INSERT INTO public.crm_boards (name, slug, color, icon, sort_order) VALUES
  ('Imersão Do VHS ao Prompt', 'vhs-imersao', '#FAC800', 'rocket', 1),
  ('Mentoria Do VHS ao Prompt', 'vhs-mentoria', '#10B981', 'users', 2),
  ('Método Squaad', 'metodo-squaad', '#8B5CF6', 'briefcase', 3),
  ('MBAI Método Squaad', 'mbai-squaad', '#F59E0B', 'bot', 4);

-- ===========================================
-- DADOS INICIAIS - COLUNAS PADRÃO PARA CADA BOARD
-- ===========================================

-- Colunas para Imersão VHS
INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT id, 'Captado', '#6B7280', 1, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Primeiro Contato', '#3B82F6', 2, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Qualificado', '#8B5CF6', 3, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Call Agendada', '#F59E0B', 4, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Proposta Enviada', '#EC4899', 5, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Negociação', '#14B8A6', 6, false FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Fechado', '#10B981', 7, true FROM public.crm_boards WHERE slug = 'vhs-imersao'
UNION ALL
SELECT id, 'Perdido', '#EF4444', 8, true FROM public.crm_boards WHERE slug = 'vhs-imersao';

-- Colunas para Mentoria VHS
INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT id, 'Captado', '#6B7280', 1, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Primeiro Contato', '#3B82F6', 2, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Qualificado', '#8B5CF6', 3, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Call Agendada', '#F59E0B', 4, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Proposta Enviada', '#EC4899', 5, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Negociação', '#14B8A6', 6, false FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Fechado', '#10B981', 7, true FROM public.crm_boards WHERE slug = 'vhs-mentoria'
UNION ALL
SELECT id, 'Perdido', '#EF4444', 8, true FROM public.crm_boards WHERE slug = 'vhs-mentoria';

-- Colunas para Método Squaad
INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT id, 'Captado', '#6B7280', 1, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Primeiro Contato', '#3B82F6', 2, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Qualificado', '#8B5CF6', 3, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Call Agendada', '#F59E0B', 4, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Proposta Enviada', '#EC4899', 5, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Negociação', '#14B8A6', 6, false FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Fechado', '#10B981', 7, true FROM public.crm_boards WHERE slug = 'metodo-squaad'
UNION ALL
SELECT id, 'Perdido', '#EF4444', 8, true FROM public.crm_boards WHERE slug = 'metodo-squaad';

-- Colunas para MBAI Método Squaad
INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT id, 'Captado', '#6B7280', 1, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Primeiro Contato', '#3B82F6', 2, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Qualificado', '#8B5CF6', 3, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Call Agendada', '#F59E0B', 4, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Proposta Enviada', '#EC4899', 5, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Negociação', '#14B8A6', 6, false FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Fechado', '#10B981', 7, true FROM public.crm_boards WHERE slug = 'mbai-squaad'
UNION ALL
SELECT id, 'Perdido', '#EF4444', 8, true FROM public.crm_boards WHERE slug = 'mbai-squaad';

-- ===========================================
-- ÍNDICES PARA PERFORMANCE
-- ===========================================

CREATE INDEX idx_crm_leads_board_id ON public.crm_leads(board_id);
CREATE INDEX idx_crm_leads_column_id ON public.crm_leads(column_id);
CREATE INDEX idx_crm_leads_scheduled_call ON public.crm_leads(scheduled_call_at) WHERE scheduled_call_at IS NOT NULL;
CREATE INDEX idx_crm_activities_lead_id ON public.crm_activities(lead_id);
CREATE INDEX idx_crm_activities_board_id ON public.crm_activities(board_id);
CREATE INDEX idx_crm_activities_created_at ON public.crm_activities(created_at DESC);
CREATE INDEX idx_crm_columns_board_id ON public.crm_columns(board_id);