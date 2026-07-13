-- ===========================================
-- DISC LEAD MAGNET — Reprograme-se 10X
-- Aditivo: estende crm_leads + cria board dedicado
-- ===========================================

-- 1) Estender crm_leads com colunas DISC (todas opcionais, default seguro)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS instagram_raw JSONB,
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
  ADD COLUMN IF NOT EXISTS disc_profile TEXT,
  ADD COLUMN IF NOT EXISTS disc_scores JSONB,
  ADD COLUMN IF NOT EXISTS authorized_mural BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shared_stories BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS evento TEXT;

-- Índice para queries do mural (lê só leads autorizados, ordenados por data)
CREATE INDEX IF NOT EXISTS idx_crm_leads_mural_reprograme10x
  ON public.crm_leads (evento, authorized_mural, created_at DESC)
  WHERE evento = 'reprograme-se-10x' AND authorized_mural = TRUE;

-- 2) Board "Reprograme-se 10X"
INSERT INTO public.crm_boards (name, slug, color, icon, sort_order)
VALUES ('Reprograme-se 10X', 'reprograme-se-10x', '#FAC800', 'sparkles', 6)
ON CONFLICT (slug) DO NOTHING;

-- 3) Colunas do board
INSERT INTO public.crm_columns (board_id, name, color, sort_order, is_final_stage)
SELECT b.id, c.name, c.color, c.sort_order, c.is_final_stage
FROM public.crm_boards b
CROSS JOIN (VALUES
  ('Lead Novo',          '#6B7280', 1, FALSE),
  ('DISC Concluído',     '#3B82F6', 2, FALSE),
  ('Contato Iniciado',   '#8B5CF6', 3, FALSE),
  ('Call Agendada',      '#F59E0B', 4, FALSE),
  ('Fechado',            '#10B981', 5, TRUE),
  ('Sem Interesse',      '#EF4444', 6, TRUE)
) AS c(name, color, sort_order, is_final_stage)
WHERE b.slug = 'reprograme-se-10x'
  AND NOT EXISTS (
    SELECT 1 FROM public.crm_columns
    WHERE board_id = b.id AND name = c.name
  );

-- 4) Tabela de rate-limit (anti-abuse na rota pública)
CREATE TABLE IF NOT EXISTS public.disc_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disc_rate_limits_ip
  ON public.disc_rate_limits (ip_hash, created_at DESC);

ALTER TABLE public.disc_rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role gerencia; sem acesso público (apenas edge function lê/escreve)
DROP POLICY IF EXISTS "disc_rate_limits_service_only" ON public.disc_rate_limits;
CREATE POLICY "disc_rate_limits_service_only"
  ON public.disc_rate_limits FOR ALL
  USING (false) WITH CHECK (false);
