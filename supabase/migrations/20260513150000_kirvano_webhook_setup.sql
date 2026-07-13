-- ===========================================================
-- KIRVANO WEBHOOK SETUP
-- 1) sales_events.dedupe_key  → idempotência (Kirvano reenvia)
-- 2) ai_sales_agents.cadence_steps  → 3 toques para carrinho abandonado
--    da Masterclass IA + 1 toque para PIX/Boleto expirado + 1 para recusado
-- ===========================================================

-- 1) Coluna de idempotência
ALTER TABLE public.sales_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_events_source_dedupe
  ON public.sales_events(source, dedupe_key, created_at DESC)
  WHERE dedupe_key IS NOT NULL;

-- 2) Seed da cadência no agente default
-- Merge (`||`) preserva qualquer cadência já existente (ex.: lead_novo).
UPDATE public.ai_sales_agents
SET cadence_steps = COALESCE(cadence_steps, '{}'::jsonb) || jsonb_build_object(

  -- ============================================================
  -- CARRINHO ABANDONADO MASTERCLASS — 3 toques
  -- Best practice (Hotmart/Shopify): 15min, 2h, 24h
  -- Tom: natural, acolhedor, NÃO comercial
  -- ============================================================
  'masterclass_cart_abandoned', jsonb_build_array(
    jsonb_build_object(
      'type', 'ai_message',
      'prompt',
      'Voce viu que ESTE lead abriu o checkout da Masterclass IA para Negocios mas nao finalizou a compra. Sua tarefa: iniciar uma conversa curta, natural e acolhedora no WhatsApp. ' ||
      'IMPORTANTE: nao mencione que viu o carrinho abandonado de forma direta — soe natural, como uma pessoa real perguntando. ' ||
      'Tom: amigavel, sem pressao comercial. Pergunte de forma genuina se ele teve alguma duvida sobre o evento ou se ficou alguma pergunta sobre a Masterclass. ' ||
      'Use no maximo 2-3 linhas. Termine com uma pergunta aberta.',
      'delay_hours', 0.25
    ),
    jsonb_build_object(
      'type', 'ai_message',
      'prompt',
      'Segundo toque (caso o lead nao tenha respondido a primeira mensagem). Retome a conversa de forma leve, sem cobrar resposta. ' ||
      'Mencione UM beneficio concreto da Masterclass IA para Negocios (ex.: aula ao vivo com casos reais, acesso ao grupo de alunos, material complementar). ' ||
      'Tom: humano e direto. Pergunte se faz sentido pra ele agora ou se prefere que voce envie mais informacoes antes. Maximo 3 linhas.',
      'delay_hours', 2
    ),
    jsonb_build_object(
      'type', 'ai_message',
      'prompt',
      'Terceira e ultima tentativa (24h apos a primeira). Seja mais direto mas respeitoso: pergunte se ele quer garantir a vaga antes do evento ou se prefere passar dessa edicao. ' ||
      'Use prova social leve (ex.: "ja temos alunos super engajados no grupo"). Nao use urgencia falsa. ' ||
      'Se nao houver resposta apos esta mensagem, encerre o follow-up. Maximo 3 linhas. Termine deixando porta aberta ("se mudar de ideia, e so chamar").',
      'delay_hours', 24
    )
  ),

  -- ============================================================
  -- PIX / BOLETO EXPIRADO — 1 toque imediato
  -- Lead JA tentou comprar — recuperacao alta probabilidade
  -- ============================================================
  'masterclass_pix_expired', jsonb_build_array(
    jsonb_build_object(
      'type', 'ai_message',
      'prompt',
      'O codigo PIX (ou boleto) que ESTE lead gerou para a Masterclass IA expirou sem pagamento. Sua tarefa: falar com ele de forma natural pelo WhatsApp. ' ||
      'Pergunte se quer que voce gere um novo PIX, se prefere pagar de outra forma (cartao), ou se houve algum problema com o pagamento. ' ||
      'Tom: prestativo, sem pressao. Maximo 2 linhas. Termine com uma pergunta clara para ele responder.',
      'delay_hours', 0.5
    )
  ),

  -- ============================================================
  -- CARTAO RECUSADO — 1 toque leve
  -- ============================================================
  'masterclass_sale_refused', jsonb_build_array(
    jsonb_build_object(
      'type', 'ai_message',
      'prompt',
      'O cartao deste lead foi recusado no checkout da Masterclass IA. Sua tarefa: avisa-lo de forma discreta pelo WhatsApp e oferecer alternativas (outro cartao, PIX, boleto). ' ||
      'Tom: empatico (nao constrangedor). Maximo 2 linhas. Pergunte de forma aberta como pode ajudar.',
      'delay_hours', 0.5
    )
  )
)
WHERE is_default = true
  AND is_active = true;

-- Comentario para futuros devs
COMMENT ON COLUMN public.sales_events.dedupe_key IS
  'Chave de idempotencia (ex.: kirvano: EVENT:transaction_id). Webhook providers (Kirvano, Hotmart) reenviam o mesmo evento em caso de timeout.';
