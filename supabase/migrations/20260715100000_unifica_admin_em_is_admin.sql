-- Unificação dos dois sistemas de admin que coexistiam no mesmo banco.
--
-- Antes:
--   CRM    -> is_admin()  lê public.app_admins por email do auth.uid()   [1 registro]
--   Portal -> has_role(uid, 'admin'::app_role) lê public.user_roles      [0 registros]
--
-- Fica o is_admin(): é o único que tem alguém dentro e o único já costurado nas
-- policies do lado do CRM. O user_roles nunca teve uma linha — os papéis
-- 'moderator' e 'user' do enum jamais foram usados por nenhum cliente.
--
-- Levantado direto do pg_policies em 15/07/2026: 13 policies em public + 3 em
-- storage dependiam de has_role(). Nenhuma função, view ou trigger dependia.
--
-- Roles e comandos de cada policy foram preservados; a única troca de forma é a
-- consolidação das duas policies redundantes de advertisements (uma para
-- authenticated e outra idêntica para public — policies são OR, então as duas
-- juntas equivaliam a uma).

-- ── advertisements ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage ads" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can manage all ads" ON public.advertisements;

CREATE POLICY "Admins can manage ads"
  ON public.advertisements FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can view own ads" ON public.advertisements;
CREATE POLICY "Users can view own ads"
  ON public.advertisements FOR SELECT TO public
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR status = 'approved'
    OR public.is_admin()
  );

-- ── announcements ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Admins can manage announcements"
  ON public.announcements FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── business_deals ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all deals" ON public.business_deals;
CREATE POLICY "Admins can manage all deals"
  ON public.business_deals FOR ALL TO public
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── events ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
CREATE POLICY "Admins can manage events"
  ON public.events FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── profiles ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── referrals ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage referrals" ON public.referrals;
CREATE POLICY "Admins can manage referrals"
  ON public.referrals FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── sales_ranking ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage sales ranking" ON public.sales_ranking;
CREATE POLICY "Admins can manage sales ranking"
  ON public.sales_ranking FOR ALL TO public
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── spotlight_presentations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage presentations" ON public.spotlight_presentations;
CREATE POLICY "Admins can manage presentations"
  ON public.spotlight_presentations FOR ALL TO public
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "View own presentations" ON public.spotlight_presentations;
CREATE POLICY "View own presentations"
  ON public.spotlight_presentations FOR SELECT TO public
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- ── trainings ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage trainings" ON public.trainings;
CREATE POLICY "Admins can manage trainings"
  ON public.trainings FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── storage: bucket videos ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can upload videos" ON storage.objects;
CREATE POLICY "Admins can upload videos"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'videos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update videos" ON storage.objects;
CREATE POLICY "Admins can update videos"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'videos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete videos" ON storage.objects;
CREATE POLICY "Admins can delete videos"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'videos' AND public.is_admin());

-- ── demolição do sistema antigo ─────────────────────────────────────────
-- CASCADE leva junto a policy "Admins can manage roles" da própria tabela.
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP TYPE IF EXISTS public.app_role;
