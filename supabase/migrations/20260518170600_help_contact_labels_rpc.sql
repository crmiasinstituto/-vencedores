-- ============================================================
-- get_help_contact_labels: RPC publica que devolve apenas os
-- labels personalizados dos contatos de ajuda do membro. Sem
-- expor telefone, sem expor outros services.
--
-- Usado pelo MemberHelpCard pra renderizar os nomes editados em
-- /admin/configuracoes (campo "Nome de exibicao").
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_help_contact_labels()
RETURNS TABLE(
  service        text,
  display_label  text,
  is_active      boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.service,
    NULLIF(k.metadata ->> 'display_label', '') AS display_label,
    COALESCE(k.is_active, true) AS is_active
  FROM public.integration_keys k
  WHERE k.service IN ('cs_contact', 'tech_support');
$$;

GRANT EXECUTE ON FUNCTION public.get_help_contact_labels() TO anon, authenticated;
