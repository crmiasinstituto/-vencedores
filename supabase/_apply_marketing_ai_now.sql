-- ═══════════════════════════════════════════════════════════════════════════
-- APLICAR NO SQL EDITOR DO SUPABASE
-- https://supabase.com/dashboard/project/iymlwsawrmghhbawiavz/sql/new
-- ═══════════════════════════════════════════════════════════════════════════
-- Conteúdo consolidado de:
--   • 20260501160000_create_marketing_ai_schema.sql
--   • 20260501170000_marketing_ai_integration_keys.sql
-- Idempotente (IF NOT EXISTS / ON CONFLICT). Pode rodar com segurança.
-- ═══════════════════════════════════════════════════════════════════════════

-- ============================================================
-- 1) BRIEFING DO NEGOCIO (config persistente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_briefing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa text NOT NULL,
  tipo_negocio text,
  produto_servico text,
  ticket_medio numeric,
  responsavel text,
  objetivo_default text,
  budget_mensal numeric,
  publico_perfil text,
  dores jsonb DEFAULT '[]'::jsonb,
  desejos jsonb DEFAULT '[]'::jsonb,
  canais jsonb DEFAULT '[]'::jsonb,
  formalidade text,
  palavras_banidas jsonb DEFAULT '[]'::jsonb,
  palavras_caracteristicas jsonb DEFAULT '[]'::jsonb,
  identidade_visual jsonb DEFAULT '{}'::jsonb,
  aprendizados jsonb DEFAULT '[]'::jsonb,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2) INICIATIVAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_initiatives (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id uuid REFERENCES public.marketing_briefing(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'campanha_continua',
  fase text DEFAULT 'estrategia',
  objetivo text,
  produto text,
  ticket numeric,
  budget numeric,
  data_inicio date,
  data_evento date,
  data_fim date,
  publico_alvo jsonb DEFAULT '{}'::jsonb,
  mecanismo text,
  promessa_principal text,
  cpl_max numeric,
  cpa_max numeric,
  status text DEFAULT 'ativo',
  resultado jsonb DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3) SESSOES DE CHAT COM O MAESTRO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  briefing_id uuid REFERENCES public.marketing_briefing(id) ON DELETE SET NULL,
  initiative_id uuid REFERENCES public.marketing_initiatives(id) ON DELETE SET NULL,
  titulo text,
  resumo text,
  status text DEFAULT 'ativo',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4) MENSAGENS DA SESSAO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.marketing_ai_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5) OUTPUTS GERADOS PELOS SUB-AGENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_outputs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.marketing_ai_sessions(id) ON DELETE SET NULL,
  initiative_id uuid REFERENCES public.marketing_initiatives(id) ON DELETE SET NULL,
  agent text NOT NULL,
  tipo text NOT NULL,
  titulo text,
  briefing jsonb DEFAULT '{}'::jsonb,
  resultado jsonb DEFAULT '{}'::jsonb,
  raw_text text,
  status text DEFAULT 'gerado',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_marketing_briefing_default ON public.marketing_briefing(is_default);
