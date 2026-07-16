-- ROLLBACK de 20260715100000_unifica_admin_em_is_admin.sql
--
-- NÃO é aplicado por nada: existe para reconstruir o sistema has_role/user_roles
-- caso a unificação em is_admin() precise ser desfeita. As definições abaixo foram
-- copiadas do banco de produção em 15/07/2026, imediatamente antes do DROP.
--
-- A tabela tinha ZERO linhas quando foi removida, então não há dado a restaurar —
-- só o schema. Depois de rodar este arquivo, é preciso reverter também as 16
-- policies, trocando public.is_admin() de volta por has_role(auth.uid(), 'admin').

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL DEFAULT 'user'::public.app_role,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
