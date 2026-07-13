
-- Sales Playbooks table
CREATE TABLE public.sales_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read sales_playbooks" ON public.sales_playbooks FOR SELECT USING (true);
CREATE POLICY "Allow public insert sales_playbooks" ON public.sales_playbooks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update sales_playbooks" ON public.sales_playbooks FOR UPDATE USING (true);
CREATE POLICY "Allow public delete sales_playbooks" ON public.sales_playbooks FOR DELETE USING (true);

-- Coach Sessions table
CREATE TABLE public.coach_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_history_id UUID REFERENCES public.call_history(id),
  playbook_id UUID REFERENCES public.sales_playbooks(id),
  current_phase TEXT,
  checklist_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
  insights JSONB NOT NULL DEFAULT '[]'::jsonb,
  score INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read coach_sessions" ON public.coach_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert coach_sessions" ON public.coach_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update coach_sessions" ON public.coach_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete coach_sessions" ON public.coach_sessions FOR DELETE USING (true);

-- Insert default playbook
INSERT INTO public.sales_playbooks (name, description, is_default, phases) VALUES (
  'Playbook Padrão SQUAAD',
  'Playbook de vendas consultivas com 4 fases: Abertura, Qualificação, Proposta e Fechamento',
  true,
  '[
    {
      "id": "abertura",
      "name": "Abertura",
      "order": 1,
      "checklist": [
        "Chamar o lead pelo nome",
        "Fazer rapport (conexão pessoal)",
        "Confirmar disponibilidade de tempo"
      ],
      "rules": [
        "NÃO falar de preço nesta fase",
        "NÃO apresentar produto ainda",
        "NÃO pular direto para qualificação sem rapport"
      ]
    },
    {
      "id": "qualificacao",
      "name": "Qualificação",
      "order": 2,
      "checklist": [
        "Identificar a dor principal do lead",
        "Perguntar sobre soluções atuais",
        "Entender o orçamento disponível",
        "Descobrir quem decide a compra",
        "Mapear urgência e timeline"
      ],
      "rules": [
        "NÃO apresentar solução antes de entender a dor",
        "NÃO assumir que sabe o problema sem perguntar",
        "Fazer perguntas abertas, não fechadas"
      ]
    },
    {
      "id": "proposta",
      "name": "Proposta",
      "order": 3,
      "checklist": [
        "Apresentar solução conectada à dor identificada",
        "Mostrar cases ou provas sociais",
        "Apresentar valores e condições",
        "Tratar objeções com empatia"
      ],
      "rules": [
        "NÃO dar desconto sem antes mostrar valor",
        "Conectar cada feature a uma dor específica do lead",
        "Usar linguagem do lead, não jargão técnico"
      ]
    },
    {
      "id": "fechamento",
      "name": "Fechamento",
      "order": 4,
      "checklist": [
        "Fazer pergunta de fechamento",
        "Definir próximos passos claros",
        "Confirmar dados para contrato/proposta",
        "Agradecer e reforçar a decisão"
      ],
      "rules": [
        "NÃO pressionar excessivamente",
        "Se lead não está pronto, agendar follow-up",
        "Sempre terminar com próximo passo definido"
      ]
    }
  ]'::jsonb
);
