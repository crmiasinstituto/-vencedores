-- ============================================================
-- Marketing Module — WhatsApp Blast Audience RPCs [SQUAAD]
-- ============================================================
-- get_wa_audience_count(p_filters, p_require_opt_in)
-- populate_wa_campaign_leads(p_campaign_id)
-- Filtros: lead_ids[] (short-circuit), board_ids, column_ids, sources,
--          assigned_to_any, tags_any, lead_score_min/max, created_after/before,
--          first_contact_after/before, exclude_campaign_days, exclude_lead_ids.
-- TRAVA anti-ban: se p_require_opt_in=true (default), só lead com whatsapp_opt_in=true.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_wa_audience_count(p_filters jsonb DEFAULT '{}'::jsonb, p_require_opt_in boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  IF p_filters ? 'lead_ids' AND jsonb_array_length(p_filters->'lead_ids') > 0 THEN
    SELECT count(*) INTO v_count
    FROM crm_leads l
    WHERE l.id::text IN (SELECT jsonb_array_elements_text(p_filters->'lead_ids'))
      AND l.whatsapp IS NOT NULL AND l.whatsapp <> ''
      AND (NOT p_require_opt_in OR l.whatsapp_opt_in = true);
    RETURN v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM crm_leads l
  WHERE l.whatsapp IS NOT NULL AND l.whatsapp <> ''
    AND (NOT p_require_opt_in OR l.whatsapp_opt_in = true)
    AND (
      NOT (p_filters ? 'board_ids') OR jsonb_array_length(p_filters->'board_ids') = 0
      OR l.board_id::text IN (SELECT jsonb_array_elements_text(p_filters->'board_ids'))
    )
    AND (
      NOT (p_filters ? 'column_ids') OR jsonb_array_length(p_filters->'column_ids') = 0
      OR l.column_id::text IN (SELECT jsonb_array_elements_text(p_filters->'column_ids'))
    )
    AND (
      NOT (p_filters ? 'sources') OR jsonb_array_length(p_filters->'sources') = 0
      OR l.source IN (SELECT jsonb_array_elements_text(p_filters->'sources'))
    )
    AND (
      NOT (p_filters ? 'assigned_to_any') OR jsonb_array_length(p_filters->'assigned_to_any') = 0
      OR l.assigned_to IN (SELECT jsonb_array_elements_text(p_filters->'assigned_to_any'))
    )
    AND (
      NOT (p_filters ? 'tags_any') OR jsonb_array_length(p_filters->'tags_any') = 0
      OR l.tags && ARRAY(SELECT jsonb_array_elements_text(p_filters->'tags_any'))::text[]
    )
    AND ((p_filters->>'lead_score_min') IS NULL OR l.lead_score >= (p_filters->>'lead_score_min')::int)
    AND ((p_filters->>'lead_score_max') IS NULL OR l.lead_score <= (p_filters->>'lead_score_max')::int)
    AND ((p_filters->>'created_after')  IS NULL OR l.created_at >= (p_filters->>'created_after')::timestamptz)
    AND ((p_filters->>'created_before') IS NULL OR l.created_at <= (p_filters->>'created_before')::timestamptz)
    AND ((p_filters->>'first_contact_after')  IS NULL OR l.first_contact_at >= (p_filters->>'first_contact_after')::timestamptz)
    AND ((p_filters->>'first_contact_before') IS NULL OR l.first_contact_at <= (p_filters->>'first_contact_before')::timestamptz)
    AND (
      (p_filters->>'exclude_campaign_days') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM wa_campaign_leads wcl
        WHERE wcl.lead_id = l.id
          AND wcl.status IN ('sent','delivered','read')
          AND wcl.sent_at > now() - ((p_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    )
    AND (
      NOT (p_filters ? 'exclude_lead_ids') OR jsonb_array_length(p_filters->'exclude_lead_ids') = 0
      OR l.id::text NOT IN (SELECT jsonb_array_elements_text(p_filters->'exclude_lead_ids'))
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_wa_audience_count(jsonb, boolean) TO authenticated;

-- ============================================================
-- populate_wa_campaign_leads(p_campaign_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_wa_campaign_leads(p_campaign_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_filters JSONB;
  v_require_opt_in BOOLEAN;
  v_count INT;
BEGIN
  SELECT audience_filters, confirmed_opt_in_only
    INTO v_filters, v_require_opt_in
  FROM wa_campaigns WHERE id = p_campaign_id;
  IF v_filters IS NULL THEN v_filters := '{}'::jsonb; END IF;
  IF v_require_opt_in IS NULL THEN v_require_opt_in := true; END IF;

  DELETE FROM wa_campaign_leads
  WHERE campaign_id = p_campaign_id AND status = 'pending';

  IF v_filters ? 'lead_ids' AND jsonb_array_length(v_filters->'lead_ids') > 0 THEN
    INSERT INTO wa_campaign_leads (campaign_id, lead_id, whatsapp, assigned_to)
    SELECT p_campaign_id, l.id, l.whatsapp, l.assigned_to
    FROM crm_leads l
    WHERE l.id::text IN (SELECT jsonb_array_elements_text(v_filters->'lead_ids'))
      AND l.whatsapp IS NOT NULL AND l.whatsapp <> ''
      AND (NOT v_require_opt_in OR l.whatsapp_opt_in = true)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE wa_campaigns SET total_leads = v_count, audience_count = v_count, updated_at = now()
    WHERE id = p_campaign_id;
    RETURN v_count;
  END IF;

  INSERT INTO wa_campaign_leads (campaign_id, lead_id, whatsapp, assigned_to)
  SELECT p_campaign_id, l.id, l.whatsapp, l.assigned_to
  FROM crm_leads l
  WHERE l.whatsapp IS NOT NULL AND l.whatsapp <> ''
    AND (NOT v_require_opt_in OR l.whatsapp_opt_in = true)
    AND (
      NOT (v_filters ? 'board_ids') OR jsonb_array_length(v_filters->'board_ids') = 0
      OR l.board_id::text IN (SELECT jsonb_array_elements_text(v_filters->'board_ids'))
    )
    AND (
      NOT (v_filters ? 'column_ids') OR jsonb_array_length(v_filters->'column_ids') = 0
      OR l.column_id::text IN (SELECT jsonb_array_elements_text(v_filters->'column_ids'))
    )
    AND (
      NOT (v_filters ? 'sources') OR jsonb_array_length(v_filters->'sources') = 0
      OR l.source IN (SELECT jsonb_array_elements_text(v_filters->'sources'))
    )
    AND (
      NOT (v_filters ? 'assigned_to_any') OR jsonb_array_length(v_filters->'assigned_to_any') = 0
      OR l.assigned_to IN (SELECT jsonb_array_elements_text(v_filters->'assigned_to_any'))
    )
    AND (
      NOT (v_filters ? 'tags_any') OR jsonb_array_length(v_filters->'tags_any') = 0
      OR l.tags && ARRAY(SELECT jsonb_array_elements_text(v_filters->'tags_any'))::text[]
    )
    AND ((v_filters->>'lead_score_min') IS NULL OR l.lead_score >= (v_filters->>'lead_score_min')::int)
    AND ((v_filters->>'lead_score_max') IS NULL OR l.lead_score <= (v_filters->>'lead_score_max')::int)
    AND ((v_filters->>'created_after')  IS NULL OR l.created_at >= (v_filters->>'created_after')::timestamptz)
    AND ((v_filters->>'created_before') IS NULL OR l.created_at <= (v_filters->>'created_before')::timestamptz)
    AND ((v_filters->>'first_contact_after')  IS NULL OR l.first_contact_at >= (v_filters->>'first_contact_after')::timestamptz)
    AND ((v_filters->>'first_contact_before') IS NULL OR l.first_contact_at <= (v_filters->>'first_contact_before')::timestamptz)
    AND (
      (v_filters->>'exclude_campaign_days') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM wa_campaign_leads wcl
        WHERE wcl.lead_id = l.id
          AND wcl.status IN ('sent','delivered','read')
          AND wcl.sent_at > now() - ((v_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    )
    AND (
      NOT (v_filters ? 'exclude_lead_ids') OR jsonb_array_length(v_filters->'exclude_lead_ids') = 0
      OR l.id::text NOT IN (SELECT jsonb_array_elements_text(v_filters->'exclude_lead_ids'))
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE wa_campaigns SET total_leads = v_count, audience_count = v_count, updated_at = now()
  WHERE id = p_campaign_id;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_wa_campaign_leads(uuid) TO authenticated;

SELECT 'marketing_wa_audience_rpcs OK' as result;
