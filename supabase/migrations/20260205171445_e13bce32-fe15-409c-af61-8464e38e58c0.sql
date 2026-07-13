-- Tabela para registrar vendas recebidas via webhook
CREATE TABLE public.sales_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Dados do comprador
  name TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT NOT NULL,
  instagram TEXT,
  instagram_profile_pic_url TEXT,
  
  -- Dados da venda
  product_name TEXT NOT NULL,
  product_slug TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  payment_method TEXT,
  transaction_id TEXT,
  
  -- Referencia ao CRM
  crm_lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  crm_board_id UUID REFERENCES public.crm_boards(id) ON DELETE SET NULL,
  
  -- Status de celebracao
  is_celebrated BOOLEAN DEFAULT false,
  celebrated_at TIMESTAMPTZ,
  
  -- Metadados
  source TEXT DEFAULT 'iautomatize',
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscar vendas recentes
CREATE INDEX idx_sales_events_created_at ON public.sales_events(created_at DESC);
CREATE INDEX idx_sales_events_whatsapp ON public.sales_events(whatsapp);

-- Habilitar RLS
ALTER TABLE public.sales_events ENABLE ROW LEVEL SECURITY;

-- Politica publica para leitura (admin dashboard)
CREATE POLICY "Allow public read access to sales_events"
ON public.sales_events
FOR SELECT
USING (true);

-- Politica para insert via service role
CREATE POLICY "Allow service role insert"
ON public.sales_events
FOR INSERT
WITH CHECK (true);

-- Habilitar Realtime para atualizacoes em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_events;