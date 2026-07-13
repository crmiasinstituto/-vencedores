-- Criar tabela leads para capturar dados dos usuários
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  instagram TEXT,
  ddd TEXT,
  estado TEXT,
  cidade TEXT,
  region TEXT,
  emoji TEXT,
  cor TEXT,
  mensagem TEXT,
  source TEXT DEFAULT 'popup_ddd',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Permitir que qualquer pessoa insira leads (público)
CREATE POLICY "Permitir inserção pública de leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Permitir que qualquer pessoa leia leads (para analytics - opcional)
CREATE POLICY "Permitir leitura pública de leads" 
ON public.leads 
FOR SELECT 
USING (true);

-- Criar índices para performance
CREATE INDEX idx_leads_ddd ON public.leads(ddd);
CREATE INDEX idx_leads_estado ON public.leads(estado);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);
CREATE INDEX idx_leads_source ON public.leads(source);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();