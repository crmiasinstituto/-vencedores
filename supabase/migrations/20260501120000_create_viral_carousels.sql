-- Carrossel Viral - gerador de carrossel Instagram com IA
-- Cada registro representa uma sessao de criacao: briefing -> 3 ganchos -> roteiro completo + legenda

CREATE TABLE IF NOT EXISTS public.viral_carousels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Briefing original do usuario
  briefing text NOT NULL,
  topic text,                              -- titulo curto extraido (preview)

  -- Ganchos gerados (array de 3 objetos {id, text, style})
  hooks jsonb DEFAULT '[]'::jsonb,
  selected_hook_index integer,             -- 0..2

  -- Slides finais (objeto {slide1: {titulo, texto}, slide2: {...}, ...})
  slides jsonb DEFAULT '{}'::jsonb,
  caption text,
  total_slides integer DEFAULT 0,

  -- Estado da sessao
  status text NOT NULL DEFAULT 'draft',
  -- draft | hooks_generated | content_generated | ready | error

  error_message text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viral_carousels_user_created
  ON public.viral_carousels (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_viral_carousels_status
  ON public.viral_carousels (status);

ALTER TABLE public.viral_carousels ENABLE ROW LEVEL SECURITY;

-- Mantem o padrao das outras tabelas de marketing (acesso aberto autenticado)
CREATE POLICY "Allow all on viral_carousels"
  ON public.viral_carousels
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger pra updated_at
CREATE OR REPLACE FUNCTION public.set_viral_carousels_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_viral_carousels_updated_at ON public.viral_carousels;
CREATE TRIGGER trg_viral_carousels_updated_at
  BEFORE UPDATE ON public.viral_carousels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_viral_carousels_updated_at();
