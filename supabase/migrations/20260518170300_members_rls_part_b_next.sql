-- ============================================================
-- Members RLS Hardening — Parte B.next
--
-- Fecha o último leak crítico: anon dump da tabela members com
-- password_hash + session_token + PII.
--
-- Estratégia:
--   1) Drop policies USING(true) anon-permissivas existentes.
--   2) Policies novas usam current_member_id() (já criada em B):
--      - SELECT/UPDATE: próprio membro OU contratante vê prepostos.
--      - INSERT: contratante cria preposto (com WITH CHECK robusto).
--      - DELETE: apenas admin.
--   3) RPC member_leaderboard(p_limit) — ranking público com
--      campos restritos (sem PII).
--
-- Login deixa de funcionar via SELECT direto (anon não tem token);
-- substituído por edge function `member-login` (deploy junto).
-- ============================================================

-- 1) Drop policies anon-permissivas (USING(true))
DROP POLICY IF EXISTS "Members admin update"            ON public.members;
DROP POLICY IF EXISTS "Members anon insert preposto"    ON public.members;
DROP POLICY IF EXISTS "Members anon login lookup"       ON public.members;
DROP POLICY IF EXISTS "Members anon update own session" ON public.members;
DROP POLICY IF EXISTS "Members read own"                ON public.members;
DROP POLICY IF EXISTS "Members service write"           ON public.members;

-- 2) Novas policies
-- SELECT: próprio membro, contratante (vê prepostos), admin, service_role
CREATE POLICY "Members self or contratante read"
  ON public.members
  FOR SELECT
  USING (
    id = public.current_member_id()
    OR contratante_member_id = public.current_member_id()
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- INSERT: contratante cria preposto vinculado a si (defesa em profundidade
-- contra preposto criando outros prepostos sem permissão), admin, service_role
CREATE POLICY "Contratante creates preposto or admin"
  ON public.members
  FOR INSERT
  WITH CHECK (
    (contratante_member_id IS NOT NULL AND contratante_member_id = public.current_member_id())
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- UPDATE: próprio membro ou contratante atualizando preposto, admin, service_role
CREATE POLICY "Members self or contratante update"
  ON public.members
  FOR UPDATE
  USING (
    id = public.current_member_id()
    OR contratante_member_id = public.current_member_id()
    OR public.is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    id = public.current_member_id()
    OR contratante_member_id = public.current_member_id()
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- DELETE: apenas admin/service
CREATE POLICY "Admin deletes members"
  ON public.members
  FOR DELETE
  USING (public.is_admin() OR auth.role() = 'service_role');

-- 3) RPC member_leaderboard(p_limit) — campos restritos
CREATE OR REPLACE FUNCTION public.member_leaderboard(p_limit int DEFAULT 5)
RETURNS TABLE(
  id          uuid,
  name        text,
  avatar_url  text,
  level       text,
  xp          integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, avatar_url, level, xp
    FROM public.members
   WHERE status = 'active'
   ORDER BY xp DESC NULLS LAST
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.member_leaderboard(int) TO anon, authenticated;

COMMENT ON FUNCTION public.member_leaderboard(int) IS
  'Ranking público de membros ativos. Retorna SOMENTE campos não-sensíveis. '
  'Sem PII (sem email/phone/birthdate/password_hash/session_token).';

-- 4) RPC member_self() — versão segura (filtra campos sensíveis caso o
-- caller faça `SELECT * FROM member_self()` na UI). Útil quando o front
-- não quer expor por engano password_hash ou session_token no estado React.
CREATE OR REPLACE FUNCTION public.member_self()
RETURNS TABLE(
  id                     uuid,
  name                   text,
  email                  text,
  phone                  text,
  avatar_url             text,
  program                text,
  status                 text,
  xp                     integer,
  level                  text,
  streak_current         integer,
  streak_longest         integer,
  streak_last_date       date,
  badges                 text[],
  total_time_minutes     integer,
  total_lessons_completed integer,
  total_quizzes_completed integer,
  bio                    text,
  job_title              text,
  birthdate              date,
  member_role            text,
  contratante_member_id  uuid,
  welcome_message        text,
  last_active_at         timestamptz,
  created_at             timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id, m.name, m.email, m.phone, m.avatar_url, m.program, m.status,
    m.xp, m.level, m.streak_current, m.streak_longest, m.streak_last_date,
    m.badges, m.total_time_minutes, m.total_lessons_completed,
    m.total_quizzes_completed, m.bio, m.job_title, m.birthdate,
    m.member_role, m.contratante_member_id, m.welcome_message,
    m.last_active_at, m.created_at
  FROM public.members m
  WHERE m.id = public.current_member_id();
$$;

GRANT EXECUTE ON FUNCTION public.member_self() TO anon, authenticated;

COMMENT ON FUNCTION public.member_self() IS
  'Retorna o registro do próprio membro identificado pelo x-member-token. '
  'SEM password_hash, session_token, session_device — campos sensíveis que '
  'a UI não precisa.';
