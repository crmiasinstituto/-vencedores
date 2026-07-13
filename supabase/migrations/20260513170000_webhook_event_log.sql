-- ===========================================================
-- webhook_event_log: registra eventos NÃO-venda (carrinho abandonado,
-- PIX expirado, refund) do Kirvano e outros providers.
-- Mantém sales_events 100% reservado pra vendas confirmadas, evitando
-- que o sino do dashboard toque na hora errada.
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.webhook_event_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,                -- 'kirvano', 'hotmart', etc.
  event_type TEXT NOT NULL,              -- 'ABANDONED_CART', 'PIX_EXPIRED', etc.
  dedupe_key TEXT,                       -- mesma chave usada em sales_events.dedupe_key
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  product_name TEXT,
  amount NUMERIC DEFAULT 0,
  crm_lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  crm_board_id UUID REFERENCES public.crm_boards(id) ON DELETE SET NULL,
  raw_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_log_dedupe
  ON public.webhook_event_log(provider, dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_event_log_phone
  ON public.webhook_event_log(customer_phone, created_at DESC);

ALTER TABLE public.webhook_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read webhook_event_log" ON public.webhook_event_log;
CREATE POLICY "Allow read webhook_event_log" ON public.webhook_event_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert webhook_event_log" ON public.webhook_event_log;
CREATE POLICY "Allow insert webhook_event_log" ON public.webhook_event_log FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.webhook_event_log IS
  'Log de eventos de webhooks NAO-venda (carrinho abandonado, PIX expirado, refund). Vendas confirmadas vão pra sales_events. Separação evita que dashboards toquem o sino pra eventos não-venda.';
