-- Criar tabela principal de clientes
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  responsible_name TEXT NOT NULL,
  position TEXT,
  company_age TEXT,
  employees_count TEXT,
  full_address TEXT,
  served_regions TEXT,
  business_description TEXT,
  main_differential TEXT,
  client_main_pain TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  onboarding_step INTEGER NOT NULL DEFAULT 1,
  onboarding_token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de público-alvo
CREATE TABLE public.client_audience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  main_audience_profile TEXT,
  purchase_decision_maker TEXT,
  product_user TEXT,
  main_objections TEXT,
  purchase_triggers TEXT,
  preferred_channels TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de produtos/serviços
CREATE TABLE public.client_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  products_list JSONB DEFAULT '[]'::jsonb,
  non_offered_products TEXT,
  best_sellers TEXT,
  seasonal_products TEXT,
  profit_margins TEXT,
  exchange_policy TEXT,
  reservation_policy TEXT,
  payment_methods TEXT,
  promotions TEXT,
  discount_approval TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de branding/tom de voz
CREATE TABLE public.client_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  brand_tone TEXT,
  ai_introduction TEXT,
  client_treatment TEXT,
  phrases_to_avoid TEXT,
  phrases_to_use TEXT,
  brand_behaviors TEXT,
  serious_mistakes TEXT,
  product_vocabulary TEXT,
  ai_name TEXT,
  ai_presentation_style TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de operações
CREATE TABLE public.client_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  current_systems TEXT,
  integrations TEXT,
  attendance_flows TEXT,
  automation_scope TEXT,
  human_escalation_triggers TEXT,
  max_response_time TEXT,
  sales_scripts TEXT,
  required_client_data TEXT,
  marketing_channels TEXT,
  paid_ads TEXT,
  growth_goals TEXT,
  ai_main_objective TEXT,
  use_visual_language BOOLEAN DEFAULT false,
  client_database TEXT,
  desired_integrations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de políticas especiais
CREATE TABLE public.client_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  competitor_restrictions TEXT,
  discount_policies TEXT,
  unsatisfied_client_handling TEXT,
  auto_bonuses TEXT,
  forbidden_words TEXT,
  followup_routines TEXT,
  save_personal_data BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de objetivos e métricas
CREATE TABLE public.client_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  ai_expectations TEXT,
  kpis_to_measure TEXT,
  success_criteria TEXT,
  failure_criteria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de materiais de apoio
CREATE TABLE public.client_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  logo_url TEXT,
  product_photos JSONB DEFAULT '[]'::jsonb,
  testimonials JSONB DEFAULT '[]'::jsonb,
  environment_media JSONB DEFAULT '[]'::jsonb,
  brand_texts TEXT,
  catalogs_manuals TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de dados técnicos
CREATE TABLE public.client_technical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  operation_hours TEXT,
  after_hours_redirect TEXT,
  main_contacts JSONB DEFAULT '[]'::jsonb,
  partner_email TEXT,
  after_hours_response_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Tabela de expansão e fluxos
CREATE TABLE public.client_expansion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  ai_functions TEXT,
  future_features TEXT,
  automation_flows TEXT,
  special_messages TEXT,
  multiple_channels BOOLEAN DEFAULT false,
  followup_count INTEGER DEFAULT 3,
  followup_intervals TEXT,
  out_of_context_redirect TEXT,
  top_10_faqs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_audience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_technical ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_expansion ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read/write via token (para onboarding sem auth)
CREATE POLICY "Allow public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow public insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update clients" ON public.clients FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_audience" ON public.client_audience FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_audience" ON public.client_audience FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_audience" ON public.client_audience FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_products" ON public.client_products FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_products" ON public.client_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_products" ON public.client_products FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_branding" ON public.client_branding FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_branding" ON public.client_branding FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_branding" ON public.client_branding FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_operations" ON public.client_operations FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_operations" ON public.client_operations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_operations" ON public.client_operations FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_policies" ON public.client_policies FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_policies" ON public.client_policies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_policies" ON public.client_policies FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_goals" ON public.client_goals FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_goals" ON public.client_goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_goals" ON public.client_goals FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_materials" ON public.client_materials FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_materials" ON public.client_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_materials" ON public.client_materials FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_technical" ON public.client_technical FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_technical" ON public.client_technical FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_technical" ON public.client_technical FOR UPDATE USING (true);

CREATE POLICY "Allow public read client_expansion" ON public.client_expansion FOR SELECT USING (true);
CREATE POLICY "Allow public insert client_expansion" ON public.client_expansion FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update client_expansion" ON public.client_expansion FOR UPDATE USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_audience_updated_at BEFORE UPDATE ON public.client_audience FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_products_updated_at BEFORE UPDATE ON public.client_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_branding_updated_at BEFORE UPDATE ON public.client_branding FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_operations_updated_at BEFORE UPDATE ON public.client_operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_policies_updated_at BEFORE UPDATE ON public.client_policies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_goals_updated_at BEFORE UPDATE ON public.client_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_materials_updated_at BEFORE UPDATE ON public.client_materials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_technical_updated_at BEFORE UPDATE ON public.client_technical FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_expansion_updated_at BEFORE UPDATE ON public.client_expansion FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_clients_token ON public.clients(onboarding_token);
CREATE INDEX idx_clients_lead_id ON public.clients(lead_id);
CREATE INDEX idx_clients_status ON public.clients(status);