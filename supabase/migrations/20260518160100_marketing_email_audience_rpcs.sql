-- ============================================================
-- Marketing Module — Email Audience RPCs [SQUAAD adapted]
-- ============================================================
-- Substitui o pacote/migrations/004. Filtros adaptados ao modelo kanban do CRM:
--   board_ids, column_ids, tags_any, sources, assigned_to_any,
--   lead_score_min/max, created_after/before, first_contact_after/before,
--   exclude_campaign_days, lead_ids (short-circuit).
-- Trava LGPD: ignora email vazio, email_opted_out=true, e email em email_unsubscribes.
-- ============================================================

-- ============================================================
-- get_email_audience_count(p_filters)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_email_audience_count(p_filters jsonb DEFAULT '{}'::jsonb)
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
      AND l.email IS NOT NULL AND l.email <> ''
      AND (l.email_opted_out IS NULL OR l.email_opted_out = false)
      AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.email = l.email);
    RETURN v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM crm_leads l
  WHERE l.email IS NOT NULL AND l.email <> ''
    AND (l.email_opted_out IS NULL OR l.email_opted_out = false)
    AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.email = l.email)
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
        SELECT 1 FROM email_campaign_leads ecl
        WHERE ecl.lead_id = l.id
          AND ecl.status IN ('sent','delivered','opened','clicked')
          AND ecl.sent_at > now() - ((p_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    );

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_audience_count(jsonb) TO authenticated;

-- ============================================================
-- populate_email_campaign_leads(p_campaign_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_email_campaign_leads(p_campaign_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
  v_filters JSONB;
BEGIN
  SELECT audience_filters INTO v_filters FROM email_campaigns WHERE id = p_campaign_id;
  IF v_filters IS NULL THEN v_filters := '{}'::jsonb; END IF;

  DELETE FROM email_campaign_leads
  WHERE campaign_id = p_campaign_id AND status = 'pending';

  IF v_filters ? 'lead_ids' AND jsonb_array_length(v_filters->'lead_ids') > 0 THEN
    INSERT INTO email_campaign_leads (campaign_id, lead_id, email)
    SELECT p_campaign_id, l.id, l.email
    FROM crm_leads l
    WHERE l.id::text IN (SELECT jsonb_array_elements_text(v_filters->'lead_ids'))
      AND l.email IS NOT NULL AND l.email <> ''
      AND (l.email_opted_out IS NULL OR l.email_opted_out = false)
      AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.email = l.email)
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE email_campaigns SET total_leads = v_count, total_recipients = v_count, updated_at = now()
    WHERE id = p_campaign_id;
    RETURN v_count;
  END IF;

  INSERT INTO email_campaign_leads (campaign_id, lead_id, email)
  SELECT p_campaign_id, l.id, l.email
  FROM crm_leads l
  WHERE l.email IS NOT NULL AND l.email <> ''
    AND (l.email_opted_out IS NULL OR l.email_opted_out = false)
    AND NOT EXISTS (SELECT 1 FROM email_unsubscribes u WHERE u.email = l.email)
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
        SELECT 1 FROM email_campaign_leads ecl
        WHERE ecl.lead_id = l.id
          AND ecl.status IN ('sent','delivered','opened','clicked')
          AND ecl.sent_at > now() - ((v_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE email_campaigns SET total_leads = v_count, total_recipients = v_count, updated_at = now()
  WHERE id = p_campaign_id;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_email_campaign_leads(uuid) TO authenticated;

SELECT 'marketing_email_audience_rpcs OK' as result;
