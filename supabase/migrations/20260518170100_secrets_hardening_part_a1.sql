-- ============================================================
-- Secrets Hardening — Parte A.1
--
-- RPC pra admin ler valor CRU de uma chave específica. Usado por:
--   • AdminAgentes (carrega openai key pra mandar pra UAZAPI)
--
-- TODO próximo passo (Parte C): mover envio pra UAZAPI pra edge
-- function server-side e remover essa RPC — assim o api_key nem
-- chega ao browser do admin. Por ora, redução de superfície de
-- "todo bundle" (hardcoded em src/dist) pra "admin autenticado".
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_integration_key_full(p_service text)
RETURNS TABLE(
  service     text,
  api_key     text,
  api_secret  text,
  account_id  text,
  is_active   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    k.service,
    k.api_key,
    k.api_secret,
    k.account_id,
    COALESCE(k.is_active, true)
  FROM public.integration_keys k
  WHERE k.service = p_service
    AND public.is_admin();
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_key_full(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_integration_key_full(text) FROM anon;

COMMENT ON FUNCTION public.get_integration_key_full(text) IS
  'Retorna o valor CRU de uma chave de integração. Só admins (via WHERE is_admin()) '
  'recebem dado; outros recebem 0 linhas. NÃO use pra listagem — use '
  'get_integration_keys_masked() pra UI. Usar apenas no momento de envio.';
