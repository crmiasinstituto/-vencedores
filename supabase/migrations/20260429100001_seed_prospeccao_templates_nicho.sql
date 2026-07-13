-- ============================================================
-- SEED — Templates de Nicho (10 nichos pré-configurados)
-- ============================================================
INSERT INTO public.prospeccao_templates_nicho
  (nicho, emoji, display_name, descricao, fontes_obrigatorias, fontes_opcionais, pesos_score, prompt_oportunidades, custo_estimado_lead, is_default, is_active)
VALUES
('comercio_local', '🏪', 'Comércio Local',
 'Padaria, salão, oficina, pet shop, mercadinho',
 ARRAY['google_maps','instagram'],
 ARRAY['facebook','site','google_reviews'],
 '{"site": 10, "facebook": 15, "instagram": 30, "google_maps": 35, "google_reviews": 10}'::jsonb,
 $$Vende IA pra comércio local pequeno. Foque em: WhatsApp atendimento, fidelização de cliente, anúncios automatizados, gestão de reviews Google.$$,
 0.10, true, true),

('ecommerce', '🛍️', 'E-commerce / Loja Online',
 'Lojas online, dropshipping, marcas D2C',
 ARRAY['site','instagram'],
 ARRAY['mercado_livre','reclame_aqui','tiktok','tiktok_shop','pinterest','fb_ad_library'],
 '{"site": 30, "tiktok": 15, "instagram": 25, "reclame_aqui": 15, "mercado_livre": 15}'::jsonb,
 $$Vende IA pra e-commerce. Foque em: chatbot de venda WhatsApp, recuperação carrinho, geração de descrição de produto, atendimento pós-venda automatizado.$$,
 0.20, true, true),

('estetica', '💆', 'Estética / Beleza',
 'Clínicas de estética, salões de beleza, spas',
 ARRAY['google_maps','site','instagram'],
 ARRAY['doctoralia','reclame_aqui','facebook','google_reviews','tiktok'],
 '{"site": 20, "instagram": 30, "doctoralia": 10, "google_maps": 30, "reclame_aqui": 10}'::jsonb,
 $$Você é consultor de IA pra estética. Foque em conteúdo Instagram (Reels), agendamento online, retenção de cliente, programa de indicação automatizado.$$,
 0.13, true, true),

('hospedagem', '🏨', 'Hospedagem / Turismo',
 'Hotéis, pousadas, Airbnb, agências de viagem',
 ARRAY['google_maps','booking','tripadvisor','instagram'],
 ARRAY['airbnb','site','facebook'],
 '{"airbnb": 10, "booking": 25, "instagram": 20, "google_maps": 25, "tripadvisor": 20}'::jsonb,
 $$Vende IA pra hospedagem. Foque em: concierge IA WhatsApp, recomendações personalizadas, recuperação de hóspede, gerador de conteúdo turismo.$$,
 0.13, true, true),

('imobiliaria', '🏠', 'Imobiliária / Construtora',
 'Corretores, imobiliárias, construtoras',
 ARRAY['google_maps','site','instagram'],
 ARRAY['zap','olx','imovelweb','quintoandar','youtube','facebook'],
 '{"olx": 10, "zap": 20, "site": 25, "instagram": 25, "google_maps": 20}'::jsonb,
 $$Vende IA pra imobiliária. Foque em: qualificação de lead 24/7, tour virtual com IA, follow-up automatizado, geração de descrição de imóvel.$$,
 0.16, true, true),

('infoproduto', '🎓', 'Infoproduto / Curso / Mentoria',
 'Cursos online, mentorias, infoprodutos',
 ARRAY['site','instagram','youtube'],
 ARRAY['tiktok','fb_ad_library','google_ad_library','reclame_aqui','linkedin_founder'],
 '{"site": 25, "youtube": 20, "instagram": 25, "reclame_aqui": 15, "fb_ad_library": 15}'::jsonb,
 $$Vende IA pra creators de infoproduto. Foque em: atendimento aluno automatizado, retenção de mentorado, gerador de conteúdo, qualificação de lead pré-call.$$,
 0.20, true, true),

('restaurante', '🍽️', 'Restaurante / Bar / Café',
 'Restaurantes, bares, cafés, lanchonetes',
 ARRAY['google_maps','instagram'],
 ARRAY['ifood','tripadvisor','tiktok','site','facebook'],
 '{"ifood": 25, "tiktok": 10, "instagram": 25, "google_maps": 30, "tripadvisor": 10}'::jsonb,
 $$Você vende IA pra restaurantes. Foque em: pedido WhatsApp + cardápio digital, recuperação de cliente sumido, resposta automática reviews, geração de conteúdo TikTok.$$,
 0.16, true, true),

('rh_recrutamento', '👥', 'RH / Recrutamento (analisar empresa-alvo)',
 'Empresas alvo pra recrutamento ou venda B2B',
 ARRAY['linkedin_company','glassdoor'],
 ARRAY['vagas_com','linkedin_founder','reclame_aqui','site'],
 '{"glassdoor": 25, "vagas_com": 20, "linkedin_company": 35, "linkedin_founder": 20}'::jsonb,
 $$Vende IA pra empresas. Foque em: triagem automatizada de candidatos, screening por IA, employer branding com conteúdo automático.$$,
 0.10, true, true),

('saas_b2b', '💼', 'SaaS / Software B2B',
 'Empresas de software B2B, startups tech',
 ARRAY['site','linkedin_company'],
 ARRAY['linkedin_founder','twitter','g2','glassdoor','youtube'],
 '{"g2": 10, "site": 35, "twitter": 10, "linkedin_company": 30, "linkedin_founder": 15}'::jsonb,
 $$Vende IA pra SaaS B2B. Foque em: SDR automatizado, qualificação de leads, customer success proativo, suporte tier 1 com IA.$$,
 0.20, true, true),

('saude', '🩺', 'Saúde / Clínica',
 'Dentistas, médicos, fisioterapeutas, psicólogos, esteticistas',
 ARRAY['google_maps','site','instagram'],
 ARRAY['doctoralia','reclame_aqui','facebook','google_reviews'],
 '{"site": 25, "instagram": 20, "doctoralia": 15, "google_maps": 30, "reclame_aqui": 10}'::jsonb,
 $$Você é consultor que vende soluções de IA para clínicas. Analise os achados e identifique 3 oportunidades concretas de IA (atendimento WhatsApp 24h, gerador de conteúdo, resposta automática a reviews, agendamento inteligente). Tom direto, fala da DOR específica do lead.$$,
 0.13, true, true)

ON CONFLICT (nicho) DO NOTHING;
