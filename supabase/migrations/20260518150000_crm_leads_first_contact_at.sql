-- ===========================================================
-- first_contact_at — rastreamento ponta a ponta do lead
-- O CRM mostrava "TEMPO NA BASE" baseado no created_at do lead atual,
-- mas a mesma pessoa pode estar em vários boards (mentoria, masterclass,
-- reprograme-se-10x). Esse campo guarda o PRIMEIRO contato real, agregando:
--   - crm_leads (todos os boards) por whatsapp/email
--   - leads (popup_ddd, masterclass_ia, vhs_ao_prompt)
--   - community_members
--   - vhs_participants
-- ===========================================================

-- 1) Coluna
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_crm_leads_first_contact_at
  ON public.crm_leads(first_contact_at);

-- 2) Função que calcula o primeiro contato pra um (whatsapp, email)
CREATE OR REPLACE FUNCTION public.compute_first_contact_at(
  p_whatsapp text,
  p_email text DEFAULT NULL,
  p_fallback timestamptz DEFAULT now()
) RETURNS timestamptz
LANGUAGE sql STABLE
AS $$
  SELECT LEAST(
    p_fallback,
    COALESCE((SELECT MIN(created_at) FROM crm_leads
              WHERE whatsapp = p_whatsapp OR (p_email IS NOT NULL AND email = p_email)),
             p_fallback),
    COALESCE((SELECT MIN(created_at) FROM leads
              WHERE whatsapp = p_whatsapp), p_fallback),
    COALESCE((SELECT MIN(created_at) FROM community_members
              WHERE whatsapp = p_whatsapp), p_fallback),
    COALESCE((SELECT MIN(created_at) FROM vhs_participants
              WHERE whatsapp = p_whatsapp OR (p_email IS NOT NULL AND email = p_email)),
             p_fallback)
  );
$$;

COMMENT ON FUNCTION public.compute_first_contact_at IS
  'Retorna o timestamp do primeiro contato de uma pessoa no sistema, agregando crm_leads (todos boards), leads, community_members e vhs_participants por whatsapp ou email.';

-- 3) Trigger: ao inserir/atualizar lead, recalcula first_contact_at
CREATE OR REPLACE FUNCTION public.crm_leads_set_first_contact_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só recalcula se ainda não tem OU se whatsapp/email mudaram
  IF NEW.first_contact_at IS NULL
     OR TG_OP = 'INSERT'
     OR (TG_OP = 'UPDATE' AND (
           NEW.whatsapp IS DISTINCT FROM OLD.whatsapp OR
           NEW.email    IS DISTINCT FROM OLD.email))
  THEN
    NEW.first_contact_at := public.compute_first_contact_at(
      NEW.whatsapp,
      NEW.email,
      COALESCE(NEW.created_at, now())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crm_leads_set_first_contact_at_trigger ON public.crm_leads;
CREATE TRIGGER crm_leads_set_first_contact_at_trigger
  BEFORE INSERT OR UPDATE OF whatsapp, email ON public.crm_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_leads_set_first_contact_at();

-- 4) Backfill da coluna para todos os leads existentes
UPDATE public.crm_leads cl
SET first_contact_at = public.compute_first_contact_at(cl.whatsapp, cl.email, cl.created_at);
