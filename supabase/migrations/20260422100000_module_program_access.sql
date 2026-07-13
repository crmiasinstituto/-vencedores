-- Acesso aos modulos passa a ser por PROGRAMA (metodo-squaad, mentoria, ...)
-- ao inves de nivel. O nivel fica apenas decorativo/XP — todos os niveis
-- tem acesso se o programa bater.

ALTER TABLE public.member_modules
  ADD COLUMN IF NOT EXISTS allowed_programs text[] DEFAULT NULL;

-- Default: todos os modulos existentes ficam ABERTOS (allowed_programs = NULL
-- significa "todos os programas podem ver")
UPDATE public.member_modules
   SET allowed_programs = NULL
 WHERE allowed_programs IS NULL OR allowed_programs = ARRAY[]::text[];

-- Zera required_level (vira puramente decorativo). NULL = sem bloqueio.
UPDATE public.member_modules
   SET required_level = NULL;

COMMENT ON COLUMN public.member_modules.allowed_programs IS
  'Programas que podem acessar este modulo. NULL = todos. Ex: {metodo-squaad,mentoria}';
