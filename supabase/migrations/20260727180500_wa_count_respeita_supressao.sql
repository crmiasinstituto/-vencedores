-- Paridade da previa de audiencia com a montagem real: get_wa_audience_count passa a
-- descontar quem tem a tag 'whatsapp_optout'.

CREATE OR REPLACE FUNCTION public.get_wa_audience_count(p_filters jsonb DEFAULT '{}'::jsonb, p_require_opt_in boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INT;
BEGIN
  IF p_filters ? 'lead_ids' AND jsonb_array_length(p_filters->'lead_ids') > 0 THEN
    SELECT count(*) INTO v_count
    FROM crm_leads l
    WHERE l.id::text IN (SELECT jsonb_array_elements_text(p_filters->'lead_ids'))
      AND l.whatsapp IS NOT NULL AND l.whatsapp <> ''
      AND (NOT p_require_opt_in OR l.whatsapp_opt_in = true)
    -- Mesma supressao de populate_wa_campaign_leads: sem isso a previa de audiencia
    -- promete mais gente do que a campanha realmente monta.
    AND NOT ('whatsapp_optout' = ANY(COALESCE(l.tags, '{}')));
    RETURN v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM crm_leads l
  WHERE l.whatsapp IS NOT NULL AND l.whatsapp <> ''
    AND (NOT p_require_opt_in OR l.whatsapp_opt_in = true)
    -- Mesma supressao de populate_wa_campaign_leads: sem isso a previa de audiencia
    -- promete mais gente do que a campanha realmente monta.
    AND NOT ('whatsapp_optout' = ANY(COALESCE(l.tags, '{}')))
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
      (p_filters->>'onboarding_status') IS NULL
      OR (p_filters->>'onboarding_status') = 'any'
      OR ((p_filters->>'onboarding_status') = 'completed' AND l.onboarding_completed_at IS NOT NULL)
      OR ((p_filters->>'onboarding_status') = 'pending' AND l.onboarding_completed_at IS NULL)
    )
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
    )
    -- NOVOS: exclude_board_ids, exclude_column_ids, exclude_tags
    AND (
      NOT (p_filters ? 'exclude_board_ids') OR jsonb_array_length(p_filters->'exclude_board_ids') = 0
      OR l.board_id::text NOT IN (SELECT jsonb_array_elements_text(p_filters->'exclude_board_ids'))
    )
    AND (
      NOT (p_filters ? 'exclude_column_ids') OR jsonb_array_length(p_filters->'exclude_column_ids') = 0
      OR l.column_id::text NOT IN (SELECT jsonb_array_elements_text(p_filters->'exclude_column_ids'))
    )
    AND (
      NOT (p_filters ? 'exclude_tags') OR jsonb_array_length(p_filters->'exclude_tags') = 0
      OR NOT (l.tags && ARRAY(SELECT jsonb_array_elements_text(p_filters->'exclude_tags'))::text[])
    );

  RETURN v_count;
END;
$function$

;
