-- Mesma regra de antes, com (select ...) pra calcular "é admin?" uma vez por consulta em vez
-- de uma vez por lead. Deixa todas as telas que leem leads mais rápidas.
alter policy crm_leads_colaborador_ativo on public.crm_leads
  using ((select auth.role()) = 'service_role' or (select public.is_admin()))
  with check ((select auth.role()) = 'service_role' or (select public.is_admin()));
