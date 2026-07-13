
-- Tabela para gerenciar instâncias UAZAPI
CREATE TABLE public.whatsapp_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name text NOT NULL,
  instance_token text,
  subdomain text NOT NULL DEFAULT 'squaad',
  admin_token text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  qr_code text,
  phone_number text,
  webhook_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read whatsapp_instances" ON public.whatsapp_instances FOR SELECT USING (true);
CREATE POLICY "Allow public insert whatsapp_instances" ON public.whatsapp_instances FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update whatsapp_instances" ON public.whatsapp_instances FOR UPDATE USING (true);
CREATE POLICY "Allow public delete whatsapp_instances" ON public.whatsapp_instances FOR DELETE USING (true);

-- Tabela de mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  board_id uuid REFERENCES public.crm_boards(id) ON DELETE SET NULL,
  remote_phone text NOT NULL,
  direction text NOT NULL DEFAULT 'outbound',
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  whatsapp_message_id text,
  status text NOT NULL DEFAULT 'sent',
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (true);
CREATE POLICY "Allow public delete whatsapp_messages" ON public.whatsapp_messages FOR DELETE USING (true);

-- Habilitar Realtime para mensagens
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;

-- Index para buscas por lead e telefone
CREATE INDEX idx_whatsapp_messages_lead_id ON public.whatsapp_messages(lead_id);
CREATE INDEX idx_whatsapp_messages_remote_phone ON public.whatsapp_messages(remote_phone);
CREATE INDEX idx_whatsapp_messages_instance_id ON public.whatsapp_messages(instance_id);

-- Trigger updated_at na instância
CREATE TRIGGER update_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
