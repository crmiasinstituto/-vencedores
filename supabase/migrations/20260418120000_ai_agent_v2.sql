-- =========================================================
-- AI AGENT V2 FOUNDATION
-- Stateful AI sales agent (inspired by crm-ai-first-template 2.0)
-- Runs in parallel with the existing simpler agent; once validated,
-- the whatsapp webhook will be switched to call the v2.
-- =========================================================

-- 1) Config table for each agent persona + LLM settings
CREATE TABLE IF NOT EXISTS public.ai_sales_agents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  system_prompt text NOT NULL,
  persona jsonb DEFAULT '{}'::jsonb,
  target_stages text[] DEFAULT ARRAY['captura', 'qualificacao'],
  provider text DEFAULT 'anthropic', -- anthropic | openai | lovable-gemini
  model text DEFAULT 'claude-sonnet-4-6',
  temperature numeric(3,2) DEFAULT 0.6,
  max_tokens integer DEFAULT 1200,
  settings jsonb DEFAULT '{
    "working_days": [1,2,3,4,5,6],
    "working_hours_start": "08:00",
    "working_hours_end": "20:00",
    "timezone": "America/Sao_Paulo",
    "debounce_seconds": 8,
    "typing_speed_cpm": 260,
    "response_delay_min_ms": 1500,
    "response_delay_max_ms": 4500,
    "auto_pause_after_human_reply": true,
    "auto_pause_minutes": 1440,
    "max_messages_per_conversation": 60,
    "max_new_contacts_per_day": 20,
    "max_followups_unreplied_per_day": 25,
    "cadence_max_messages_per_hour": 20
  }'::jsonb,
  tools_enabled text[] DEFAULT ARRAY[
    'update_lead','change_stage','schedule_meeting','create_task',
    'send_followup','transfer_to_human','query_data','mark_lost',
    'confirm_meeting','notify_human','qualify_bant'
  ],
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  board_id uuid,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  cadence_steps jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) Stateful conversation per lead (holds message history + pause flags)
CREATE TABLE IF NOT EXISTS public.ai_agent_conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid,
  agent_id uuid REFERENCES public.ai_sales_agents(id) ON DELETE SET NULL,
  status text DEFAULT 'active', -- active | paused | closed
  messages_history jsonb DEFAULT '[]'::jsonb,
  total_messages_sent integer DEFAULT 0,
  total_messages_received integer DEFAULT 0,
  paused_by text,
  paused_at timestamptz,
  pause_reason text,
  pause_until timestamptz,
  last_processed_at timestamptz,
  last_message_id uuid,
  processing_lock timestamptz,
  bot_detection_score numeric(3,2) DEFAULT 0,
  bot_detection_flags jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) Cadence enrollments (multi-step sequences)
CREATE TABLE IF NOT EXISTS public.ai_agent_cadence_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL,
  agent_id uuid REFERENCES public.ai_sales_agents(id) ON DELETE SET NULL,
  stage text NOT NULL,
  current_step integer DEFAULT 0,
  status text DEFAULT 'active', -- active | paused | completed | cancelled
  next_action_at timestamptz,
  enrolled_at timestamptz DEFAULT now(),
  last_step_at timestamptz,
  completed_at timestamptz,
  post_action text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4) Per-agent execution logs (tokens, tool calls, errors)
CREATE TABLE IF NOT EXISTS public.ai_agent_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid REFERENCES public.ai_agent_conversations(id) ON DELETE SET NULL,
  lead_id uuid,
  agent_id uuid REFERENCES public.ai_sales_agents(id) ON DELETE SET NULL,
  log_type text NOT NULL, -- 'llm_request' | 'llm_response' | 'tool_call' | 'error' | 'skip' | 'pause' | 'rate_limit'
  data jsonb DEFAULT '{}'::jsonb,
  tokens_input integer,
  tokens_output integer,
  cost_usd numeric(10,6),
  duration_ms integer,
  created_at timestamptz DEFAULT now()
);

