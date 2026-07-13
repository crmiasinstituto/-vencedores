-- Member contracts (one per sale)
CREATE TABLE IF NOT EXISTS public.member_contracts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.members(id),
  crm_lead_id uuid REFERENCES public.crm_leads(id),

  -- Sale details
  program text DEFAULT 'metodo-squaad',
  total_value numeric(12,2) NOT NULL,
  entry_value numeric(12,2) DEFAULT 0,
  entry_method text, -- pix, cartao_credito, cartao_debito, boleto, dinheiro
  entry_paid boolean DEFAULT false,
  entry_paid_at timestamptz,

  -- Installments
  num_installments integer DEFAULT 1,
  installment_value numeric(12,2),
  payment_method text, -- pix, cartao_credito, cartao_debito, boleto

  -- Status
  status text DEFAULT 'active', -- active, completed, cancelled, suspended

  -- Gateway config (pre-configured for future)
  gateway text, -- manual, stripe, asaas
  gateway_customer_id text,
  gateway_subscription_id text,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Individual installments/payments
CREATE TABLE IF NOT EXISTS public.member_payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id uuid REFERENCES public.member_contracts(id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members(id),

  installment_number integer NOT NULL,
  value numeric(12,2) NOT NULL,
  due_date date NOT NULL,

  -- Payment status
  status text DEFAULT 'pending', -- pending, paid, overdue, cancelled
  paid_at timestamptz,
  paid_value numeric(12,2),
  payment_method text,

  -- Billing reminders sent
  reminder_5d_sent boolean DEFAULT false,
  reminder_2d_sent boolean DEFAULT false,
  reminder_due_sent boolean DEFAULT false,
  reminder_3d_overdue_sent boolean DEFAULT false,
  blocked_at_5d boolean DEFAULT false,

  -- Gateway
  gateway_payment_id text,
  gateway_invoice_url text,

  notes text,
  created_at timestamptz DEFAULT now()
);

-- Billing webhook config
CREATE TABLE IF NOT EXISTS public.billing_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway text NOT NULL UNIQUE, -- stripe, asaas, manual
  api_key text,
  webhook_secret text,
  pix_key text,
  is_active boolean DEFAULT false,
  config jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Seed billing config
INSERT INTO billing_config (gateway, is_active) VALUES
  ('manual', true),
  ('stripe', false),
  ('asaas', false)
ON CONFLICT (gateway) DO NOTHING;

-- RLS
ALTER TABLE public.member_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on member_contracts" ON public.member_contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_payments" ON public.member_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on billing_config" ON public.billing_config FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_member_payments_due ON public.member_payments(due_date, status);
CREATE INDEX idx_member_payments_member ON public.member_payments(member_id);
CREATE INDEX idx_member_contracts_member ON public.member_contracts(member_id);
