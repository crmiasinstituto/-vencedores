-- Tabela de avaliacoes pos-aula (NPS 0-10) preenchidas pelos participantes
-- ao sair de uma reuniao em modo lesson/live-session.
CREATE TABLE IF NOT EXISTS public.meet_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  livekit_room_name text,
  participant_name text,
  participant_identity text,
  score smallint NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meet_ratings_meeting_id ON public.meet_ratings(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meet_ratings_room ON public.meet_ratings(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_meet_ratings_created_at ON public.meet_ratings(created_at DESC);

ALTER TABLE public.meet_ratings ENABLE ROW LEVEL SECURITY;

-- Participantes (anonimos ou autenticados) podem inserir sua propria avaliacao
CREATE POLICY "Allow public insert meet_ratings"
ON public.meet_ratings
FOR INSERT
WITH CHECK (true);

-- Leitura aberta (admin usa para metricas; nao ha PII sensivel)
CREATE POLICY "Allow public read meet_ratings"
ON public.meet_ratings
FOR SELECT
USING (true);
