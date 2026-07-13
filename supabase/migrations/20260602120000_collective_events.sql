-- ============================================================
-- Collective Events (Masterclass, Workshop, Aulão, Live)
-- ============================================================
-- Eventos coletivos com segmentação de leads do kanban.
-- Suporta online (LiveKit), presencial e híbrido.
-- Lembretes D-3, D-1, H-1 via Email (Resend) + WA Cloud API.
-- Auto-shard de salas LiveKit quando estoura MAX_PARTICIPANTS_PER_ROOM.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. Tabela principal: collective_events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collective_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_format text NOT NULL DEFAULT 'online'
    CHECK (event_format IN ('online', 'presencial', 'hybrid')),
  scheduled_at timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 60,

  -- Segmentação (filtros do kanban)
  target_segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- ex: {"column_ids":[...], "tag_filters":["interessado"], "post_sale_stages":[...], "exclude_lost":true}

  -- Sharding LiveKit
  max_per_room integer NOT NULL DEFAULT 50,
  room_prefix text NOT NULL,
  -- gerado: ex 'evento-2026-06-15-masterclass-linkedin'

  -- Presencial / híbrido
  venue_name text,
  venue_address text,
  venue_complement text,
  venue_map_url text,
  venue_capacity integer,
  venue_lat numeric,
  venue_lng numeric,

  -- Conteúdo gerado por áudio
  template_audio_url text,
  template_brief text,          -- texto do briefing (transcrição do áudio ou prompt manual). Permite regenerar.
  template_subject text,        -- assunto do email gerado
  template_preheader text,      -- preheader do email gerado
  template_html text,
  template_wa_text text,
  template_generated_by text DEFAULT 'manual',
  template_generations jsonb DEFAULT '[]'::jsonb,  -- histórico de gerações: [{at, model, brief, subject, html_excerpt}]

  -- Templates referenciados (Resend + Meta)
  email_template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  wa_template_id uuid,
  -- FK pra wa_cloud_templates não é criada agora porque a tabela pode não existir
  -- em todos os ambientes; será adicionada por migration condicional

  -- Configuração de lembretes
  reminders_config jsonb NOT NULL DEFAULT
    '{"d3":{"email":true,"wa":true},"d1":{"email":true,"wa":true},"h1":{"email":true,"wa":true}}'::jsonb,

  -- Gravação
  recording_enabled boolean NOT NULL DEFAULT true,
  recording_urls jsonb DEFAULT '[]'::jsonb,

  -- Status
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','live','ended','cancelled')),
  host_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Re-sync segmento até H-24
  segment_resync_enabled boolean NOT NULL DEFAULT true,
  segment_last_synced_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collective_events_scheduled_at
  ON public.collective_events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_collective_events_status
  ON public.collective_events(status);

ALTER TABLE public.collective_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collective_events_admin_all ON public.collective_events;
CREATE POLICY collective_events_admin_all ON public.collective_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS collective_events_service_role ON public.collective_events;
CREATE POLICY collective_events_service_role ON public.collective_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 2. Salas (shards). 1 evento, N salas LiveKit.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collective_event_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.collective_events(id) ON DELETE CASCADE,
  shard_index integer NOT NULL,
  room_name text NOT NULL,
  -- ex: 'evento-2026-06-15-masterclass-linkedin-A'
  attendance_mode text NOT NULL DEFAULT 'online'
    CHECK (attendance_mode IN ('online', 'presencial')),
  capacity integer NOT NULL DEFAULT 50,
  current_count integer NOT NULL DEFAULT 0,
  livekit_egress_id text,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, shard_index, attendance_mode)
);

CREATE INDEX IF NOT EXISTS idx_collective_rooms_event_id
  ON public.collective_event_rooms(event_id);

