-- Adiciona services usados pelo Marketing IA
INSERT INTO public.integration_keys (service) VALUES
  ('gemini'),
  ('lovable_gateway')
ON CONFLICT (service) DO NOTHING;
