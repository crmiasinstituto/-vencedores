-- Mesmo caso de whatsapp_instances.tem_credenciais: a tela precisa mostrar "API key
-- configurada", não o valor da chave. Coluna gerada resolve sem expor o segredo.
alter table public.email_config
  add column if not exists tem_api_key boolean
  generated always as (resend_api_key is not null and length(resend_api_key) > 10) stored;

grant select (tem_api_key) on public.email_config to authenticated;
