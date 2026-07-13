-- Edicao de video sem alterar arquivo: o player respeita os bounds.
-- Permite cortar inicio/fim ou dividir em multiplas "aulas virtuais"
-- apontando pro mesmo video com bounds diferentes.

ALTER TABLE public.member_lessons
  ADD COLUMN IF NOT EXISTS clip_start_seconds numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS clip_end_seconds   numeric DEFAULT NULL;

COMMENT ON COLUMN public.member_lessons.clip_start_seconds IS
  'Segundo onde o video inicia (clipping, nao altera arquivo). NULL = inicio.';
COMMENT ON COLUMN public.member_lessons.clip_end_seconds IS
  'Segundo onde o video termina. NULL = fim do arquivo.';
