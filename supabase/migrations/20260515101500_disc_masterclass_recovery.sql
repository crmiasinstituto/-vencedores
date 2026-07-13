-- ===========================================
-- DISC → MASTERCLASS RECOVERY (schema only)
-- O cron job é configurado fora desta migration (via Management API)
-- pra evitar deixar a service_role_key/recovery_secret no repositório.
-- Ver: setup do edge function `disc-recovery-cron`.
-- ===========================================

-- Coluna idempotente de controle
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS masterclass_recovery_sent_at TIMESTAMPTZ;

-- Índice parcial pro cron achar candidatos rapidamente
CREATE INDEX IF NOT EXISTS idx_crm_leads_disc_recovery_pending
  ON public.crm_leads (created_at)
  WHERE evento = 'reprograme-se-10x'
    AND whatsapp IS NOT NULL
    AND masterclass_recovery_sent_at IS NULL;
