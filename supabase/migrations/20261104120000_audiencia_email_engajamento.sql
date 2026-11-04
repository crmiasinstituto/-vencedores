-- ============================================
-- Público das campanhas de e-mail: exclusões e engajamento
--
-- 1) O construtor de público já mostrava "Excluir quadros / colunas / tags", mas
--    get_email_audience_count e populate_email_campaign_leads ignoravam essas chaves:
--    a campanha mandava pra quem tinha sido excluído. Agora as duas aplicam.
-- 2) Filtro de engajamento: quem recebeu / abriu / clicou / não abriu / não clicou,
--    opcionalmente só em certas campanhas (engajamento_campanhas) e nos últimos N dias
--    (engajamento_dias). Lê email_sends (opened_at/clicked_at vêm do webhook do Resend).
--
-- As duas funções chamam o mesmo helper pra contagem e envio nunca divergirem.
-- ============================================

create or replace function public.email_filtros_extras_ok(
  p_lead_id uuid, p_board_id uuid, p_column_id uuid, p_tags text[], p_filters jsonb
) returns boolean
language sql
stable
as $$
  select
    (not (p_filters ? 'exclude_lead_ids') or jsonb_array_length(p_filters->'exclude_lead_ids') = 0
       or p_lead_id::text not in (select jsonb_array_elements_text(p_filters->'exclude_lead_ids')))
    and (not (p_filters ? 'exclude_board_ids') or jsonb_array_length(p_filters->'exclude_board_ids') = 0
       or p_board_id is null
       or p_board_id::text not in (select jsonb_array_elements_text(p_filters->'exclude_board_ids')))
    and (not (p_filters ? 'exclude_column_ids') or jsonb_array_length(p_filters->'exclude_column_ids') = 0
       or p_column_id is null
       or p_column_id::text not in (select jsonb_array_elements_text(p_filters->'exclude_column_ids')))
    and (not (p_filters ? 'exclude_tags') or jsonb_array_length(p_filters->'exclude_tags') = 0
       or not (coalesce(p_tags, '{}'::text[]) && array(select jsonb_array_elements_text(p_filters->'exclude_tags'))::text[]))
    and (
      coalesce(p_filters->>'engajamento', '') = ''
      or (
        with escopo as (
          select s.opened_at, s.clicked_at
            from public.email_sends s
           where s.lead_id = p_lead_id
             and s.status = 'sent'
             and (not (p_filters ? 'engajamento_campanhas')
                  or jsonb_array_length(p_filters->'engajamento_campanhas') = 0
                  or s.campaign_id::text in (select jsonb_array_elements_text(p_filters->'engajamento_campanhas')))
             and ((p_filters->>'engajamento_dias') is null
                  or s.sent_at > now() - make_interval(days => (p_filters->>'engajamento_dias')::int))
        )
        select case p_filters->>'engajamento'
          when 'recebeu'    then exists (select 1 from escopo)
          when 'abriu'      then exists (select 1 from escopo where opened_at is not null)
          when 'clicou'     then exists (select 1 from escopo where clicked_at is not null)
          when 'nao_abriu'  then exists (select 1 from escopo) and not exists (select 1 from escopo where opened_at is not null)
          when 'nao_clicou' then exists (select 1 from escopo) and not exists (select 1 from escopo where clicked_at is not null)
          else true
        end
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.populate_email_campaign_leads(p_campaign_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      (v_filters->>'onboarding_status') IS NULL
      OR (v_filters->>'onboarding_status') = 'any'
      OR ((v_filters->>'onboarding_status') = 'completed' AND l.onboarding_completed_at IS NOT NULL)
      OR ((v_filters->>'onboarding_status') = 'pending' AND l.onboarding_completed_at IS NULL)
    )
    AND (
      (v_filters->>'exclude_campaign_days') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM email_campaign_leads ecl
        WHERE ecl.lead_id = l.id
          AND ecl.status IN ('sent','delivered','opened','clicked')
          AND ecl.sent_at > now() - ((v_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    )
    AND public.email_filtros_extras_ok(l.id, l.board_id, l.column_id, l.tags, v_filters)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE email_campaigns SET total_leads = v_count, total_recipients = v_count, updated_at = now()
  WHERE id = p_campaign_id;
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_email_audience_count(p_filters jsonb DEFAULT '{}'::jsonb)
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
      (p_filters->>'onboarding_status') IS NULL
      OR (p_filters->>'onboarding_status') = 'any'
      OR ((p_filters->>'onboarding_status') = 'completed' AND l.onboarding_completed_at IS NOT NULL)
      OR ((p_filters->>'onboarding_status') = 'pending' AND l.onboarding_completed_at IS NULL)
    )
    AND (
      (p_filters->>'exclude_campaign_days') IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM email_campaign_leads ecl
        WHERE ecl.lead_id = l.id
          AND ecl.status IN ('sent','delivered','opened','clicked')
          AND ecl.sent_at > now() - ((p_filters->>'exclude_campaign_days')::int || ' days')::interval
      )
    )
    AND public.email_filtros_extras_ok(l.id, l.board_id, l.column_id, l.tags, p_filters);

  RETURN v_count;
END;
$function$;
