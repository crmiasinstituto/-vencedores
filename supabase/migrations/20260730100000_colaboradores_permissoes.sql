-- Colaboradores com permissao por area.
--
-- Ate aqui o acesso ao /admin era tudo-ou-nada: estar em app_admins dava a casca inteira.
-- Agora a mesma tabela guarda QUAIS areas cada pessoa ve. Cuidado deliberado: 113 policies
-- do RLS chamam is_admin(), entao a granularidade NAO entra nela — quem e colaborador
-- continua sendo admin no banco. O recorte por area e de navegacao (menu + guarda de rota).
-- Trocar isso por autorizacao no banco exige reescrever as 113 policies, o que e outro projeto.

ALTER TABLE public.app_admins
  ADD COLUMN IF NOT EXISTS nome       text,
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true,
  -- '*' = acesso total. Default '{*}' pra que todo admin que ja existia continue igual.
  ADD COLUMN IF NOT EXISTS permissoes text[] NOT NULL DEFAULT '{*}';

UPDATE public.app_admins
   SET is_active  = COALESCE(is_active, true),
       permissoes = CASE WHEN permissoes IS NULL OR permissoes = '{}' THEN '{*}' ELSE permissoes END;

-- is_admin() passa a exigir is_active. Desativar um colaborador na tela derruba o acesso dele
-- de verdade (RLS inclusive), e nao so esconde o menu.
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_admins a
    WHERE a.email = (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid())
      AND a.is_active
  );
$function$;

-- Permissoes de quem esta logado. Devolve '{*}' pra acesso total, ou a lista de chaves de area.
CREATE OR REPLACE FUNCTION public.minhas_permissoes_admin()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  SELECT COALESCE(
    (SELECT a.permissoes
       FROM public.app_admins a
      WHERE a.email = (SELECT lower(u.email) FROM auth.users u WHERE u.id = auth.uid())
        AND a.is_active
      LIMIT 1),
    '{}'::text[]
  );
$function$;

GRANT EXECUTE ON FUNCTION public.minhas_permissoes_admin() TO authenticated;
