-- ============================================================
-- Onboarding Método SQUAAD: cancelamento + idempotência de lembrete
-- ============================================================
-- Bug atual: o cron billing-reminders envia mensagem de lembrete
-- todo dia pra enrollments status='pending' com >2d (não marca como
-- enviado). Resultado: spam no WhatsApp do lead.
--
-- Fix:
--  1. coluna reminder_sent_at — controla idempotência
--  2. status 'cancelled' — admin pode cancelar manualmente, cron ignora
--  3. coluna cancelled_at + cancelled_reason — auditoria
-- ============================================================

ALTER TABLE public.metodo_squaad_enrollments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Index pra otimizar query do cron (status=pending com lembrete não enviado)
CREATE INDEX IF NOT EXISTS idx_metodo_squaad_enrollments_pending_reminder
  ON public.metodo_squaad_enrollments (status, reminder_sent_at)
  WHERE status = 'pending';
