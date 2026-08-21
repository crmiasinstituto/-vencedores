-- Foto do evento (banner do card).
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS image_url text;

-- Avisos da comunidade: a tabela existia com title/content/type/is_active e nada mais — sem
-- janela de exibição, sem link e sem como virar popup. Sem isso, "aviso" era um texto solto
-- que alguém tinha que lembrar de desligar na mão.
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS starts_at     timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ends_at       timestamptz,
  ADD COLUMN IF NOT EXISTS link_url      text,
  ADD COLUMN IF NOT EXISTS link_label    text,
  ADD COLUMN IF NOT EXISTS image_url     text,
  -- true = abre como popup ao entrar; false = fica só na lista de avisos.
  ADD COLUMN IF NOT EXISTS is_popup      boolean NOT NULL DEFAULT false,
  -- Vazio = todas as faixas. Mesma semântica de events.faixas_permitidas: lista de convidados.
  ADD COLUMN IF NOT EXISTS faixas_alvo   text[] NOT NULL DEFAULT '{}',
  -- Quantas vezes o mesmo membro vê o popup. 0 = sempre; 1 = só uma vez.
  ADD COLUMN IF NOT EXISTS max_exibicoes integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority      integer NOT NULL DEFAULT 0;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_fim_depois_do_inicio;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_fim_depois_do_inicio
  CHECK (ends_at IS NULL OR ends_at > starts_at);

-- Quem já viu qual popup, pra não repetir a cada F5.
CREATE TABLE IF NOT EXISTS public.announcement_views (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vezes           integer NOT NULL DEFAULT 1,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, profile_id)
);

ALTER TABLE public.announcement_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membro registra a propria visualizacao" ON public.announcement_views;
CREATE POLICY "membro registra a propria visualizacao" ON public.announcement_views
  FOR ALL TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Avisos que ESTE membro deve ver agora: dentro da janela, da faixa dele, e que ele ainda
-- não viu o suficiente. Concentra a regra no banco pra tela não ter que reimplementá-la.
CREATE OR REPLACE FUNCTION public.avisos_para_mim()
RETURNS SETOF public.announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH eu AS (
    SELECT id, faixa::text AS faixa FROM public.profiles WHERE user_id = auth.uid() LIMIT 1
  )
  SELECT a.*
    FROM public.announcements a, eu
   WHERE a.is_active
     AND a.starts_at <= now()
     AND (a.ends_at IS NULL OR a.ends_at > now())
     AND (a.faixas_alvo = '{}' OR eu.faixa = ANY(a.faixas_alvo))
     AND (a.target_profile_id IS NULL OR a.target_profile_id = eu.id)
     AND (
       a.max_exibicoes = 0
       OR COALESCE((SELECT v.vezes FROM public.announcement_views v
                     WHERE v.announcement_id = a.id AND v.profile_id = eu.id), 0) < a.max_exibicoes
     )
   ORDER BY a.priority DESC, a.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.avisos_para_mim() TO authenticated;

-- Marca que o membro viu (soma 1). Idempotente por (aviso, membro).
CREATE OR REPLACE FUNCTION public.marcar_aviso_visto(p_announcement uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_profile uuid;
BEGIN
  SELECT id INTO v_profile FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF v_profile IS NULL THEN RETURN; END IF;
  INSERT INTO public.announcement_views (announcement_id, profile_id, vezes, last_seen_at)
  VALUES (p_announcement, v_profile, 1, now())
  ON CONFLICT (announcement_id, profile_id) DO UPDATE
    SET vezes = public.announcement_views.vezes + 1, last_seen_at = now();
END;
$function$;

GRANT EXECUTE ON FUNCTION public.marcar_aviso_visto(uuid) TO authenticated;