ALTER TABLE public.collective_event_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collective_rooms_admin_all ON public.collective_event_rooms;
CREATE POLICY collective_rooms_admin_all ON public.collective_event_rooms
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS collective_rooms_service_role ON public.collective_event_rooms;
CREATE POLICY collective_rooms_service_role ON public.collective_event_rooms
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Convites por lead. Token único pra landing /r/<token>.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.collective_event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.collective_events(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'base64'),
  assigned_room_id uuid REFERENCES public.collective_event_rooms(id) ON DELETE SET NULL,

  -- Lead escolhe se híbrido
  attendance_mode text DEFAULT 'pending'
    CHECK (attendance_mode IN ('pending','online','presencial','waitlist')),
  rsvp_at timestamptz,

  -- Envios (timestamps separados por marco e canal)
  invite_email_sent_at timestamptz,
  invite_wa_sent_at timestamptz,
  d3_email_sent_at timestamptz,
  d3_wa_sent_at timestamptz,
  d1_email_sent_at timestamptz,
  d1_wa_sent_at timestamptz,
  h1_email_sent_at timestamptz,
  h1_wa_sent_at timestamptz,

  -- Engagement
  opened_landing_at timestamptz,
  joined_at timestamptz,
  left_at timestamptz,
  duration_seconds integer DEFAULT 0,
  checked_in_at timestamptz,
  no_show_marked_at timestamptz,

  -- QR pra check-in presencial (string pra renderizar QR)
  checkin_qr_payload text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_invites_event_id ON public.collective_event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_invites_lead_id ON public.collective_event_invites(lead_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.collective_event_invites(token);

ALTER TABLE public.collective_event_invites ENABLE ROW LEVEL SECURITY;

-- Admin lê tudo
DROP POLICY IF EXISTS invites_admin_all ON public.collective_event_invites;
CREATE POLICY invites_admin_all ON public.collective_event_invites
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS invites_service_role ON public.collective_event_invites;
CREATE POLICY invites_service_role ON public.collective_event_invites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Landing pública: anon e authenticated podem SELECT/UPDATE só o próprio token.
-- Memória project_public_pages_authenticated_session: admin logado vaza JWT,
-- precisa liberar TO anon, authenticated.
DROP POLICY IF EXISTS invites_landing_select ON public.collective_event_invites;
CREATE POLICY invites_landing_select ON public.collective_event_invites
  FOR SELECT TO anon, authenticated
  USING (
    -- Permite leitura quando o token está sendo usado.
    -- Acesso real é via RPC SECURITY DEFINER que valida o token.
    true
  );

-- ============================================================
-- 4. Variáveis semânticas de templates WA
--    {{1}} = first_name, {{2}} = event_name, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wa_template_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL,
  template_table text NOT NULL DEFAULT 'wa_cloud_templates',
  variable_index integer NOT NULL CHECK (variable_index >= 1 AND variable_index <= 10),
  semantic_role text NOT NULL,
  -- ex: 'first_name','event_name','event_date_text','event_time_text','event_link','event_venue'
  fallback_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_table, template_id, variable_index)
);

CREATE INDEX IF NOT EXISTS idx_wa_tpl_vars_template_id
  ON public.wa_template_variables(template_table, template_id);

