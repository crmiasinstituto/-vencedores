-- Tabela de prospects para prospecção digital automatizada
CREATE TABLE IF NOT EXISTS public.prospects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa text NOT NULL,
  nicho text NOT NULL,
  cidade text NOT NULL,
  telefone text,
  site text,
  instagram text,
  google_rating numeric(2,1),
  google_reviews integer,
  endereco text,
  horario_funcionamento text,

  -- Status do prospect no funil
  status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'analisando', 'analisado', 'abordado', 'respondeu', 'convertido', 'descartado')),

  -- Notas do diagnóstico digital (escala 0-10)
  nota_site_seo numeric(3,1),
  nota_site_conversao numeric(3,1),
  nota_google_meu_negocio numeric(3,1),
  nota_instagram_posicionamento numeric(3,1),
  nota_instagram_engajamento numeric(3,1),
  nota_geral numeric(3,1),

  -- Dados detalhados da análise (JSON)
  analise_site jsonb DEFAULT '{}'::jsonb,
  analise_instagram jsonb DEFAULT '{}'::jsonb,
  analise_gmb jsonb DEFAULT '{}'::jsonb,
  plano_acao jsonb DEFAULT '{}'::jsonb,
  impacto jsonb DEFAULT '[]'::jsonb,

  -- Abordagem via DM
  dm_enviada boolean DEFAULT false,
  dm_respondida boolean DEFAULT false,
  dm_texto text,
  dm_data timestamptz,

  -- Conversão para CRM
  convertido_lead boolean DEFAULT false,
  crm_lead_id uuid REFERENCES public.crm_leads(id),

  -- Dados do diagnóstico PDF
  pdf_path text,
  pdf_data jsonb,

  -- Observações livres
  observacoes text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospects_cidade ON public.prospects(cidade);
CREATE INDEX idx_prospects_nicho ON public.prospects(nicho);
CREATE INDEX idx_prospects_nota_geral ON public.prospects(nota_geral DESC NULLS LAST);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON public.prospects
  FOR EACH ROW
  EXECUTE FUNCTION update_prospects_updated_at();

-- RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on prospects"
  ON public.prospects
  FOR ALL
  USING (true)
  WITH CHECK (true);
