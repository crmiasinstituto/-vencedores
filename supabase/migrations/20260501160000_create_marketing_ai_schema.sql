-- Marketing IA - Agente completo de marketing digital
-- Importa o skill agente-marketing como nucleo: maestro + 4 especialistas (copy, criativo, midia, web)
-- Cada tabela suporta o fluxo: briefing do negocio -> iniciativa -> chat com IA -> outputs gerados

-- ============================================================
-- 1) BRIEFING DO NEGOCIO (config persistente, lido em toda sessao)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_briefing (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Negocio
  empresa text NOT NULL,
  tipo_negocio text,                          -- ecommerce | servico | saas | infoproduto | varejo | b2b | outro
  produto_servico text,
  ticket_medio numeric,
  responsavel text,

  -- Objetivo padrao
  objetivo_default text,
  budget_mensal numeric,

  -- Publico
  publico_perfil text,
  dores jsonb DEFAULT '[]'::jsonb,
  desejos jsonb DEFAULT '[]'::jsonb,
  canais jsonb DEFAULT '[]'::jsonb,

  -- Tom
  formalidade text,                           -- formal | informal | super_informal
  palavras_banidas jsonb DEFAULT '[]'::jsonb,
  palavras_caracteristicas jsonb DEFAULT '[]'::jsonb,
  identidade_visual jsonb DEFAULT '{}'::jsonb,
  -- ex: {paleta_primaria: '#FAC800', paleta_fundo: '#050505', tipografia: 'Inter'}

  -- Aprendizados acumulados (atualizado pelo agente)
  aprendizados jsonb DEFAULT '[]'::jsonb,

  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2) INICIATIVAS (campanhas, lancamentos, promocoes, remarketing)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_initiatives (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  briefing_id uuid REFERENCES public.marketing_briefing(id) ON DELETE CASCADE,

  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'campanha_continua',
  -- campanha_continua | lancamento | promocao | remarketing | branding | b2b_leads
  fase text DEFAULT 'estrategia',
  -- estrategia | captacao | aquecimento | conversao | pos

  objetivo text,
  produto text,
  ticket numeric,
  budget numeric,
  data_inicio date,
  data_evento date,
  data_fim date,

  publico_alvo jsonb DEFAULT '{}'::jsonb,
  -- {temperatura: 'frio'|'morno'|'quente', perfil, nivel_consciencia: 1-5}

  mecanismo text,
  promessa_principal text,
  cpl_max numeric,
  cpa_max numeric,

  status text DEFAULT 'ativo',
  -- ativo | pausado | concluido | rascunho

  resultado jsonb DEFAULT '{}'::jsonb,
  -- {leads, cpl, vendas, faturamento, roas, melhor_criativo}

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

  titulo text,                                 -- gerado a partir da 1a mensagem
  resumo text,                                 -- atualizado pela IA conforme conversa
  status text DEFAULT 'ativo',                 -- ativo | arquivado

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 4) MENSAGENS DA SESSAO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.marketing_ai_sessions(id) ON DELETE CASCADE,

  role text NOT NULL,                          -- user | assistant | system
  content text NOT NULL,
  agent text,                                   -- maestro | copy | criativo | midia | web

  metadata jsonb DEFAULT '{}'::jsonb,
  -- pode guardar: tool_calls usadas, output_id gerado, etc

  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5) OUTPUTS GERADOS PELOS SUB-AGENTES (copy, criativo, midia, web)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.marketing_ai_outputs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES public.marketing_ai_sessions(id) ON DELETE SET NULL,
  initiative_id uuid REFERENCES public.marketing_initiatives(id) ON DELETE SET NULL,

  agent text NOT NULL,                         -- copy | criativo | midia | web
  tipo text NOT NULL,
  -- copy: ad_meta | criativo_copy | email | vsl | lp | whatsapp
  -- criativo: brief_imagem | identidade_evento | direcao_campanha
  -- midia: estrutura_campanha | analise_3periodos | relatorio_4h | recomendacao
  -- web: lp_estrutura | quiz_config | sales_page | brief_tecnico

  titulo text,
  briefing jsonb DEFAULT '{}'::jsonb,           -- input usado
  resultado jsonb DEFAULT '{}'::jsonb,          -- output completo estruturado
  raw_text text,                                -- versao texto/markdown amigavel

  status text DEFAULT 'gerado',                 -- gerado | aprovado | rejeitado | arquivado | usado_em_producao

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
-- RLS - mesmo padrao das outras tabelas de marketing (acesso aberto)
-- ============================================================
ALTER TABLE public.marketing_briefing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_ai_outputs ENABLE ROW LEVEL SECURITY;

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
-- SEED: briefing default da SQUAAD (extraido do skill agente-marketing)
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
