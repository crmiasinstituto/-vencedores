
-- Add webhook tracking to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS webhook_sent boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS webhook_sent_at timestamptz;

-- Allow update on leads (needed for webhook_sent marking)
CREATE POLICY "Allow public update leads" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Allow public delete leads" ON public.leads FOR DELETE USING (true);

-- Create webhook_configs table
CREATE TABLE public.webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug text UNIQUE NOT NULL,
  page_name text NOT NULL,
  webhook_url text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read webhook_configs" ON public.webhook_configs FOR SELECT USING (true);
CREATE POLICY "Allow public insert webhook_configs" ON public.webhook_configs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update webhook_configs" ON public.webhook_configs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete webhook_configs" ON public.webhook_configs FOR DELETE USING (true);

-- Pre-populate webhook configs
INSERT INTO public.webhook_configs (page_slug, page_name, webhook_url, description) VALUES
  ('landing_page', 'Landing Page (/)', 'https://app.iautomatize.me/api/iwh/8e10a4bf47804b27165478884c3afafe', 'Webhook do popup de captura de leads da landing page principal'),
  ('vhs_ao_prompt', 'VHS ao Prompt (/vhs-ao-prompt)', 'https://app.iautomatize.me/api/iwh/6ff052c3314a213cf531a78fe629d7d8', 'Webhook do popup de captura de leads do evento VHS ao Prompt'),
  ('sales_webhook', 'Webhook de Vendas', 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/receive-sale-webhook', 'Endpoint que recebe notificações de vendas externas'),
  ('whatsapp_receiver', 'WhatsApp Webhook Receiver', 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/uazapi-webhook-receiver', 'Endpoint que recebe webhooks do UaZapi (mensagens WhatsApp)');
