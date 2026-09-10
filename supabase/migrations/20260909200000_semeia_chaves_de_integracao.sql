-- A aba "Chaves de Integracao" lista o que existe em integration_keys — e a tabela está
-- vazia desde sempre. Resultado: a aba aparece em branco e não há por onde cadastrar a
-- chave do modelo, então o Agente IA nunca teve como chamar a IA
-- ("ANTHROPIC_API_KEY not configured").
--
-- Semeia as linhas dos serviços que o código realmente procura, sem chave e inativas.
-- Cada uma vira um campo na tela; basta colar a chave e ativar.

insert into public.integration_keys (service, api_key, is_active, metadata)
select s.service, null, false, jsonb_build_object('display_label', s.rotulo)
from (values
  ('anthropic',      'Claude (Anthropic) — modelo padrão do Agente IA'),
  ('openai',         'OpenAI — alternativa de modelo e transcrição de áudio'),
  ('lovable',        'Lovable AI (Gemini) — usado pelo marketing-midia'),
  ('gemini',         'Google Gemini'),
  ('groq',           'Groq — inferência rápida'),
  ('scrapecreators', 'ScrapeCreators — prospecção de Instagram')
) as s(service, rotulo)
where not exists (select 1 from public.integration_keys k where k.service = s.service);
