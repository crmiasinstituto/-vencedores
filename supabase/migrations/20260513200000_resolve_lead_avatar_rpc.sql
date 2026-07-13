-- ===========================================================
-- resolve_lead_avatar: encontra a melhor foto + handle Instagram
-- pra um lead, cascateando entre TODAS as tabelas onde a info
-- pode ter sido salva (crm_leads, leads).
--
-- Ordem de prioridade da FOTO:
--   1. crm_leads.instagram_profile_pic_url   (por whatsapp)
--   2. leads.instagram_profile_pic_url       (por whatsapp)
--   3. crm_leads.instagram_profile_pic_url   (por email)
--   4. leads.instagram_profile_pic_url       (por email)
--   5. crm_leads.whatsapp_profile_pic_url    (foto do WhatsApp, fallback)
--
-- O handle do Instagram é retornado mesmo se a foto não foi
-- encontrada (pode estar salvo sem ter sido scrapado).
--
-- Whatsapp matching: tenta exato, sem 55, e últimos 9 dígitos.
-- ===========================================================

CREATE OR REPLACE FUNCTION public.resolve_lead_avatar(
  p_whatsapp TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  instagram_handle TEXT,
  photo_url TEXT,
  source TEXT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_phone_clean TEXT;
  v_phone_no55 TEXT;
  v_phone_tail TEXT;
  v_result_handle TEXT;
  v_result_photo TEXT;
  v_result_source TEXT;
BEGIN
  -- Normaliza variações do whatsapp pra matching
  v_phone_clean := regexp_replace(COALESCE(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_phone_no55 := CASE
    WHEN v_phone_clean LIKE '55%' AND length(v_phone_clean) >= 12
      THEN substring(v_phone_clean FROM 3)
    ELSE v_phone_clean
  END;
  v_phone_tail := CASE
    WHEN length(v_phone_clean) >= 9 THEN right(v_phone_clean, 9)
    ELSE NULL
  END;

  -- 1) crm_leads por whatsapp (instagram_profile_pic_url)
  IF v_phone_clean <> '' THEN
    SELECT cl.instagram, cl.instagram_profile_pic_url
    INTO v_result_handle, v_result_photo
    FROM public.crm_leads cl
    WHERE regexp_replace(COALESCE(cl.whatsapp, ''), '[^0-9]', '', 'g') IN (v_phone_clean, v_phone_no55)
      AND cl.instagram_profile_pic_url IS NOT NULL
    ORDER BY cl.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_photo IS NOT NULL THEN
      v_result_source := 'crm_leads.ig_pic.whatsapp';
      RETURN QUERY SELECT v_result_handle, v_result_photo, v_result_source;
      RETURN;
    END IF;
  END IF;

  -- 2) leads por whatsapp (instagram_profile_pic_url)
  IF v_phone_clean <> '' THEN
    SELECT l.instagram, l.instagram_profile_pic_url
    INTO v_result_handle, v_result_photo
    FROM public.leads l
    WHERE regexp_replace(COALESCE(l.whatsapp, ''), '[^0-9]', '', 'g') IN (v_phone_clean, v_phone_no55)
      AND l.instagram_profile_pic_url IS NOT NULL
    ORDER BY l.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_photo IS NOT NULL THEN
      v_result_source := 'leads.ig_pic.whatsapp';
      RETURN QUERY SELECT v_result_handle, v_result_photo, v_result_source;
      RETURN;
    END IF;
  END IF;

  -- 3) crm_leads por email (instagram_profile_pic_url)
  IF p_email IS NOT NULL AND p_email <> '' THEN
    SELECT cl.instagram, cl.instagram_profile_pic_url
    INTO v_result_handle, v_result_photo
    FROM public.crm_leads cl
    WHERE lower(cl.email) = lower(p_email)
      AND cl.instagram_profile_pic_url IS NOT NULL
    ORDER BY cl.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_photo IS NOT NULL THEN
      v_result_source := 'crm_leads.ig_pic.email';
      RETURN QUERY SELECT v_result_handle, v_result_photo, v_result_source;
      RETURN;
    END IF;
  END IF;

  -- 4) crm_leads por whatsapp (whatsapp_profile_pic_url — fallback)
  IF v_phone_clean <> '' THEN
    SELECT cl.instagram, cl.whatsapp_profile_pic_url
    INTO v_result_handle, v_result_photo
    FROM public.crm_leads cl
    WHERE regexp_replace(COALESCE(cl.whatsapp, ''), '[^0-9]', '', 'g') IN (v_phone_clean, v_phone_no55)
      AND cl.whatsapp_profile_pic_url IS NOT NULL
    ORDER BY cl.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_photo IS NOT NULL THEN
      v_result_source := 'crm_leads.whats_pic.whatsapp';
      RETURN QUERY SELECT v_result_handle, v_result_photo, v_result_source;
      RETURN;
    END IF;
  END IF;

  -- 5) Sem foto. Tenta pelo menos retornar o handle do Instagram.
  IF v_phone_clean <> '' THEN
    SELECT cl.instagram
    INTO v_result_handle
    FROM public.crm_leads cl
    WHERE regexp_replace(COALESCE(cl.whatsapp, ''), '[^0-9]', '', 'g') IN (v_phone_clean, v_phone_no55)
      AND cl.instagram IS NOT NULL
    ORDER BY cl.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_handle IS NOT NULL THEN
      RETURN QUERY SELECT v_result_handle, NULL::TEXT, 'crm_leads.handle_only'::TEXT;
      RETURN;
    END IF;

    SELECT l.instagram
    INTO v_result_handle
    FROM public.leads l
    WHERE regexp_replace(COALESCE(l.whatsapp, ''), '[^0-9]', '', 'g') IN (v_phone_clean, v_phone_no55)
      AND l.instagram IS NOT NULL
    ORDER BY l.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_result_handle IS NOT NULL THEN
      RETURN QUERY SELECT v_result_handle, NULL::TEXT, 'leads.handle_only'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Sem nada — retorna NULLs
  RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, 'not_found'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_lead_avatar(TEXT, TEXT) TO service_role, authenticated, anon;

COMMENT ON FUNCTION public.resolve_lead_avatar(TEXT, TEXT) IS
  'Resolve a melhor foto + handle Instagram pra um lead, cascateando entre crm_leads e leads. Usado pelo kirvano-webhook pra enriquecer sales_events antes do sino de vendas.';
