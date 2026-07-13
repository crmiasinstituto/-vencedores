-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: Iniciativa "Masterclass IA — Junho/2026" + 5 Links UTM
-- ═══════════════════════════════════════════════════════════════════════════

-- Iniciativa estratégica (linkada ao briefing default da SQUAAD)
INSERT INTO public.marketing_initiatives (
  briefing_id,
  nome, tipo, fase,
  objetivo, produto, ticket, budget,
  data_inicio, data_evento, data_fim,
  publico_alvo,
  mecanismo, promessa_principal,
  cpl_max, cpa_max,
  status, notes
)
SELECT
  (SELECT id FROM public.marketing_briefing WHERE is_default = true LIMIT 1),
  'Masterclass IA — Junho/2026',
  'lancamento',
  'captacao',
  'Captacao de leads (16/05 a 31/05) + venda da Masterclass IA em junho/2026',
  'Masterclass IA SQUAAD — Junho/2026',
  NULL, -- ticket a definir
  NULL, -- budget total a definir
  '2026-05-16',
  NULL, -- data do evento (junho, ainda nao definida)
  NULL, -- data fim (apos evento)
  '{"temperatura": "frio_morno", "perfil": "empresario_30k_mes_preso_operacional", "nivel_consciencia": 3, "canais_meta": ["feed", "stories", "reels"]}'::jsonb,
  'Masterclass ao vivo — empresarios constroem suas proprias solucoes com IA',
  'Aprender a construir solucoes com IA na propria empresa, em 1 masterclass',
  15, -- CPL max sugerido frio (R$)
  NULL, -- CPA max apos definir ticket
  'ativo',
  'Lancamento sabado 16/05/2026. Evento em junho (data TBD). Captacao Meta Ads (feed+stories+reels) frio + remkt + organico bio.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_initiatives WHERE nome = 'Masterclass IA — Junho/2026'
)
RETURNING id, nome, tipo, fase, data_inicio, status;

-- 5 Links UTM rastreaveis (utm_campaign=mc-ia-junho-2026)
-- base_url temporaria: WhatsApp default. Trocar para LP final quando estiver pronta.
INSERT INTO public.utm_links (name, base_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content, full_url, is_active)
VALUES
  ('MC IA Junho — Meta Feed Frio',     'https://wa.me/5575999999999', 'instagram', 'cpc',    'mc-ia-junho-2026', 'frio',  'feed-frio',     'https://wa.me/5575999999999?utm_source=instagram&utm_medium=cpc&utm_campaign=mc-ia-junho-2026&utm_term=frio&utm_content=feed-frio',      true),
  ('MC IA Junho — Meta Stories Frio',  'https://wa.me/5575999999999', 'instagram', 'cpc',    'mc-ia-junho-2026', 'frio',  'stories-frio',  'https://wa.me/5575999999999?utm_source=instagram&utm_medium=cpc&utm_campaign=mc-ia-junho-2026&utm_term=frio&utm_content=stories-frio',   true),
  ('MC IA Junho — Meta Reels Frio',    'https://wa.me/5575999999999', 'instagram', 'cpc',    'mc-ia-junho-2026', 'frio',  'reels-frio',    'https://wa.me/5575999999999?utm_source=instagram&utm_medium=cpc&utm_campaign=mc-ia-junho-2026&utm_term=frio&utm_content=reels-frio',     true),
  ('MC IA Junho — Meta Remarketing',   'https://wa.me/5575999999999', 'meta',      'cpc',    'mc-ia-junho-2026', 'morno', 'remarketing',   'https://wa.me/5575999999999?utm_source=meta&utm_medium=cpc&utm_campaign=mc-ia-junho-2026&utm_term=morno&utm_content=remarketing',        true),
  ('MC IA Junho — Organico Bio IG',    'https://wa.me/5575999999999', 'instagram', 'organico','mc-ia-junho-2026','quente','bio-link',      'https://wa.me/5575999999999?utm_source=instagram&utm_medium=organico&utm_campaign=mc-ia-junho-2026&utm_term=quente&utm_content=bio-link', true)
ON CONFLICT DO NOTHING;

-- Verificacao
SELECT 'iniciativa' AS tipo, nome AS item, status, data_inicio::text AS data
  FROM public.marketing_initiatives
  WHERE nome = 'Masterclass IA — Junho/2026'
UNION ALL
SELECT 'utm_link', name, CASE WHEN is_active THEN 'ativo' ELSE 'inativo' END, utm_content
  FROM public.utm_links
  WHERE utm_campaign = 'mc-ia-junho-2026'
  ORDER BY 1, 2;
