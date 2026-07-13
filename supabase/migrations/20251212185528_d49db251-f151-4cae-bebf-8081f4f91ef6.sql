-- Inserir cliente de teste vinculado ao lead existente
INSERT INTO public.clients (
  lead_id,
  company_name,
  responsible_name,
  position,
  status,
  onboarding_step,
  onboarding_token
) VALUES (
  '24730e1d-acbc-42d4-8232-6547c0af0390',
  'Empresa Teste',
  'Carlos Eduardo Silva Souza',
  'Proprietário',
  'pending',
  1,
  'teste-onboarding-123'
);