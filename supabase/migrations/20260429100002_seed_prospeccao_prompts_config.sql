-- ============================================================
-- SEED — Prompts de IA editáveis pela UI (v2 — schema JSON explícito)
-- ============================================================
-- Usados em /comercial/prospeccao/configuracoes
-- Template: substituição de {{variavel}} no edge function
-- ============================================================

INSERT INTO public.prospeccao_prompts_config (key, label, descricao, prompt_text, variables_help, ai_model, temperature, tom_voz, is_active)
VALUES

-- ============================================================
-- 1. Detectar Intent
-- ============================================================
('detectar_intent', '🔍 Detectar Intent da Busca',
 'Interpreta a query livre do vendedor e extrai nicho, cidade, UF, fontes sugeridas.',
$prompt$Você é um classificador de intenção de prospecção comercial.

O usuário digitou uma query livre buscando leads. Identifique nicho, tipo de negócio, cidade, UF, fontes recomendadas e query otimizada pra Maps.

NICHOS DISPONÍVEIS:
{{nichos_catalogo}}

REGRAS:
- "Estética" / "salão" / "spa" → nicho "estetica"
- "Dentista" / "médico" / "clínica" → nicho "saude"
- "Loja" / "moda" / "roupas" → nicho "ecommerce"
- "Restaurante" / "bar" / "café" → nicho "restaurante"
- Confiança < 0.6 → nicho "outro" e fontes ["google_maps","site","instagram"]

RETORNE APENAS JSON:
{"nicho": "estetica", "tipo": "clínica de estética", "cidade": "São Paulo", "uf": "SP", "fontes_sugeridas": ["google_maps","site","instagram","doctoralia"], "query_otimizada": "clínicas de estética em São Paulo SP", "confianca": 0.95}

QUERY DO USUÁRIO: "{{query}}"$prompt$,
 '{"query": "Texto livre do vendedor", "nichos_catalogo": "Lista dos nichos disponíveis"}'::jsonb,
 'gemini-2.5-flash', 0.2, 'neutro', true),

-- ============================================================
-- 2. Contexto de Negócio (do site)
-- ============================================================
('contexto_negocio', '🧠 Dossiê de Negócio (do site)',
 'Extrai do site: tipo, posicionamento, público, produtos, preços, diferenciais, modelo de receita, palavras-chave SEO.',
$prompt$Você é um analista de negócios sênior. Analise o site abaixo e extraia o dossiê estruturado.

URL: {{url}}
Title: {{title}}
Description: {{description}}

CONTEÚDO (markdown):
{{markdown}}

Retorne JSON ESTRITO em PT-BR (use null em campos sem dado):

{
  "tipo_negocio": "string curta",
  "segmento": "vertical específica",
  "produtos_servicos": ["3-7 itens"],
  "precos": {
    "faixa_visivel": "ex: R$ 2.4k-72k ou sem preço visível",
    "modelo": "assinatura | venda única | comissão | freemium | sob consulta",
    "ticket_medio_estimado": "baixo (<R$500) | médio (R$500-5k) | alto (R$5k-50k) | premium (>R$50k)"
  },
  "posicionamento": "1-2 frases",
  "publico_alvo": "1-2 frases",
  "modelo_receita": "como faz dinheiro",
  "diferenciais": ["3-5 itens"],
  "canais_venda": ["site direto", "Meta Ads", etc],
  "concorrentes_mencionados": [],
  "palavras_chave_seo": ["5-10 termos"],
  "estagio_maturidade": "iniciante | crescimento | consolidado | maduro",
  "sinal_de_dor_mais_obvio": "1 frase"
}$prompt$,
 '{"url": "URL do site", "title": "Title tag", "markdown": "Markdown do site capeado em ~12k chars", "description": "Meta description"}'::jsonb,
 'gemini-2.5-flash', 0.2, 'neutro', true),