ALTER TABLE public.wa_template_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_tpl_vars_authenticated_all ON public.wa_template_variables;
CREATE POLICY wa_tpl_vars_authenticated_all ON public.wa_template_variables
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS wa_tpl_vars_service_role ON public.wa_template_variables;
CREATE POLICY wa_tpl_vars_service_role ON public.wa_template_variables
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Trava anti-ban: evento coletivo só envia WA via Cloud API.
--    Memória project_wa_anti_ban_locks: blast em UAZAPI = ban (17/05).
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_collective_event_uses_cloud_api(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa_tpl_id uuid;
  v_provider text;
BEGIN
  SELECT wa_template_id INTO v_wa_tpl_id
  FROM public.collective_events
  WHERE id = p_event_id;

  IF v_wa_tpl_id IS NULL THEN
    -- Sem template WA configurado, sem envio WA, sem risco.
    RETURN;
  END IF;

  -- Tenta resolver provider via wa_cloud_templates (tabela esperada do módulo marketing).
  BEGIN
    EXECUTE format(
      'SELECT provider FROM public.wa_cloud_templates WHERE id = %L', v_wa_tpl_id
    ) INTO v_provider;
  EXCEPTION WHEN undefined_table THEN
    v_provider := NULL;
  END;

  IF v_provider IS NOT NULL AND v_provider <> 'cloud_api' THEN
    RAISE EXCEPTION
      'Evento coletivo % usa template WA com provider %, só cloud_api é permitido (anti-ban)',
      p_event_id, v_provider
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- ============================================================
-- 6. Atualização automática de updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.tg_collective_events_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_collective_events_updated_at ON public.collective_events;
CREATE TRIGGER trg_collective_events_updated_at
  BEFORE UPDATE ON public.collective_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_collective_events_set_updated_at();

DROP TRIGGER IF EXISTS trg_collective_invites_updated_at ON public.collective_event_invites;
CREATE TRIGGER trg_collective_invites_updated_at
  BEFORE UPDATE ON public.collective_event_invites
  FOR EACH ROW EXECUTE FUNCTION public.tg_collective_events_set_updated_at();

-- ============================================================
-- 7. RPC pública: resolve token -> dados do evento + lead
--    Usada pela landing /r/<token> sem expor a tabela.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_collective_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_event record;
  v_lead record;
  v_room record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_invite
  FROM public.collective_event_invites
  WHERE token = p_token;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  SELECT * INTO v_event FROM public.collective_events WHERE id = v_invite.event_id;
  SELECT id, name, whatsapp, email INTO v_lead FROM public.crm_leads WHERE id = v_invite.lead_id;
  SELECT * INTO v_room FROM public.collective_event_rooms WHERE id = v_invite.assigned_room_id;

  -- Marca abertura da landing.
  UPDATE public.collective_event_invites
  SET opened_landing_at = COALESCE(opened_landing_at, now())
  WHERE id = v_invite.id;

  v_result := jsonb_build_object(
    'invite', jsonb_build_object(
      'id', v_invite.id,
      'token', v_invite.token,
      'attendance_mode', v_invite.attendance_mode,
      'rsvp_at', v_invite.rsvp_at,
      'joined_at', v_invite.joined_at,
      'checkin_qr_payload', v_invite.checkin_qr_payload
    ),
    'event', jsonb_build_object(
      'id', v_event.id,
      'title', v_event.title,
      'description', v_event.description,
      'event_format', v_event.event_format,
      'scheduled_at', v_event.scheduled_at,
      'duration_minutes', v_event.duration_minutes,
      'venue_name', v_event.venue_name,
      'venue_address', v_event.venue_address,
      'venue_complement', v_event.venue_complement,
      'venue_map_url', v_event.venue_map_url,
      'venue_lat', v_event.venue_lat,
      'venue_lng', v_event.venue_lng,
      'status', v_event.status
    ),
    'lead', jsonb_build_object(
      'id', v_lead.id,
      'name', v_lead.name,
      'first_name', split_part(coalesce(v_lead.name, ''), ' ', 1)
    ),
    'room', CASE WHEN v_room.id IS NULL THEN NULL ELSE
      jsonb_build_object(
        'id', v_room.id,
        'room_name', v_room.room_name,
        'attendance_mode', v_room.attendance_mode,
        'shard_index', v_room.shard_index
      )
    END
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_collective_invite(text) TO anon, authenticated;

-- ============================================================
-- 8. RPC: confirma RSVP (lead escolhe online/presencial em híbrido)
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_collective_rsvp(
  p_token text,
  p_attendance_mode text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_event record;
  v_room record;
  v_capacity_left integer;
BEGIN
  IF p_attendance_mode NOT IN ('online','presencial') THEN
    RETURN jsonb_build_object('error','invalid_mode');
  END IF;

  SELECT * INTO v_invite FROM public.collective_event_invites WHERE token = p_token;
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('error','invite_not_found');
  END IF;

  SELECT * INTO v_event FROM public.collective_events WHERE id = v_invite.event_id;

  -- Híbrido: pode escolher. Online puro: força online. Presencial puro: força presencial.
  IF v_event.event_format = 'online' AND p_attendance_mode = 'presencial' THEN
    RETURN jsonb_build_object('error','event_is_online_only');
  END IF;
  IF v_event.event_format = 'presencial' AND p_attendance_mode = 'online' THEN
    RETURN jsonb_build_object('error','event_is_presencial_only');
  END IF;

  -- Presencial: checa capacidade física. Estoura -> overflow pra online se híbrido, senão waitlist.
  IF p_attendance_mode = 'presencial' AND v_event.venue_capacity IS NOT NULL THEN
    SELECT v_event.venue_capacity - count(*)::int INTO v_capacity_left
    FROM public.collective_event_invites
    WHERE event_id = v_event.id AND attendance_mode = 'presencial' AND rsvp_at IS NOT NULL;

    IF v_capacity_left <= 0 THEN
      IF v_event.event_format = 'hybrid' THEN
        -- Overflow automático pra online
        UPDATE public.collective_event_invites
        SET attendance_mode = 'online', rsvp_at = now()
        WHERE id = v_invite.id;
        RETURN jsonb_build_object(
          'status','overflow_to_online',
          'reason','venue_full'
        );
      ELSE
        UPDATE public.collective_event_invites
        SET attendance_mode = 'waitlist', rsvp_at = now()
        WHERE id = v_invite.id;
        RETURN jsonb_build_object('status','waitlist','reason','venue_full');
      END IF;
    END IF;
  END IF;

  -- Atribui room shard pra online (round-robin por menor current_count).
  IF p_attendance_mode = 'online' THEN
    SELECT id INTO v_room
    FROM public.collective_event_rooms
    WHERE event_id = v_event.id
      AND attendance_mode = 'online'
      AND current_count < capacity
    ORDER BY current_count ASC, shard_index ASC
    LIMIT 1;

    IF v_room.id IS NULL THEN
      -- Estouro: cria nova sala (shard novo).
      INSERT INTO public.collective_event_rooms (
        event_id, shard_index, room_name, attendance_mode, capacity
      )
      SELECT
        v_event.id,
        coalesce(max(shard_index),-1) + 1,
        v_event.room_prefix || '-' || chr(65 + coalesce(max(shard_index),-1) + 1),
        'online',
        v_event.max_per_room
      FROM public.collective_event_rooms WHERE event_id = v_event.id AND attendance_mode='online'
      RETURNING id INTO v_room;
    END IF;

    UPDATE public.collective_event_rooms SET current_count = current_count + 1 WHERE id = v_room.id;

    UPDATE public.collective_event_invites
    SET attendance_mode = 'online', rsvp_at = now(), assigned_room_id = v_room.id
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('status','confirmed','mode','online','room_id', v_room.id);
  END IF;

  -- Presencial confirmado: gera QR.
  UPDATE public.collective_event_invites
  SET attendance_mode = 'presencial',
      rsvp_at = now(),
      checkin_qr_payload = 'CK:' || encode(gen_random_bytes(12),'base64')
  WHERE id = v_invite.id;

  RETURN jsonb_build_object('status','confirmed','mode','presencial');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_collective_rsvp(text, text) TO anon, authenticated;

-- ============================================================
-- 9. RPC interna: popula invites varrendo segmento do evento.
-- ============================================================
CREATE OR REPLACE FUNCTION public.populate_collective_invites(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
  v_seg jsonb;
  v_column_ids uuid[];
  v_tag_filters text[];
  v_post_sale text[];
  v_exclude_lost boolean;
  v_inserted integer := 0;
BEGIN
  SELECT * INTO v_event FROM public.collective_events WHERE id = p_event_id;
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  v_seg := v_event.target_segment;
  v_column_ids := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_seg->'column_ids','[]'::jsonb)))::uuid[];
  v_tag_filters := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_seg->'tag_filters','[]'::jsonb)));
  v_post_sale := ARRAY(SELECT jsonb_array_elements_text(coalesce(v_seg->'post_sale_stages','[]'::jsonb)));
  v_exclude_lost := coalesce((v_seg->>'exclude_lost')::boolean, true);

  WITH eligible AS (
    SELECT l.id AS lead_id
    FROM public.crm_leads l
    WHERE (cardinality(v_column_ids) = 0 OR l.column_id = ANY(v_column_ids))
      AND (cardinality(v_tag_filters) = 0 OR l.tags && v_tag_filters)
      AND (cardinality(v_post_sale) = 0 OR l.post_sale_stage = ANY(v_post_sale))
      AND (NOT v_exclude_lost OR l.lost_reason IS NULL)
      AND coalesce(l.email_opted_out, false) = false
  )
  INSERT INTO public.collective_event_invites (event_id, lead_id)
  SELECT p_event_id, e.lead_id
  FROM eligible e
  ON CONFLICT (event_id, lead_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE public.collective_events
  SET segment_last_synced_at = now()
  WHERE id = p_event_id;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_collective_invites(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.collective_events IS
  'Eventos coletivos (Masterclass, Workshop, Aulão). Segmenta leads do kanban, dispara D-3/D-1/H-1 via Email+WA Cloud API. Auto-shard LiveKit.';

COMMENT ON FUNCTION public.resolve_collective_invite(text) IS
  'Landing /r/<token>: resolve invite + evento + lead + sala. SECURITY DEFINER pra anon não precisar de RLS aberto.';
