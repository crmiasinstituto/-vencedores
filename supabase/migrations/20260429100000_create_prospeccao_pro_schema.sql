-- ============================================================
-- PROSPECCAO PRO — Schema (substitui módulo antigo /admin/prospeccao)
-- ============================================================
-- 6 tabelas core (prospeccao_*) compartilhadas entre admin e membros,
-- + 2 tabelas extras pra área dos membros (leads salvos + cota mensal).
--
-- Audiência:
--  - admin (CRM SQUAAD): identificado por created_by_user_id (auth.uid)
--  - membro Método Squaad: identificado por created_by_member_id (FK members)
--
-- Pra remover o módulo: DROP TABLE prospeccao_*; (sem dependências FK
-- rígidas com crm_leads ou crm_boards).
-- ============================================================

-- ============================================================
-- 1. prospeccao_buscas — toda busca/sessão
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_buscas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  query_normalizada TEXT,
  intent_detectada JSONB DEFAULT '{}'::jsonb,
  nicho TEXT,
  cidade TEXT,
  uf TEXT,
  fontes_selecionadas TEXT[] DEFAULT ARRAY[]::text[],
  limite_solicitado INTEGER DEFAULT 20,
  total_resultados INTEGER DEFAULT 0,
  custo NUMERIC DEFAULT 0,
  duracao_ms INTEGER,
  status TEXT DEFAULT 'pending',
  erro TEXT,
  resultados_raw JSONB,
  created_by_user_id UUID,                                  -- admin: auth.users.id
  created_by_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE, -- membro
  audience TEXT DEFAULT 'admin' CHECK (audience IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pb_user ON public.prospeccao_buscas (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pb_member ON public.prospeccao_buscas (created_by_member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pb_audience ON public.prospeccao_buscas (audience, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pb_nicho ON public.prospeccao_buscas (nicho);
CREATE INDEX IF NOT EXISTS idx_pb_status ON public.prospeccao_buscas (status);

-- ============================================================
-- 2. prospeccao_leads_descobertos — cada lead no funil de descoberta
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_leads_descobertos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  busca_id UUID REFERENCES public.prospeccao_buscas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT,
  telefone TEXT,
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  url_maps TEXT,
  url_site TEXT,
  instagram_handle TEXT,
  facebook_url TEXT,
  linkedin_url TEXT,
  youtube_url TEXT,
  tiktok_handle TEXT,
  nota_google NUMERIC,
  qtd_avaliacoes INTEGER,
  faixa_preco TEXT,
  status TEXT DEFAULT 'descoberto', -- descoberto | analisado | virou_lead | descartado
  selecionado_para_analise BOOLEAN DEFAULT false,
  virou_lead_em TIMESTAMPTZ,
  -- Pontes pra ambos os mundos (sem FK pra evitar acoplamento)
  lead_id UUID,                            -- crm_leads.id (admin)
  member_lead_id UUID,                     -- prospeccao_member_leads.id (membro)
  deal_id UUID,                            -- (compat futuro)
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  created_by_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  audience TEXT DEFAULT 'admin' CHECK (audience IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pld_busca ON public.prospeccao_leads_descobertos (busca_id);
CREATE INDEX IF NOT EXISTS idx_pld_status ON public.prospeccao_leads_descobertos (status);
CREATE INDEX IF NOT EXISTS idx_pld_lead ON public.prospeccao_leads_descobertos (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pld_member_lead ON public.prospeccao_leads_descobertos (member_lead_id) WHERE member_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pld_user ON public.prospeccao_leads_descobertos (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pld_member ON public.prospeccao_leads_descobertos (created_by_member_id);

-- ============================================================
-- 3. prospeccao_diagnosticos — análise multi-canal de cada lead
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_descoberto_id UUID REFERENCES public.prospeccao_leads_descobertos(id) ON DELETE CASCADE,
  busca_id UUID REFERENCES public.prospeccao_buscas(id) ON DELETE SET NULL,
  -- Scores por canal (0-100)
  score_site INTEGER,
  score_google_maps INTEGER,
  score_instagram INTEGER,
  score_facebook INTEGER,
  score_linkedin INTEGER,
  score_youtube INTEGER,
  score_tiktok INTEGER,
  score_doctoralia INTEGER,
  score_reclame_aqui INTEGER,
  score_ifood INTEGER,
  score_meta_ads INTEGER,
  score_google_ads INTEGER,
  score_posicao_google INTEGER,
  score_pagespeed INTEGER,
  score_outros JSONB DEFAULT '{}'::jsonb,
  score_geral NUMERIC,
  -- Scores por pilar (0-10)
  score_atracao NUMERIC,
  score_qualificacao NUMERIC,
  score_conversao NUMERIC,
  score_retencao NUMERIC,
  -- Achados raspados de cada fonte
  achados_site JSONB DEFAULT '{}'::jsonb,
  achados_maps JSONB DEFAULT '{}'::jsonb,
  achados_instagram JSONB DEFAULT '{}'::jsonb,
  achados_facebook JSONB DEFAULT '{}'::jsonb,
  achados_linkedin JSONB DEFAULT '{}'::jsonb,
  achados_youtube JSONB DEFAULT '{}'::jsonb,
  achados_tiktok JSONB DEFAULT '{}'::jsonb,
  achados_doctoralia JSONB DEFAULT '{}'::jsonb,
  achados_reclame_aqui JSONB DEFAULT '{}'::jsonb,
  achados_ifood JSONB DEFAULT '{}'::jsonb,
  achados_meta_ads JSONB DEFAULT '{}'::jsonb,
  achados_google_ads JSONB DEFAULT '{}'::jsonb,
  achados_posicao_google JSONB DEFAULT '{}'::jsonb,
  achados_pagespeed JSONB DEFAULT '{}'::jsonb,
  achados_contexto_negocio JSONB DEFAULT '{}'::jsonb,
  achados_outros JSONB DEFAULT '{}'::jsonb,
  -- Output IA
  oportunidades JSONB DEFAULT '[]'::jsonb,
  resumo_executivo TEXT,
  -- Auditoria
  custo_total NUMERIC DEFAULT 0,
  tempo_analise_ms INTEGER,
  fontes_consultadas TEXT[] DEFAULT ARRAY[]::text[],
  fontes_falhadas TEXT[] DEFAULT ARRAY[]::text[],
  fontes_pendentes TEXT[] DEFAULT ARRAY[]::text[],
  status TEXT DEFAULT 'pending',
  erro TEXT,
  pdf_url TEXT,
  pdf_imagens_urls TEXT[] DEFAULT ARRAY[]::text[],
  created_by_user_id UUID,
  created_by_member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
  audience TEXT DEFAULT 'admin' CHECK (audience IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pd_lead ON public.prospeccao_diagnosticos (lead_descoberto_id);
CREATE INDEX IF NOT EXISTS idx_pd_busca ON public.prospeccao_diagnosticos (busca_id);
CREATE INDEX IF NOT EXISTS idx_pd_status ON public.prospeccao_diagnosticos (status);
CREATE INDEX IF NOT EXISTS idx_pd_user ON public.prospeccao_diagnosticos (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pd_member ON public.prospeccao_diagnosticos (created_by_member_id, created_at DESC);

-- ============================================================
-- 4. prospeccao_templates_nicho — config de fontes/pesos por nicho
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_templates_nicho (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nicho TEXT NOT NULL UNIQUE,
  emoji TEXT DEFAULT '🎯',
  display_name TEXT NOT NULL,
  descricao TEXT,
  fontes_obrigatorias TEXT[] DEFAULT ARRAY[]::text[],
  fontes_opcionais TEXT[] DEFAULT ARRAY[]::text[],
  pesos_score JSONB DEFAULT '{}'::jsonb,
  prompt_oportunidades TEXT,
  custo_estimado_lead NUMERIC DEFAULT 0.13,
  is_default BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ptn_nicho ON public.prospeccao_templates_nicho (nicho);
CREATE INDEX IF NOT EXISTS idx_ptn_active ON public.prospeccao_templates_nicho (is_active) WHERE is_active = true;

-- ============================================================
-- 5. prospeccao_prompts_config — prompts da IA editáveis pela UI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_prompts_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  descricao TEXT,
  prompt_text TEXT NOT NULL,
  variables_help JSONB DEFAULT '{}'::jsonb,
  ai_model TEXT DEFAULT 'gemini-2.5-flash',
  temperature NUMERIC DEFAULT 0.4,
  tom_voz TEXT DEFAULT 'neutro',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ppc_key ON public.prospeccao_prompts_config (key);
CREATE INDEX IF NOT EXISTS idx_ppc_active ON public.prospeccao_prompts_config (is_active) WHERE is_active = true;

-- ============================================================
-- 6. prospeccao_uso_api — auditoria de chamadas externas + custo
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_uso_api (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider TEXT NOT NULL,
  endpoint TEXT,
  fonte TEXT,
  custo NUMERIC DEFAULT 0,
  sucesso BOOLEAN DEFAULT true,
  duracao_ms INTEGER,
  busca_id UUID REFERENCES public.prospeccao_buscas(id) ON DELETE SET NULL,
  lead_descoberto_id UUID REFERENCES public.prospeccao_leads_descobertos(id) ON DELETE SET NULL,
  erro TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id UUID,
  created_by_member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  audience TEXT DEFAULT 'admin' CHECK (audience IN ('admin','member')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pua_provider ON public.prospeccao_uso_api (api_provider);
CREATE INDEX IF NOT EXISTS idx_pua_user_month ON public.prospeccao_uso_api (created_by_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pua_member_month ON public.prospeccao_uso_api (created_by_member_id, created_at DESC);

-- ============================================================
-- 7. prospeccao_member_leads — leads pessoais do membro Método Squaad
-- ============================================================
-- Tipo "Meus Leads" do membro: lista simples sem pipeline/kanban.
-- O "Virar Lead" do membro insere aqui (em vez de crm_leads).
-- Schema espelha campos práticos do crm_leads mas sem board/column.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_member_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  -- Dados do lead
  nome TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT,
  instagram TEXT,
  site TEXT,
  cidade TEXT,
  uf TEXT,
  categoria TEXT,
  -- Status simples (sem kanban)
  status TEXT NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo','em_contato','reuniao_marcada','negociacao','convertido','descartado','sem_resposta')),
  -- Origem (rastreabilidade pro diagnóstico)
  prospeccao_lead_descoberto_id UUID REFERENCES public.prospeccao_leads_descobertos(id) ON DELETE SET NULL,
  prospeccao_diagnostico_id UUID REFERENCES public.prospeccao_diagnosticos(id) ON DELETE SET NULL,
  origem TEXT DEFAULT 'prospeccao',
  -- Notas e tags
  notes TEXT,
  tags TEXT[] DEFAULT ARRAY[]::text[],
  -- Mensagens enviadas
  dm_enviada BOOLEAN DEFAULT false,
  dm_texto TEXT,
  dm_canal TEXT, -- whatsapp | instagram | email
  dm_enviada_em TIMESTAMPTZ,
  -- Valor potencial
  valor_proposta NUMERIC,
  data_fechamento TIMESTAMPTZ,
  motivo_perda TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pml_member ON public.prospeccao_member_leads (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pml_status ON public.prospeccao_member_leads (member_id, status);
CREATE INDEX IF NOT EXISTS idx_pml_origem ON public.prospeccao_member_leads (prospeccao_lead_descoberto_id) WHERE prospeccao_lead_descoberto_id IS NOT NULL;

-- ============================================================
-- 8. prospeccao_member_quotas — cota de uso (90 dias grátis + 50/mês)
-- ============================================================
-- Trial: 90 dias após primeira ativação. Pós-trial: requer is_paid=true.
-- monthly_limit = 50 análises completas por mês.
-- analises_used_this_month reseta no dia 1 de cada mês via job ou
-- na primeira chamada do mês (verificação no edge function).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.prospeccao_member_quotas (
  member_id UUID PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  -- Trial (90 dias grátis)
  trial_started_at TIMESTAMPTZ DEFAULT now(),
  trial_expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
  -- Cota mensal
  monthly_limit INTEGER DEFAULT 50,
  current_period_start DATE DEFAULT date_trunc('month', now())::date,
  analises_used_this_month INTEGER DEFAULT 0,
  buscas_used_this_month INTEGER DEFAULT 0,
  -- Lifetime
  total_analises_lifetime INTEGER DEFAULT 0,
  total_buscas_lifetime INTEGER DEFAULT 0,
  total_custo_lifetime NUMERIC DEFAULT 0,
  -- Plano pago (pós-trial)
  is_paid BOOLEAN DEFAULT false,
  plan_name TEXT DEFAULT 'trial_90d',
  paid_until TIMESTAMPTZ,
  -- Auditoria
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Function: garante quota row + reseta contador mensal se virou o mês
CREATE OR REPLACE FUNCTION public.prospeccao_ensure_member_quota(p_member_id UUID)
RETURNS public.prospeccao_member_quotas AS $$
DECLARE
  v_quota public.prospeccao_member_quotas;
  v_now_period DATE := date_trunc('month', now())::date;
BEGIN
  -- Insert se não existe
  INSERT INTO public.prospeccao_member_quotas (member_id)
  VALUES (p_member_id)
  ON CONFLICT (member_id) DO NOTHING;

  -- Lê
  SELECT * INTO v_quota FROM public.prospeccao_member_quotas WHERE member_id = p_member_id;

  -- Reseta contador se virou o mês
  IF v_quota.current_period_start < v_now_period THEN
    UPDATE public.prospeccao_member_quotas
    SET current_period_start = v_now_period,
        analises_used_this_month = 0,
        buscas_used_this_month = 0,
        updated_at = now()
    WHERE member_id = p_member_id
    RETURNING * INTO v_quota;
  END IF;

  RETURN v_quota;
END;
$$ LANGUAGE plpgsql;

-- Function: incrementa contador (usado pelas edge functions)
CREATE OR REPLACE FUNCTION public.prospeccao_increment_member_usage(
  p_member_id UUID,
  p_tipo TEXT,           -- 'busca' | 'analise'
  p_custo NUMERIC DEFAULT 0
)
RETURNS public.prospeccao_member_quotas AS $$
DECLARE
  v_quota public.prospeccao_member_quotas;
BEGIN
  v_quota := public.prospeccao_ensure_member_quota(p_member_id);

  IF p_tipo = 'analise' THEN
    UPDATE public.prospeccao_member_quotas
    SET analises_used_this_month = analises_used_this_month + 1,
        total_analises_lifetime = total_analises_lifetime + 1,
        total_custo_lifetime = total_custo_lifetime + COALESCE(p_custo, 0),
        last_used_at = now(),
        updated_at = now()
    WHERE member_id = p_member_id
    RETURNING * INTO v_quota;
  ELSIF p_tipo = 'busca' THEN
    UPDATE public.prospeccao_member_quotas
    SET buscas_used_this_month = buscas_used_this_month + 1,
        total_buscas_lifetime = total_buscas_lifetime + 1,
        total_custo_lifetime = total_custo_lifetime + COALESCE(p_custo, 0),
        last_used_at = now(),
        updated_at = now()
    WHERE member_id = p_member_id
    RETURNING * INTO v_quota;
  END IF;

  RETURN v_quota;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.prospeccao_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pld_updated_at BEFORE UPDATE ON public.prospeccao_leads_descobertos
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();
CREATE TRIGGER trg_pd_updated_at BEFORE UPDATE ON public.prospeccao_diagnosticos
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();
CREATE TRIGGER trg_ptn_updated_at BEFORE UPDATE ON public.prospeccao_templates_nicho
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();
CREATE TRIGGER trg_ppc_updated_at BEFORE UPDATE ON public.prospeccao_prompts_config
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();
CREATE TRIGGER trg_pml_updated_at BEFORE UPDATE ON public.prospeccao_member_leads
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();
CREATE TRIGGER trg_pmq_updated_at BEFORE UPDATE ON public.prospeccao_member_quotas
  FOR EACH ROW EXECUTE FUNCTION public.prospeccao_set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Padrão do CRM SQUAAD: RLS permissive (ENABLE + policy aberta)
-- pois auth de membros não usa Supabase Auth (filtra no app/edge).
-- ============================================================
ALTER TABLE public.prospeccao_buscas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_leads_descobertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_templates_nicho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_prompts_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_uso_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_member_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospeccao_member_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY pb_all ON public.prospeccao_buscas
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pld_all ON public.prospeccao_leads_descobertos
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pd_all ON public.prospeccao_diagnosticos
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY ptn_all ON public.prospeccao_templates_nicho
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY ppc_all ON public.prospeccao_prompts_config
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pua_all ON public.prospeccao_uso_api
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pml_all ON public.prospeccao_member_leads
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY pmq_all ON public.prospeccao_member_quotas
  FOR ALL USING (true) WITH CHECK (true);
