-- ============================================================
-- Member Engagement: feed unificado + scoring + classificacao
--
-- Mapeia passo a passo de cada membro: login, aulas (started e
-- completas), perguntas IA, lives, milestones. Sem schema novo,
-- so UNION das fontes existentes.
--
-- Acesso: admin-only via is_admin() em RPC SECURITY DEFINER.
-- ============================================================

-- VIEW unificada (admin acessa via RPC; nao expor direto)
CREATE OR REPLACE VIEW public.member_activity_feed AS
SELECT
  ms.member_id                              AS member_id,
  'session'::text                           AS event_type,
  'Acessou a plataforma'::text              AS event_title,
  jsonb_build_object(
    'duration_minutes', ms.duration_minutes,
    'device_info',      ms.device_info
  )                                         AS payload,
  ms.started_at                             AS event_at
FROM public.member_sessions ms
WHERE ms.started_at IS NOT NULL

UNION ALL

SELECT
  mp.member_id,
  'lesson_completed',
  ('Concluiu aula: ' || COALESCE(ml.title, 'sem titulo')),
  jsonb_build_object(
    'lesson_id',    mp.lesson_id,
    'lesson_title', ml.title,
    'module_id',    ml.module_id,
    'duration_min', ml.duration_minutes
  ),
  mp.completed_at
FROM public.member_progress mp
LEFT JOIN public.member_lessons ml ON ml.id = mp.lesson_id
WHERE mp.completed = true AND mp.completed_at IS NOT NULL

UNION ALL

SELECT
  mp.member_id,
  'lesson_started',
  ('Comecou aula: ' || COALESCE(ml.title, 'sem titulo')),
  jsonb_build_object(
    'lesson_id',        mp.lesson_id,
    'lesson_title',     ml.title,
    'progress_percent', mp.progress_percent,
    'position_seconds', mp.video_position_seconds
  ),
  mp.created_at
FROM public.member_progress mp
LEFT JOIN public.member_lessons ml ON ml.id = mp.lesson_id
WHERE COALESCE(mp.video_position_seconds, 0) > 0
  AND COALESCE(mp.completed, false) = false

UNION ALL

SELECT
  mm.member_id,
  'milestone',
  ('Marco: ' || COALESCE(mm.milestone_name, mm.milestone_type)),
  jsonb_build_object(
    'type',        mm.milestone_type,
    'name',        mm.milestone_name,
    'xp_earned',   mm.xp_earned,
    'description', mm.description
  ),
  mm.earned_at
FROM public.member_milestones mm
WHERE mm.earned_at IS NOT NULL

UNION ALL

SELECT
  cc.member_id,
  'tutor_question',
  'Perguntou ao Tutor IA',
  jsonb_build_object(
    'lesson_id',         cc.lesson_id,
    'conversation_id',   cc.id,
    'question_preview',  left(cm.content, 140)
  ),
  cm.created_at
FROM public.chat_messages cm
JOIN public.chat_conversations cc ON cc.id = cm.conversation_id
WHERE cm.role = 'user' AND cm.created_at IS NOT NULL

UNION ALL

SELECT
  m.id,
  'live_meeting',
  ('Participou de live: ' || COALESCE(mt.title, 'sem titulo')),
  jsonb_build_object(
    'meeting_id',       mt.id,
    'title',            mt.title,
    'duration_seconds', mt.duration_seconds,
    'kind',             mt.kind
  ),
  COALESCE(mt.started_at, mt.scheduled_at)
FROM public.meetings mt
JOIN public.members m ON m.crm_lead_id = mt.lead_id
WHERE mt.lead_id IS NOT NULL
  AND mt.status IN ('completed', 'in_progress', 'scheduled')
  AND COALESCE(mt.started_at, mt.scheduled_at) IS NOT NULL;

-- Member engagement summary (single member)
CREATE OR REPLACE FUNCTION public.member_engagement_summary(p_member_id uuid)
RETURNS TABLE(
  member_id                  uuid,
  member_name                text,
  member_email               text,
  member_phone               text,
  last_active_at             timestamptz,
  days_since_last_access     int,
  total_lessons_completed    bigint,
  lessons_completed_7d       bigint,
  tutor_questions_7d         bigint,
  sessions_7d                bigint,
  live_meetings_30d          bigint,
  current_streak             int,
  engagement_score           int,
  classification             text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      m.id,
      m.name,
      m.email,
      m.phone,
      m.last_active_at,
      m.streak_current,
      EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400 AS days_since,
      (SELECT count(*) FROM public.member_progress mp WHERE mp.member_id = m.id AND mp.completed = true) AS total_done,
      (SELECT count(*) FROM public.member_progress mp WHERE mp.member_id = m.id AND mp.completed = true AND mp.completed_at > now() - interval '7 days') AS done_7d,
      (SELECT count(*) FROM public.chat_messages cm JOIN public.chat_conversations cc ON cc.id = cm.conversation_id WHERE cc.member_id = m.id AND cm.role = 'user' AND cm.created_at > now() - interval '7 days') AS tutor_7d,
      (SELECT count(*) FROM public.member_sessions mss WHERE mss.member_id = m.id AND mss.started_at > now() - interval '7 days') AS sessions_7d,
      (SELECT count(*) FROM public.meetings mt WHERE mt.lead_id = m.crm_lead_id AND mt.status = 'completed' AND COALESCE(mt.started_at, mt.scheduled_at) > now() - interval '30 days') AS lives_30d
    FROM public.members m
    WHERE m.id = p_member_id AND public.is_admin()
  )
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.last_active_at,
    GREATEST(0, FLOOR(s.days_since))::int,
    s.total_done,
    s.done_7d,
    s.tutor_7d,
    s.sessions_7d,
    s.lives_30d,
    COALESCE(s.streak_current, 0)::int,
    LEAST(100,
      (CASE WHEN s.days_since IS NULL THEN 0
            WHEN s.days_since <= 1 THEN 30
            WHEN s.days_since <= 3 THEN 20
            WHEN s.days_since <= 7 THEN 10
            ELSE 0 END)
      + LEAST(30, s.done_7d::int * 10)
      + LEAST(15, s.tutor_7d::int * 5)
      + LEAST(15, s.sessions_7d::int * 3)
      + (CASE WHEN s.lives_30d > 0 THEN 10 ELSE 0 END)
    )::int,
    CASE
      WHEN s.days_since IS NULL OR s.days_since > 30 THEN 'inativo'
      WHEN s.days_since > 10                          THEN 'em_risco'
      WHEN s.days_since > 3 OR s.done_7d = 0          THEN 'esfriando'
      ELSE                                                 'ativo'
    END
  FROM s;
