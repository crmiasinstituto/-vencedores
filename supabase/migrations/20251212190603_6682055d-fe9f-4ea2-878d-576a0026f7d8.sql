-- Atualizar cliente de teste para usar a lead Juliana Coracini Mafra
UPDATE public.clients 
SET 
  lead_id = '5e5ace78-bfde-4683-9186-5396aaa05bd8',
  responsible_name = 'Juliana Coracini Mafra',
  company_name = 'Convites Feito a Mão'
WHERE onboarding_token = 'teste-onboarding-123';