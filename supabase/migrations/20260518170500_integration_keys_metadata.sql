-- ============================================================
-- integration_keys: expor metadata na RPC mascarada
--
-- Carlos quer poder renomear "Falar com Simone" / "Falar com Luiz"
-- pelo painel sem mexer no codigo. Usamos integration_keys.metadata
-- (jsonb ja existente) com chave display_label.
--
-- RPC get_integration_keys_masked passa a retornar o JSONB metadata
-- pro front exibir/editar. Valores cruz de api_key/secret seguem fora.
-- ============================================================

DROP FUNCTION IF EXISTS public.get_integration_keys_masked();

CREATE OR REPLACE FUNCTION public.get_integration_keys_masked()
RETURNS TABLE(
  service          text,
  api_key_masked   text,
  api_key_last4    text,
  has_secret       boolean,
  account_id       text,
  is_active        boolean,
  metadata         jsonb,
  updated_at       timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.service,
    CASE
      WHEN k.api_key IS NULL OR length(k.api_key) = 0 THEN NULL
      WHEN length(k.api_key) < 8 THEN repeat('●', length(k.api_key))
      ELSE repeat('●', 8) || right(k.api_key, 4)
    END AS api_key_masked,
    CASE
      WHEN k.api_key IS NULL OR length(k.api_key) < 4 THEN NULL
      ELSE right(k.api_key, 4)
    END AS api_key_last4,
    (k.api_secret IS NOT NULL AND length(k.api_secret) > 0) AS has_secret,
    k.account_id,
    COALESCE(k.is_active, true) AS is_active,
    COALESCE(k.metadata, '{}'::jsonb) AS metadata,
    k.updated_at
  FROM public.integration_keys k
  WHERE public.is_admin()
  ORDER BY k.service;
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_keys_masked() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_integration_keys_masked() FROM anon;