$$;

GRANT EXECUTE ON FUNCTION public.member_engagement_summary(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.member_engagement_summary(uuid) FROM anon;

-- Member engagement list (todos membros, ordenado por pior score)
CREATE OR REPLACE FUNCTION public.member_engagement_list(p_status text DEFAULT 'active')
RETURNS TABLE(
  member_id                  uuid,
  member_name                text,
  member_email               text,
  member_phone               text,
  member_avatar              text,
  last_active_at             timestamptz,
  days_since_last_access     int,
  lessons_completed_7d       bigint,
  tutor_questions_7d         bigint,
  sessions_7d                bigint,
  engagement_score           int,
  classification             text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      m.id,
      m.name,
      m.email,
      m.phone,
      m.avatar_url,
      m.last_active_at,
      EXTRACT(EPOCH FROM (now() - COALESCE(m.last_active_at, m.created_at))) / 86400 AS days_since,
      (SELECT count(*) FROM public.member_progress mp WHERE mp.member_id = m.id AND mp.completed = true AND mp.completed_at > now() - interval '7 days') AS done_7d,
      (SELECT count(*) FROM public.chat_messages cm JOIN public.chat_conversations cc ON cc.id = cm.conversation_id WHERE cc.member_id = m.id AND cm.role = 'user' AND cm.created_at > now() - interval '7 days') AS tutor_7d,
      (SELECT count(*) FROM public.member_sessions mss WHERE mss.member_id = m.id AND mss.started_at > now() - interval '7 days') AS sessions_7d,
      (SELECT count(*) FROM public.meetings mt WHERE mt.lead_id = m.crm_lead_id AND mt.status = 'completed' AND COALESCE(mt.started_at, mt.scheduled_at) > now() - interval '30 days') AS lives_30d
    FROM public.members m
    WHERE (p_status IS NULL OR m.status = p_status)
      AND public.is_admin()
  )
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.avatar_url,
    s.last_active_at,
    GREATEST(0, FLOOR(s.days_since))::int,
    s.done_7d,
    s.tutor_7d,
    s.sessions_7d,
    LEAST(100,
      (CASE WHEN s.days_since IS NULL THEN 0
            WHEN s.days_since <= 1 THEN 30
            WHEN s.days_since <= 3 THEN 20
            WHEN s.days_since <= 7 THEN 10
            ELSE 0 END)
      + LEAST(30, s.done_7d::int * 10)
      + LEAST(15, s.tutor_7d::int * 5)
      + LEAST(15, s.sessions_7d::int * 3)
      + (CASE WHEN s.lives_30d > 0 THEN 10 ELSE 0 END)
    )::int,
    CASE
      WHEN s.days_since IS NULL OR s.days_since > 30 THEN 'inativo'
      WHEN s.days_since > 10                          THEN 'em_risco'
      WHEN s.days_since > 3 OR s.done_7d = 0          THEN 'esfriando'
      ELSE                                                 'ativo'
    END
  FROM s
  ORDER BY 11 ASC;  -- pior score primeiro (engagement_score)
$$;

GRANT EXECUTE ON FUNCTION public.member_engagement_list(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.member_engagement_list(text) FROM anon;

-- Timeline cronologica de um membro
CREATE OR REPLACE FUNCTION public.member_activity_timeline(p_member_id uuid, p_limit int DEFAULT 100)
RETURNS TABLE(
  event_type   text,
  event_title  text,
  payload      jsonb,
  event_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.event_type,
    f.event_title,
    f.payload,
    f.event_at
  FROM public.member_activity_feed f
  WHERE f.member_id = p_member_id
    AND public.is_admin()
  ORDER BY f.event_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;

GRANT EXECUTE ON FUNCTION public.member_activity_timeline(uuid, int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.member_activity_timeline(uuid, int) FROM anon;
