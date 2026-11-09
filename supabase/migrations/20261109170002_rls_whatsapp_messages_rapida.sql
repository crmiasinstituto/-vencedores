-- Mesma regra de antes, escrita com (select ...) pra o banco calcular "é admin?" uma vez por
-- consulta em vez de uma vez por mensagem (padrão recomendado pelo Supabase).
alter policy whatsapp_messages_colaborador_ativo on public.whatsapp_messages
  using ((select auth.role()) = 'service_role' or (select public.is_admin()))
  with check ((select auth.role()) = 'service_role' or (select public.is_admin()));
