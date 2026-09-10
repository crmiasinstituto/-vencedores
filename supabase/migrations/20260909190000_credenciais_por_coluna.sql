-- Ajusta o bloqueio de whatsapp_instances: 12 telas do CRM leem essa tabela para saber
-- QUE números existem (inbox, chat do lead, agenda, agente). Bloquear a tabela inteira
-- para quem não é acesso total quebraria todas elas.
--
-- RLS decide linha, não coluna — quem faz o recorte por coluna é o GRANT. Então:
--   ler a tabela        → colaborador ativo (as telas continuam funcionando)
--   escrever            → só acesso total
--   colunas de segredo  → ninguém, via REVOKE (nem o dono do acesso total pelo PostgREST;
--                         quem precisa delas são as edge functions, que usam service_role
--                         e não passam por GRANT de authenticated)

drop policy if exists whatsapp_instances_admin_total on public.whatsapp_instances;

create policy whatsapp_instances_leitura on public.whatsapp_instances
  for select to authenticated using (public.is_admin());

create policy whatsapp_instances_escrita on public.whatsapp_instances
  for all to authenticated
  using (public.is_admin_total()) with check (public.is_admin_total());

revoke select (instance_token, admin_token, api_key, verification_pin)
  on public.whatsapp_instances from authenticated;

-- email_config: mesma ideia. A tela de configuração precisa mostrar remetente e status,
-- mas a chave da API do Resend não tem por que trafegar para o browser de ninguém.
drop policy if exists email_config_admin_total on public.email_config;

create policy email_config_leitura on public.email_config
  for select to authenticated using (public.is_admin());

create policy email_config_escrita on public.email_config
  for all to authenticated
  using (public.is_admin_total()) with check (public.is_admin_total());

revoke select (resend_api_key) on public.email_config from authenticated;