-- 5) Rate-limit windows for anti-ban
CREATE TABLE IF NOT EXISTS public.ai_agent_send_counts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_sales_agents(id) ON DELETE CASCADE,
  window_start timestamptz NOT NULL,
  window_type text NOT NULL, -- 'hour' | 'day'
  bucket text, -- 'new_contact' | 'followup' | 'cadence' | 'all'
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(instance_id, window_start, window_type, bucket)
);

-- 6) Notification rules (trigger conditions that alert a human)
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL, -- 'event' | 'schedule' | 'agent_signal'
  trigger_event text,         -- 'lead.qualified' | 'meeting.booked' | 'agent.handoff' | 'lead.lost'
  trigger_minutes integer,
  trigger_time time,
  trigger_days text[],
  action_channel text NOT NULL, -- 'whatsapp' | 'email' | 'in-app'
  action_target_type text,      -- 'user' | 'phone' | 'webhook'
  action_target_id text,
  action_target_phone text,
  action_instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL,
  message_template text NOT NULL,
  enabled boolean DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7) RLS: permissive for now (admin backend only; anon key does not touch these)
ALTER TABLE public.ai_sales_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_cadence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_send_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agents full access" ON public.ai_sales_agents;
CREATE POLICY "ai_agents full access" ON public.ai_sales_agents FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_conv full access" ON public.ai_agent_conversations;
CREATE POLICY "ai_conv full access" ON public.ai_agent_conversations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_cadence full access" ON public.ai_agent_cadence_enrollments;
CREATE POLICY "ai_cadence full access" ON public.ai_agent_cadence_enrollments FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_logs full access" ON public.ai_agent_logs;
CREATE POLICY "ai_logs full access" ON public.ai_agent_logs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ai_sendcount full access" ON public.ai_agent_send_counts;
CREATE POLICY "ai_sendcount full access" ON public.ai_agent_send_counts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "notif_rules full access" ON public.notification_rules;
CREATE POLICY "notif_rules full access" ON public.notification_rules FOR ALL USING (true) WITH CHECK (true);

-- 8) Indexes
CREATE INDEX IF NOT EXISTS idx_ai_conv_lead ON public.ai_agent_conversations(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_conv_status ON public.ai_agent_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ai_conv_pause_until ON public.ai_agent_conversations(pause_until) WHERE pause_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_cadence_lead ON public.ai_agent_cadence_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_cadence_next ON public.ai_agent_cadence_enrollments(next_action_at) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_ai_logs_conv ON public.ai_agent_logs(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_agent ON public.ai_agent_logs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sendcount_instance_window ON public.ai_agent_send_counts(instance_id, window_type, window_start DESC);
CREATE INDEX IF NOT EXISTS idx_notif_rules_event ON public.notification_rules(trigger_event) WHERE enabled=true;

-- 9) Seed default agent from current agent_configs (if exists) so nothing breaks
INSERT INTO public.ai_sales_agents (name, description, system_prompt, persona, provider, model, is_active, is_default, instance_id)
SELECT
  COALESCE(NULLIF(description,''), 'Agente SQUAAD'),
  'Agente migrado automaticamente da config anterior',
  COALESCE(persona, '') || E'\n\n' ||
    CASE WHEN skills IS NOT NULL AND jsonb_array_length(skills) > 0
      THEN 'Habilidades: ' || (SELECT string_agg(value::text, ', ') FROM jsonb_array_elements_text(skills)) || E'\n'
      ELSE '' END ||
    COALESCE('Produto: ' || product_info || E'\n', '') ||
    COALESCE('Restricoes: ' || restrictions, ''),
  jsonb_build_object('legacy_config_id', id::text),
  'anthropic',
  'claude-sonnet-4-6',
  true,
  true,
  instance_id
FROM public.agent_configs
WHERE NOT EXISTS (SELECT 1 FROM public.ai_sales_agents WHERE is_default = true)
LIMIT 1;
