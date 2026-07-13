-- ============================================================
-- Alerta diario de engajamento pro CS
--
-- Funcao SQL run_daily_engagement_alert() detecta membros at-risk
-- (em_risco ou inativo) que nao foram alertados nos ultimos 7 dias
-- e dispara WhatsApp pro CS via uazapi-proxy. Idempotente: registra
-- cada alerta em member_milestones pra evitar reenvio.
--
-- Agendamento via pg_cron: roda diario as 09h BRT (12h UTC).
--
-- Nao precisa de edge function nova (plan limit). pg_cron chama
-- uazapi-proxy direto via net.http_post.
-- ============================================================

CREATE OR REPLACE FUNCTION public.run_daily_engagement_alert()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cs_phone     text;
  instance_id  uuid;
  member_rec   RECORD;
  message_body text;
  alert_type   text;
  alerts_sent  int := 0;
  alerts_skip  int := 0;
  result       jsonb;
BEGIN
  -- Resolve contato CS (telefone)
  SELECT NULLIF(regexp_replace(account_id, '\D', '', 'g'), '')
    INTO cs_phone
    FROM public.integration_keys
   WHERE service = 'cs_contact' AND COALESCE(is_active, true)
   LIMIT 1;

  IF cs_phone IS NULL THEN
    RETURN jsonb_build_object('error', 'CS contact nao configurado em integration_keys.cs_contact (account_id = telefone)');
  END IF;

  -- Instancia WhatsApp
  SELECT id INTO instance_id
    FROM public.whatsapp_instances
   WHERE status = 'connected'
   ORDER BY created_at DESC
   LIMIT 1;

  IF instance_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Nenhuma instancia WhatsApp conectada');
  END IF;

  -- Itera membros at risk nao alertados em 7 dias
  FOR member_rec IN
    SELECT
      m.id,
      m.name,
      m.phone,
      m.email,
      FLOOR(EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400)::int AS days_since,
      CASE
        WHEN EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400 > 30 THEN 'inativo'
        WHEN EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400 > 10 THEN 'em_risco'
        ELSE NULL
      END AS classification
    FROM public.members m
    WHERE m.status = 'active'
      AND EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400 > 10
      AND NOT EXISTS (
        SELECT 1 FROM public.member_milestones mm
         WHERE mm.member_id = m.id
           AND mm.milestone_type LIKE 'cs_alert_%'
           AND mm.earned_at > now() - interval '7 days'
      )
    ORDER BY m.last_active_at NULLS FIRST
  LOOP
    alert_type := 'cs_alert_' || member_rec.classification;
    message_body :=
      CASE WHEN member_rec.classification = 'inativo' THEN '⚫ *Engajamento INATIVO*' ELSE '🔴 *Engajamento EM RISCO*' END
      || E'\n\n'
      || '*Aluno:* ' || COALESCE(member_rec.name, '-') || E'\n'
      || '*Telefone:* ' || COALESCE(member_rec.phone, '-') || E'\n'
      || '*Email:* ' || COALESCE(member_rec.email, '-') || E'\n'
      || '*Dias sem acessar:* ' || member_rec.days_since || E'\n\n'
      || 'Vale uma mensagem manual pra resgatar antes do churn. Detalhes em /admin/membros (badge no nome).';

    -- Dispara WhatsApp via uazapi-proxy
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/uazapi-proxy',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type',  'application/json'
      ),
      body := jsonb_build_object(
        'action',       'send_text',
        'instance_id',  instance_id,
        'phone',        cs_phone,
        'message',      message_body,
        'sent_by',      'engagement-alert'
      )
    );

    -- Log do alerta
    INSERT INTO public.member_milestones (member_id, milestone_type, milestone_name, description, xp_earned)
    VALUES (
      member_rec.id,
      alert_type,
      'Alerta CS: ' || upper(member_rec.classification),
      'CS notificado por ' || member_rec.days_since || ' dias sem acesso',
      0
    );

    alerts_sent := alerts_sent + 1;
  END LOOP;

  result := jsonb_build_object(
    'alerted', alerts_sent,
    'skipped', alerts_skip,
    'ran_at',  now()
  );
  RETURN result;
END $$;

COMMENT ON FUNCTION public.run_daily_engagement_alert() IS
  'Detecta membros em_risco (10+ dias sem acessar) ou inativos (30+) e dispara WhatsApp pro CS. '
  'Idempotente: 1 alerta por membro por semana. Chamada pelo cron diario engagement-daily-alert.';

-- Agendamento via pg_cron (diario 12h UTC = 09h BRT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('engagement-daily-alert') WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'engagement-daily-alert'
    );
    PERFORM cron.schedule(
      'engagement-daily-alert',
      '0 12 * * *',
      $cron$ SELECT public.run_daily_engagement_alert(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron nao disponivel — chamar run_daily_engagement_alert() manualmente.';
  END IF;
END $$;
