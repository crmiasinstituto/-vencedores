-- ===========================================
-- R10X SETTINGS — config simples por chave (slides ocultos, etc)
-- Lida pelo HTML da apresentação (anon, read-only) e mutada pelo painel admin.
-- ===========================================

CREATE TABLE IF NOT EXISTS public.r10x_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.r10x_settings ENABLE ROW LEVEL SECURITY;

-- Anon LÊ (presentation HTML é estático, sem auth)
DROP POLICY IF EXISTS "anon_read_r10x_settings" ON public.r10x_settings;
CREATE POLICY "anon_read_r10x_settings"
  ON public.r10x_settings FOR SELECT TO anon USING (TRUE);

-- Authenticated edita (admin do painel)
DROP POLICY IF EXISTS "authenticated_write_r10x_settings" ON public.r10x_settings;
CREATE POLICY "authenticated_write_r10x_settings"
  ON public.r10x_settings FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

-- Seed: lista inicial de slides escondidos (matchem id="..." do HTML)
INSERT INTO public.r10x_settings (key, value)
VALUES ('hidden_slide_ids', '["slide-masterclass","slide-estudo-caso"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
