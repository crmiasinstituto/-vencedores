-- Supressao de opt-out de WhatsApp via tag 'whatsapp_optout'.
-- A Meta devolve [131050] quando a pessoa pede pra parar de receber marketing; sem isso
-- ela reentrava na campanha seguinte. Usamos TAG e nao a coluna whatsapp_opt_in porque
-- essa coluna e false por default em praticamente toda a base (43.269 de 43.377) —
-- barrar por ela esvaziaria qualquer campanha.

CREATE OR REPLACE FUNCTION public.populate_wa_campaign_leads(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      -- Supressao permanente: quem pediu pra parar de receber marketing pelo WhatsApp
      -- (Meta devolve [131050]) ganha a tag 'whatsapp_optout' e nunca mais entra em
      -- campanha, independente de filtro. NAO usar whatsapp_opt_in pra isso: esse campo
      -- e false por default em 43k dos 43,4k leads, ou seja, barraria a base inteira.
      AND NOT ('whatsapp_optout' = ANY(COALESCE(l.tags, '{}')))
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
      -- Supressao permanente: quem pediu pra parar de receber marketing pelo WhatsApp
      -- (Meta devolve [131050]) ganha a tag 'whatsapp_optout' e nunca mais entra em
      -- campanha, independente de filtro. NAO usar whatsapp_opt_in pra isso: esse campo
      -- e false por default em 43k dos 43,4k leads, ou seja, barraria a base inteira.
      AND NOT ('whatsapp_optout' = ANY(COALESCE(l.tags, '{}')))
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
      (v_filters->>'onboarding_status') IS NULL
      OR (v_filters->>'onboarding_status') = 'any'
      OR ((v_filters->>'onboarding_status') = 'completed' AND l.onboarding_completed_at IS NOT NULL)
      OR ((v_filters->>'onboarding_status') = 'pending' AND l.onboarding_completed_at IS NULL)
    )
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
    -- NOVOS: exclude_board_ids, exclude_column_ids, exclude_tags
    AND (
      NOT (v_filters ? 'exclude_board_ids') OR jsonb_array_length(v_filters->'exclude_board_ids') = 0
      OR l.board_id::text NOT IN (SELECT jsonb_array_elements_text(v_filters->'exclude_board_ids'))
    )
    AND (
      NOT (v_filters ? 'exclude_column_ids') OR jsonb_array_length(v_filters->'exclude_column_ids') = 0
      OR l.column_id::text NOT IN (SELECT jsonb_array_elements_text(v_filters->'exclude_column_ids'))
    )
    AND (
      NOT (v_filters ? 'exclude_tags') OR jsonb_array_length(v_filters->'exclude_tags') = 0
      OR NOT (l.tags && ARRAY(SELECT jsonb_array_elements_text(v_filters->'exclude_tags'))::text[])
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE wa_campaigns SET total_leads = v_count, audience_count = v_count, updated_at = now()
  WHERE id = p_campaign_id;
  RETURN v_count;
END;
$function$

;
