-- ============================================================
-- Seed integration_keys — adiciona Firecrawl, ScrapeCreators, Gemini
-- ============================================================
-- O CRM já tem um padrão de gerenciar chaves API via tabela
-- integration_keys (configurada pela UI em /admin/configuracoes).
-- Adicionamos os 3 services usados pela Prospecção Pro.
-- ============================================================

INSERT INTO public.integration_keys (service)
VALUES
  ('firecrawl'),
  ('scrapecreators'),
  ('gemini')
ON CONFLICT (service) DO NOTHING;
