-- Asaas integration: CPF storage + environment config
-- Adiciona campo CPF em members e crm_leads (necessario pra criar cliente no Asaas)
-- e prepara billing_config.config com environment sandbox/producao.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS cpf text;

ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS cpf text;

-- Asaas customer id por contrato (reusa coluna existente gateway_customer_id em member_contracts)
-- Nao precisa nova coluna: gateway_customer_id ja serve.

-- Garante row asaas em billing_config com environment=sandbox por padrao
INSERT INTO public.billing_config (gateway, is_active, config)
VALUES ('asaas', false, jsonb_build_object('environment', 'sandbox'))
ON CONFLICT (gateway) DO UPDATE
SET config = COALESCE(public.billing_config.config, '{}'::jsonb)
  || jsonb_build_object(
       'environment',
       COALESCE(public.billing_config.config->>'environment', 'sandbox')
     );

-- Index pra lookup rapido de pagamento por external reference (webhook do Asaas)
CREATE INDEX IF NOT EXISTS idx_member_payments_gateway_payment_id
  ON public.member_payments(gateway_payment_id);
