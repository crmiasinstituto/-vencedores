-- member_lessons: estado da geracao de PDF persistido
-- Permite UI mostrar "gerando" / "erro" mesmo depois de reload da pagina.

ALTER TABLE public.member_lessons
  ADD COLUMN IF NOT EXISTS pdf_status text DEFAULT 'idle';
-- valores: idle | generating | error

ALTER TABLE public.member_lessons
  ADD COLUMN IF NOT EXISTS pdf_error text;

ALTER TABLE public.member_lessons
  ADD COLUMN IF NOT EXISTS pdf_started_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_member_lessons_pdf_status
  ON public.member_lessons (pdf_status)
  WHERE pdf_status <> 'idle';
