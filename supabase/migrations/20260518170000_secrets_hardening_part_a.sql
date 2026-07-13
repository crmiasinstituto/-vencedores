-- ============================================================
-- Secrets Hardening — Parte A
--
-- Contexto real (descoberto via Management API antes de aplicar):
--   - integration_keys JÁ tem policy "Service role only" (boa)
--     → anon NÃO consegue ler. Confirmado.
--   - Porém AdminConfiguracoes UI quebra: `from('integration_keys').select()`
--     retorna 0 linhas pra admin autenticado, então a tab mostra
--     todos como "Pendente" mesmo com 4 chaves salvas
--     (firecrawl/gemini/google-oauth/scrapecreators).
--   - AdminAgentes.tsx tem OPENAI_PLATFORM_KEY hardcoded porque o
--     admin não consegue ler o valor via front.
--
-- Estratégia:
--   1) Cria allowlist de admins (public.app_admins)
--   2) Função is_admin() SECURITY DEFINER (auth.uid → email → allowlist)
--   3) RPC get_integration_keys_masked() retorna SERVIÇO + MASK +
--      last4 + is_active → admin lista sem segurar o valor cru.
--   4) Mantém a policy "Service role only" de integration_keys —
--      nenhum admin lê api_key cru direto da tabela; pra usos legítimos
--      (AdminAgentes load) existe edge function get-integration-key
--      verify_jwt:true + is_admin() check.
--
-- Parte B (próxima migration) trata RLS das tabelas member_* —
-- 3 tabelas ainda têm policy USING(true): member_files, member_lessons,
-- member_modules (SELECT anon), member_progress (ALL anon),
-- member_milestones (ALL anon), members (SELECT/UPDATE anon).
-- ============================================================

-- 1) Allowlist de admins
CREATE TABLE IF NOT EXISTS public.app_admins (
  email      text PRIMARY KEY,
  added_at   timestamptz NOT NULL DEFAULT now(),
  added_by   text
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_admins FROM anon, authenticated;
-- Tabela só é manipulada via service_role (edge function / SQL editor).
-- Sem policies para anon/authenticated = deny default.

-- Bootstrap: Carlos
INSERT INTO public.app_admins (email, added_by) VALUES
  ('caduh.ces@gmail.com', 'bootstrap')
ON CONFLICT (email) DO NOTHING;

-- 2) Função is_admin() — usada em policies e RPCs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins a
    WHERE a.email = (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

COMMENT ON FUNCTION public.is_admin() IS
  'Retorna true se o auth.uid() atual pertence a um email em app_admins. '
  'SECURITY DEFINER para conseguir ler auth.users sem expor a tabela.';

-- 3) integration_keys — mantém policy "Service role only" existente.
-- Nenhum admin lê api_key cru via REST direto. Acesso vai por:
--   • RPC public.get_integration_keys_masked() — listagem mascarada (UI)
--   • Edge function save-integration-key — gravação (service_role)
--   • Edge function get-integration-key (a criar) — leitura crua server-side
DROP POLICY IF EXISTS "Allow all on integration_keys" ON public.integration_keys;
-- ↑ no-op se já não existir; mantido por idempotência caso a migration
-- antiga ainda esteja em algum ambiente.

-- 4) RPC pra UI: lista chaves com MASK (últimos 4 chars)
CREATE OR REPLACE FUNCTION public.get_integration_keys_masked()
RETURNS TABLE(
  service          text,
  api_key_masked   text,
  api_key_last4    text,
  has_secret       boolean,
  account_id       text,
  is_active        boolean,
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
    k.updated_at
  FROM public.integration_keys k
  WHERE public.is_admin()
  ORDER BY k.service;
$$;

GRANT EXECUTE ON FUNCTION public.get_integration_keys_masked() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_integration_keys_masked() FROM anon;

COMMENT ON FUNCTION public.get_integration_keys_masked() IS
  'Lista chaves de integração com api_key mascarada (●●●●●●●●xZpw). '
  'Só admins enxergam — o WHERE is_admin() retorna 0 linhas pra não-admin '
  'mesmo que a função seja SECURITY DEFINER.';
