-- ============================================================
-- Member RLS Hardening — Parte B
--
-- Fecha as policies USING(true) nas tabelas member_* que têm
-- member_id (scope individual) e nas tabelas catálogo (require login).
--
-- NÃO toca em `members` ainda — esse fechamento exige refatorar
-- MembrosLogin/Layout/Dashboard pra usar RPCs em vez de SELECT direto
-- (Parte B.next, separada pra blast radius menor).
--
-- Mecânica:
--   1) Função current_member_id() lê header `x-member-token` enviado
--      pelo cliente, valida contra members.session_token, retorna uuid.
--   2) Tabelas com member_id: policy `member_id = current_member_id()`
--   3) Tabelas catálogo (member_lessons/modules/files): policy exige
--      apenas que current_member_id() seja NOT NULL (membro logado),
--      sem expor o catálogo pra anon completamente.
--   4) Admin (is_admin()) bypassa tudo via OR is_admin().
--
-- IMPORTANTE: o front PRECISA enviar header `x-member-token` em todo
-- request Supabase a partir do deploy desta migration. Smart-fetch
-- interceptor cuida disso.
-- ============================================================

-- 1) current_member_id() — lê x-member-token do request, valida na DB
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  headers json;
  token   text;
  m_id    uuid;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF headers IS NULL THEN RETURN NULL; END IF;
  token := headers ->> 'x-member-token';
  IF token IS NULL OR length(token) < 16 THEN RETURN NULL; END IF;

  SELECT id INTO m_id
    FROM public.members
   WHERE session_token = token
     AND status = 'active'
   LIMIT 1;
  RETURN m_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_member_id() TO anon, authenticated;

COMMENT ON FUNCTION public.current_member_id() IS
  'Lê x-member-token do header da request PostgREST, resolve em members.id. '
  'SECURITY DEFINER pra ler members.session_token sem RLS recursivo.';

-- 2) member_progress — scope by member_id
DROP POLICY IF EXISTS "Anon access member_progress"  ON public.member_progress;
DROP POLICY IF EXISTS "Member progress anon"         ON public.member_progress;
DROP POLICY IF EXISTS "Allow all on member_progress" ON public.member_progress;

CREATE POLICY "Member own progress"
  ON public.member_progress
  FOR ALL
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

-- 3) member_milestones — scope by member_id
DROP POLICY IF EXISTS "Auth on member_milestones"      ON public.member_milestones;
DROP POLICY IF EXISTS "Member milestones anon"         ON public.member_milestones;
DROP POLICY IF EXISTS "Allow all on member_milestones" ON public.member_milestones;

CREATE POLICY "Member own milestones"
  ON public.member_milestones
  FOR ALL
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

-- 4) member_sessions — scope by member_id, anon ainda pode insert própria
DROP POLICY IF EXISTS "Auth on member_sessions"         ON public.member_sessions;
DROP POLICY IF EXISTS "Member sessions anon insert"     ON public.member_sessions;

-- SELECT/UPDATE/DELETE: só o próprio membro ou admin
CREATE POLICY "Member own sessions read"
  ON public.member_sessions
  FOR SELECT
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Member own sessions modify"
  ON public.member_sessions
  FOR UPDATE
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Member own sessions delete"
  ON public.member_sessions
  FOR DELETE
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

-- INSERT: só pra próprio membro (com header válido) ou admin
CREATE POLICY "Member own sessions insert"
  ON public.member_sessions
  FOR INSERT
  WITH CHECK (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

-- 5) member_contracts — sensível (financeiro)
DROP POLICY IF EXISTS "Service role on member_contracts" ON public.member_contracts;

CREATE POLICY "Member own contracts read"
  ON public.member_contracts
  FOR SELECT
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin manage contracts"
  ON public.member_contracts
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 6) member_payments — sensível (financeiro)
DROP POLICY IF EXISTS "Service role on member_payments" ON public.member_payments;

CREATE POLICY "Member own payments read"
  ON public.member_payments
  FOR SELECT
  USING (member_id = public.current_member_id() OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin manage payments"
  ON public.member_payments
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 7) member_lessons — catálogo, exige login
DROP POLICY IF EXISTS "Member lessons anon read"      ON public.member_lessons;
DROP POLICY IF EXISTS "Public read member_lessons"    ON public.member_lessons;
DROP POLICY IF EXISTS "Service write member_lessons"  ON public.member_lessons;
DROP POLICY IF EXISTS "Service update member_lessons" ON public.member_lessons;
DROP POLICY IF EXISTS "Service delete member_lessons" ON public.member_lessons;

CREATE POLICY "Logged members read lessons"
  ON public.member_lessons
  FOR SELECT
  USING (
    (is_published = true AND public.current_member_id() IS NOT NULL)
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admin write lessons"
  ON public.member_lessons
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 8) member_modules — catálogo, exige login
DROP POLICY IF EXISTS "Member modules anon read"      ON public.member_modules;
DROP POLICY IF EXISTS "Public read member_modules"    ON public.member_modules;
DROP POLICY IF EXISTS "Service write member_modules"  ON public.member_modules;
DROP POLICY IF EXISTS "Service update member_modules" ON public.member_modules;
DROP POLICY IF EXISTS "Service delete member_modules" ON public.member_modules;

CREATE POLICY "Logged members read modules"
  ON public.member_modules
  FOR SELECT
  USING (
    (is_published = true AND public.current_member_id() IS NOT NULL)
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Admin write modules"
  ON public.member_modules
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- 9) member_files — catálogo, exige login
DROP POLICY IF EXISTS "Member files anon read"   ON public.member_files;
DROP POLICY IF EXISTS "Public read member_files" ON public.member_files;
DROP POLICY IF EXISTS "Service write member_files" ON public.member_files;

CREATE POLICY "Logged members read files"
  ON public.member_files
  FOR SELECT
  USING (public.current_member_id() IS NOT NULL OR public.is_admin() OR auth.role() = 'service_role');

CREATE POLICY "Admin write files"
  ON public.member_files
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');
