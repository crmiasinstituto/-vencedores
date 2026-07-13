-- Token publico para o link de assinatura do contrato, enviado no ato da compra
-- (rota publica /assinar/:token, sem exigir login do aluno).
ALTER TABLE public.member_contracts
  ADD COLUMN IF NOT EXISTS sign_token uuid DEFAULT gen_random_uuid();

UPDATE public.member_contracts SET sign_token = gen_random_uuid() WHERE sign_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_contracts_sign_token
  ON public.member_contracts(sign_token);