-- ============================================================
-- 3. Análise IG completa — SCHEMA EXPLÍCITO v2 (5 pilares + bio + tipos + códigos + veredicto)
-- ============================================================
('ig_posicionamento', '📸 Análise IG (5 pilares + bio framework + veredicto)',
 'Análise estratégica completa: 5 pilares, bio framework, tipos de conteúdo, destaques, erros amadores, códigos de autoridade, veredicto direto.',
$prompt$Você é um consultor de posicionamento e autoridade digital. Tom: direto, sarcástico na medida, mentor exigente com carinho. Frases curtas, sempre práticas. Brutalmente honesto, foco em resultado.

PERFIL ANALISADO:
- Handle: @{{handle}}
- Nome: {{full_name}}
- Categoria: {{category}}
- Bio: "{{bio}}"
- Link bio: {{external_url}}
- Followers: {{followers}}
- Posts totais: {{total_posts}}
- Verificada: {{is_verified}}
- Business: {{is_business}}
- Highlights: {{highlight_count}}

ANÁLISE QUANTITATIVA:
- {{posts_analisados}} posts analisados
- {{posts_per_month}} posts nos últimos 30d
- {{dias_desde_ultimo}}d desde último post
- Mix: {{pct_reels}}% Reels · {{pct_carousel}}% Carousel · {{pct_image}}% Image
- Engajamento: {{avg_likes}} likes · {{avg_comments}} comments por post
- Top hashtags: {{top_hashtags}}

ÚLTIMOS POSTS:
{{posts_compact}}

============================================================
RETORNE JSON ESTRITO COM EXATAMENTE ESTE SCHEMA (PT-BR):
============================================================

{
  "posicionamento": "1-2 frases",
  "persona_alvo": "1-2 frases",
  "tom_voz": "1 frase",
  "pilares_conteudo": ["3-5 pilares"],
  "gaps": ["3-5 gaps"],
  "recomendacoes": ["3-5 recomendações práticas"],

  "pilares_posicionamento": {
    "clareza": { "nota": 0-10, "comentario": "string curta" },
    "foco": { "nota": 0-10, "comentario": "string curta" },
    "promessa": { "nota": 0-10, "comentario": "string curta" },
    "prova": { "nota": 0-10, "comentario": "string curta" },
    "personalidade": { "nota": 0-10, "comentario": "string curta" }
  },

  "bio_framework": {
    "linha1_oque": "trecho da bio que diz o que faz",
    "linha2_paraquem": "trecho da bio que diz pra quem",
    "linha3_como": "trecho da bio que diz como entrega",
    "linha4_cta": "trecho da bio que tem o CTA",
    "nota_global": 0-10,
    "comentario": "1 frase sobre a bio"
  },

  "tipos_conteudo": {
    "autoridade": { "tem": true/false, "observacao": "string curta" },
    "transformacao": { "tem": true/false, "observacao": "string curta" },
    "bastidores": { "tem": true/false, "observacao": "string curta" },
    "objecoes": { "tem": true/false, "observacao": "string curta" },
    "provas_sociais": { "tem": true/false, "observacao": "string curta" },
    "cta": { "tem": true/false, "observacao": "string curta" }
  },

  "destaques_estrategicos": {
    "tem_quem_sou_bastidores": true/false,
    "tem_provas_resultados": true/false,
    "tem_produtos_servicos": true/false,
    "tem_metodo_como_funciona": true/false,
    "tem_faqs_objecoes": true/false,
    "tem_cta_comece_aqui": true/false
  },

  "erros_amadores": ["só os erros REAIS"],

  "codigos_autoridade": {
    "usados": ["códigos JÁ usados"],
    "faltando": ["códigos NÃO usados e deveria"]
  },

  "veredicto_frank_costa": "Parágrafo direto, brutal, prático. Aponte problema central, dê caminho, chame pra ação. 80-150 palavras."
}

REGRAS CRÍTICAS:
- TODOS os campos acima são OBRIGATÓRIOS — não pule nenhum
- Se não der pra inferir, use null
- Notas 0-10 (10 = excelente, 5 = mediano, 0 = ruim)
- Booleans true/false (não strings)$prompt$,
 '{"handle": "@ do perfil", "bio": "Bio do IG", "category": "Categoria IG", "followers": "Qtd seguidores", "full_name": "Nome", "is_business": "true|false", "is_verified": "true|false", "total_posts": "Total de posts", "external_url": "Link da bio", "highlight_count": "Qtd highlights", "posts_per_month": "Posts últ 30d", "posts_analisados": "Qtd posts no sample", "dias_desde_ultimo": "Dias desde último", "pct_reels": "% Reels", "pct_carousel": "% Carousel", "pct_image": "% Image", "avg_likes": "Likes médios", "avg_comments": "Comments médios", "top_hashtags": "Top hashtags", "posts_compact": "Lista compacta posts"}'::jsonb,
 'gemini-2.5-flash', 0.4, 'frank_costa', true),

-- ============================================================
-- 4. Reclame Aqui — sentimento
-- ============================================================
('ra_sentimento', '😡 Análise Reclame Aqui (sentimento)',
 'Analisa reclamações textuais e identifica temas frequentes, sentimento geral, padrão de atendimento.',
$prompt$Analise as reclamações abaixo da empresa "{{nome}}" no Reclame Aqui.

RECLAMAÇÕES:
{{reclamacoes_lista}}

RETORNE JSON ESTRITO:
{
  "sentimento_geral": "muito negativo | negativo | neutro | positivo",
  "temas_recorrentes": ["3-5 temas"],
  "dor_principal": "1 frase: qual a dor #1?",
  "padrao_atendimento": "1 frase: como atende?"
}$prompt$,
 '{"nome": "Nome da empresa", "reclamacoes_lista": "Lista numerada das reclamações"}'::jsonb,
 'gemini-2.5-flash', 0.2, 'neutro', true)

ON CONFLICT (key) DO NOTHING;
