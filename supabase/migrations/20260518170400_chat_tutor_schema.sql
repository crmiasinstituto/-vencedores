-- ============================================================
-- Chat Tutor (Sprint 3.1) — schemas pro IA Tutor lateral na aula
--
-- Cada membro tem N conversas (1 por aula tipicamente). Cada conversa
-- tem N mensagens (role: user/assistant). RLS scope por member_id via
-- current_member_id() (criada em Part B).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  lesson_id   uuid REFERENCES public.member_lessons(id) ON DELETE SET NULL,
  title       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_member_lesson
  ON public.chat_conversations(member_id, lesson_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created
  ON public.chat_messages(conversation_id, created_at);

-- RLS scope por member
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Member own conversations"
  ON public.chat_conversations
  FOR ALL
  USING (
    member_id = public.current_member_id()
    OR public.is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    member_id = public.current_member_id()
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Member own messages"
  ON public.chat_messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.chat_conversations
       WHERE member_id = public.current_member_id()
    )
    OR public.is_admin()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.chat_conversations
       WHERE member_id = public.current_member_id()
    )
    OR public.is_admin()
    OR auth.role() = 'service_role'
  );

-- RPC pra abrir/buscar conversa de uma aula (cria se nao existe).
-- Idempotente. Retorna a conversation_id.
CREATE OR REPLACE FUNCTION public.get_or_create_lesson_conversation(p_lesson_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mid uuid;
  cid uuid;
  l_title text;
BEGIN
  mid := public.current_member_id();
  IF mid IS NULL THEN
    RAISE EXCEPTION 'no member session';
  END IF;

  SELECT id INTO cid
    FROM public.chat_conversations
   WHERE member_id = mid AND lesson_id = p_lesson_id
   ORDER BY created_at DESC LIMIT 1;

  IF cid IS NOT NULL THEN RETURN cid; END IF;

  SELECT title INTO l_title FROM public.member_lessons WHERE id = p_lesson_id;
  INSERT INTO public.chat_conversations (member_id, lesson_id, title)
    VALUES (mid, p_lesson_id, COALESCE(l_title, 'Conversa'))
    RETURNING id INTO cid;
  RETURN cid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_lesson_conversation(uuid) TO anon, authenticated;
