-- Perguntas escritas dos participantes durante uma reuniao ao vivo
-- (botao "Mandar pergunta"). O mentor/host le e responde em voz alta.
CREATE TABLE IF NOT EXISTS public.meet_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  livekit_room_name text,
  asker_name text,
  asker_identity text,
  content text NOT NULL CHECK (length(trim(content)) > 0),
  answered boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meet_questions_meeting_id ON public.meet_questions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meet_questions_room ON public.meet_questions(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_meet_questions_unanswered ON public.meet_questions(meeting_id, answered) WHERE answered = false;

ALTER TABLE public.meet_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert meet_questions"
ON public.meet_questions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public read meet_questions"
ON public.meet_questions
FOR SELECT
USING (true);

CREATE POLICY "Allow public update meet_questions"
ON public.meet_questions
FOR UPDATE
USING (true);

-- Habilita realtime no canal supabase pra host receber perguntas em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.meet_questions;
