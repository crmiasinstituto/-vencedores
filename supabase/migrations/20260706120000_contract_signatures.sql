-- ============================================================================
-- Contrato de Prestacao de Servicos (Mentoria / Metodo Squaad)
-- Assinatura eletronica nativa (Lei 14.063/2020 + MP 2.200-2/2001).
--
-- 1) Dados pessoais do aluno em `members` (Anexo I do contrato). O aluno
--    preenche o que faltar dentro da area de membros antes de assinar.
-- 2) Estado legal/assinatura pendurado na linha `member_contracts` que ja
--    existe (1 por venda, criada em activate-lead-as-member).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Dados pessoais em members (Anexo I)
-- ---------------------------------------------------------------------------
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS nationality          text,
  ADD COLUMN IF NOT EXISTS marital_status       text,
  ADD COLUMN IF NOT EXISTS profession           text,
  ADD COLUMN IF NOT EXISTS birth_date           date,
  ADD COLUMN IF NOT EXISTS rg                   text,
  ADD COLUMN IF NOT EXISTS address_cep          text,
  ADD COLUMN IF NOT EXISTS address_street       text,
  ADD COLUMN IF NOT EXISTS address_number       text,
  ADD COLUMN IF NOT EXISTS address_complement   text,
  ADD COLUMN IF NOT EXISTS address_neighborhood text,
  ADD COLUMN IF NOT EXISTS address_city         text,
  ADD COLUMN IF NOT EXISTS address_state        text;

-- ---------------------------------------------------------------------------
-- 2) Estado da assinatura legal em member_contracts
-- ---------------------------------------------------------------------------
ALTER TABLE public.member_contracts
  -- Parametros do contrato (derivados do produto/programa)
  ADD COLUMN IF NOT EXISTS product_label       text,          -- "MentorIA" | "Metodo Squaad"
  ADD COLUMN IF NOT EXISTS modality_label      text,          -- "Mentoria 3 Meses" | "Mentoria 12 Meses"
  ADD COLUMN IF NOT EXISTS vigencia_months     integer,       -- 3 | 12
  ADD COLUMN IF NOT EXISTS access_starts_on    date,
  ADD COLUMN IF NOT EXISTS access_ends_on      date,
  ADD COLUMN IF NOT EXISTS template_version    text DEFAULT 'v1',

  -- Fluxo de assinatura
  ADD COLUMN IF NOT EXISTS signature_required  boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS signature_status    text DEFAULT 'pending_data',
    -- pending_data  -> faltam dados pessoais do aluno
    -- ready_to_sign -> dados completos, aguardando aceite
    -- signed        -> assinado, acesso liberado

  -- Registro de aceite eletronico (prova juridica - Clausula 19)
  ADD COLUMN IF NOT EXISTS signed_at            timestamptz,
  ADD COLUMN IF NOT EXISTS signature_ip         text,
  ADD COLUMN IF NOT EXISTS signature_user_agent text,
  ADD COLUMN IF NOT EXISTS signature_name_typed text,
  ADD COLUMN IF NOT EXISTS signature_drawing_url text,        -- canvas opcional
  ADD COLUMN IF NOT EXISTS signer_snapshot      jsonb,        -- Anexo I congelado no aceite
  ADD COLUMN IF NOT EXISTS pdf_url              text,         -- PDF assinado (B2)
  ADD COLUMN IF NOT EXISTS pdf_hash             text,         -- integridade (SHA-256)

  -- Envio da copia assinada
  ADD COLUMN IF NOT EXISTS copy_sent_at         timestamptz,
  ADD COLUMN IF NOT EXISTS copy_sent_channels   text[];

-- Backfill: contratos antigos (ja ativos antes da feature) nao devem travar
-- o acesso de quem ja e aluno. So exigimos assinatura de contratos novos.
UPDATE public.member_contracts
   SET signature_required = false
 WHERE signature_status IS NULL
   AND created_at < '2026-07-06'::date;

UPDATE public.member_contracts
   SET signature_status = 'signed'
 WHERE signature_status = 'pending_data'
   AND created_at < '2026-07-06'::date;

CREATE INDEX IF NOT EXISTS idx_member_contracts_signature
  ON public.member_contracts(member_id, signature_status);
