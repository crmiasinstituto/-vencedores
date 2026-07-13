-- ===========================================
-- DISC PDF QUEUE — entrega de diagnóstico via WhatsApp
-- Fila com throttle global pra evitar block do número
-- ===========================================

CREATE TABLE IF NOT EXISTS public.disc_pdf_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | sent | failed
  message_variant INTEGER DEFAULT 0,      -- índice da variação usada (anti-spam)
  attempts INTEGER DEFAULT 0,
  error_msg TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disc_pdf_requests_lead
  ON public.disc_pdf_requests (lead_id);

CREATE INDEX IF NOT EXISTS idx_disc_pdf_requests_status_ts
  ON public.disc_pdf_requests (status, sent_at DESC);

ALTER TABLE public.disc_pdf_requests ENABLE ROW LEVEL SECURITY;

-- Apenas service role (edge functions) lê/escreve.
-- Frontend insere via edge function, não direto.
DROP POLICY IF EXISTS "disc_pdf_requests_service_only" ON public.disc_pdf_requests;
CREATE POLICY "disc_pdf_requests_service_only"
  ON public.disc_pdf_requests FOR ALL
  USING (false) WITH CHECK (false);
