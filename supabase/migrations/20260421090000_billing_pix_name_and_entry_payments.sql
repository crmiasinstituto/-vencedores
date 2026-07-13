-- 1) PIX titular (nome) + flags de promessa no contrato
ALTER TABLE public.billing_config
  ADD COLUMN IF NOT EXISTS pix_name text;

ALTER TABLE public.member_contracts
  ADD COLUMN IF NOT EXISTS is_promise boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS promise_date date,
  ADD COLUMN IF NOT EXISTS promise_reminder_sent boolean DEFAULT false;

-- 2) Seed/atualiza chave PIX padrao (V K EDUCACAO E SAUDE LTDA)
UPDATE public.billing_config
   SET pix_key = '51994592000130',
       pix_name = 'V K EDUCACAO E SAUDE LTDA',
       is_active = true,
       updated_at = now()
 WHERE gateway = 'manual';

-- 3) Backfill: cria parcela #0 (entrada) para contratos que tem entry_value > 0
--    mas ainda nao tem linha correspondente em member_payments.
INSERT INTO public.member_payments (
  contract_id, member_id, installment_number, value, due_date,
  status, payment_method, paid_at, paid_value, notes
)
SELECT
  c.id,
  c.member_id,
  0,
  c.entry_value,
  COALESCE(c.promise_date, c.created_at::date),
  CASE WHEN c.entry_paid THEN 'paid' ELSE 'pending' END,
  c.entry_method,
  CASE WHEN c.entry_paid THEN COALESCE(c.entry_paid_at, c.created_at) ELSE NULL END,
  CASE WHEN c.entry_paid THEN c.entry_value ELSE NULL END,
  CASE WHEN c.is_promise THEN 'Entrada - promessa de pagamento' ELSE 'Entrada' END
FROM public.member_contracts c
WHERE c.entry_value > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.member_payments p
     WHERE p.contract_id = c.id AND p.installment_number = 0
  );

CREATE INDEX IF NOT EXISTS idx_member_contracts_promise
  ON public.member_contracts(is_promise, promise_date)
  WHERE is_promise = true;

-- 4) Agenda a regua de cobranca: todo dia as 10:00 BRT (13:00 UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('billing-reminders-daily')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'billing-reminders-daily');

    PERFORM cron.schedule(
      'billing-reminders-daily',
      '0 13 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ngvyhgezacslechaugts.supabase.co/functions/v1/billing-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        )
      );
      $cron$
    );
  END IF;
END $$;
