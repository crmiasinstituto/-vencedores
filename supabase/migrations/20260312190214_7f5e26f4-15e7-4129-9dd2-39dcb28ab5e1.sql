
CREATE TABLE public.lead_conversation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  analyzed_at timestamptz NOT NULL DEFAULT now(),
  message_count integer DEFAULT 0,
  sentiment text,
  interest_level integer DEFAULT 0,
  key_topics jsonb DEFAULT '[]'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  pain_points jsonb DEFAULT '[]'::jsonb,
  opportunities jsonb DEFAULT '[]'::jsonb,
  suggested_actions jsonb DEFAULT '[]'::jsonb,
  raw_summary text,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.lead_conversation_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read lead_conversation_insights" ON public.lead_conversation_insights FOR SELECT TO public USING (true);
CREATE POLICY "Allow public insert lead_conversation_insights" ON public.lead_conversation_insights FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public update lead_conversation_insights" ON public.lead_conversation_insights FOR UPDATE TO public USING (true);
CREATE POLICY "Allow public delete lead_conversation_insights" ON public.lead_conversation_insights FOR DELETE TO public USING (true);

CREATE INDEX idx_lead_conversation_insights_lead_id ON public.lead_conversation_insights(lead_id);
CREATE INDEX idx_lead_conversation_insights_analyzed_at ON public.lead_conversation_insights(analyzed_at DESC);