CREATE INDEX IF NOT EXISTS idx_marketing_initiatives_status ON public.marketing_initiatives(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_initiatives_briefing ON public.marketing_initiatives(briefing_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_sessions_user ON public.marketing_ai_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_sessions_initiative ON public.marketing_ai_sessions(initiative_id);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_messages_session ON public.marketing_ai_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_outputs_session ON public.marketing_ai_outputs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_outputs_initiative ON public.marketing_ai_outputs(initiative_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_ai_outputs_agent ON public.marketing_ai_outputs(agent, status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.marketing_briefing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on marketing_briefing" ON public.marketing_briefing;
DROP POLICY IF EXISTS "Allow all on marketing_initiatives" ON public.marketing_initiatives;
DROP POLICY IF EXISTS "Allow all on marketing_ai_sessions" ON public.marketing_ai_sessions;
DROP POLICY IF EXISTS "Allow all on marketing_ai_messages" ON public.marketing_ai_messages;
DROP POLICY IF EXISTS "Allow all on marketing_ai_outputs" ON public.marketing_ai_outputs;

CREATE POLICY "Allow all on marketing_briefing" ON public.marketing_briefing FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_initiatives" ON public.marketing_initiatives FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_ai_sessions" ON public.marketing_ai_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_ai_messages" ON public.marketing_ai_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_ai_outputs" ON public.marketing_ai_outputs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER updated_at compartilhado
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_marketing_ai_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_marketing_briefing_updated ON public.marketing_briefing;
CREATE TRIGGER trg_marketing_briefing_updated BEFORE UPDATE ON public.marketing_briefing
  FOR EACH ROW EXECUTE FUNCTION public.set_marketing_ai_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_initiatives_updated ON public.marketing_initiatives;
CREATE TRIGGER trg_marketing_initiatives_updated BEFORE UPDATE ON public.marketing_initiatives
  FOR EACH ROW EXECUTE FUNCTION public.set_marketing_ai_updated_at();

DROP TRIGGER IF EXISTS trg_marketing_ai_sessions_updated ON public.marketing_ai_sessions;
CREATE TRIGGER trg_marketing_ai_sessions_updated BEFORE UPDATE ON public.marketing_ai_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_marketing_ai_updated_at();

-- ============================================================
-- SEED: briefing default da SQUAAD
-- ============================================================
INSERT INTO public.marketing_briefing (
  empresa, tipo_negocio, produto_servico, ticket_medio, responsavel,
  objetivo_default,
  publico_perfil, dores, desejos, canais,
  formalidade, palavras_banidas, palavras_caracteristicas, identidade_visual,
  is_default
)
SELECT
  'SQUAAD',
  'infoproduto',
  'Metodo SQUAAD - mentoria onde o empresario aprende a construir suas proprias solucoes com IA',
  10000,
  'Carlos Eduardo',
  'captacao_continua',
  'Empresarios e empreendedores que faturam 30k+/mes, presos no operacional, querem usar IA mas nao sabem por onde comecar',
  '["Preso no operacional, nao consegue escalar", "Ve concorrentes usando IA e se sente para tras", "Medo de perder relevancia e mercado", "Trabalha demais, sobra pouco", "Ja tentou IA mas nao virou resultado real"]'::jsonb,
  '["Trabalhar menos e faturar mais", "Ter uma equipe que funciona sem ele", "Ser o empresario mais avancado do mercado", "Escalar sem contratar mais gente", "Deixar legado, nao so pagar contas"]'::jsonb,
  '["Instagram", "WhatsApp", "YouTube"]'::jsonb,
  'informal',
  '["gratis", "mindset", "jornada", "transformacao", "desbloqueie", "proposito", "webinario", "sala"]'::jsonb,
  '["BORA DESCER O BAMBU", "literalmente", "porra"]'::jsonb,
  '{"paleta_primaria": "#FAC800", "paleta_fundo": "#050505", "paleta_texto": "#ffffff", "paleta_acento": "#000000", "tipografia": "Inter", "tom_visual": "premium, direto, sem frescura corporativa"}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.marketing_briefing WHERE is_default = true);

-- ============================================================
-- INTEGRATION KEYS para Marketing IA
-- ============================================================
INSERT INTO public.integration_keys (service) VALUES
  ('gemini'),
  ('lovable_gateway')
ON CONFLICT (service) DO NOTHING;

-- ============================================================
-- VERIFICACAO FINAL (rode pra confirmar)
-- ============================================================
SELECT 'marketing_briefing' AS tabela, COUNT(*) AS rows FROM public.marketing_briefing
UNION ALL SELECT 'marketing_initiatives', COUNT(*) FROM public.marketing_initiatives
UNION ALL SELECT 'marketing_ai_sessions', COUNT(*) FROM public.marketing_ai_sessions
UNION ALL SELECT 'marketing_ai_messages', COUNT(*) FROM public.marketing_ai_messages
UNION ALL SELECT 'marketing_ai_outputs', COUNT(*) FROM public.marketing_ai_outputs;
