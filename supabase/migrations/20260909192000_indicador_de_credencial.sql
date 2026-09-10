-- A tela de WhatsApp mostrava "credenciais configuradas" testando `!!instance.api_key`.
-- Com a chave fora do alcance do browser, esse teste passaria a dar sempre falso.
--
-- Coluna gerada: diz SE existe credencial, sem entregar o valor. É calculada no banco,
-- então não há como derivar a chave a partir dela.

alter table public.whatsapp_instances
  add column if not exists tem_credenciais boolean
  generated always as (
    (api_key is not null and length(api_key) > 10)
    or (instance_token is not null and length(instance_token) > 10)
  ) stored;

grant select (tem_credenciais) on public.whatsapp_instances to authenticated;

-- A view pública ganha o mesmo indicador. Precisa de DROP: `create or replace view` não
-- aceita inserir coluna no meio da lista.
drop view if exists public.whatsapp_instances_publicas;
create view public.whatsapp_instances_publicas as
  select id, instance_name, phone_number, provider, status, channel, purpose,
         business_account_id, phone_number_id, avatar_url, is_dedicated_blast,
         tem_credenciais, created_at, updated_at
  from public.whatsapp_instances;

grant select on public.whatsapp_instances_publicas to authenticated;
