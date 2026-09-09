-- Templates da Cloud API são por NÚMERO (cada um tem seu WABA), não globais.
--
-- O índice único era (name, language): com dois números, um template de mesmo nome
-- em WABAs diferentes sobrescreveria o outro na sincronização. Agora a chave inclui
-- o WABA, que é o que realmente identifica o template.

-- É constraint, não índice solto: precisa cair como constraint.
alter table public.whatsapp_cloud_templates
  drop constraint if exists whatsapp_cloud_templates_name_language_key;

-- Constraint (não índice) porque o upsert do sincronizador usa onConflict com estas colunas.
alter table public.whatsapp_cloud_templates
  add constraint whatsapp_cloud_templates_waba_name_lang_key
  unique (meta_waba_id, name, language);

-- Nome legível do número dono do template, pra tela poder agrupar/filtrar por linha
-- sem repetir o WABA cru na interface.
create or replace view public.whatsapp_cloud_templates_com_linha as
  select t.*,
         i.instance_name as linha_nome,
         i.phone_number  as linha_numero,
         i.id            as instance_id
  from public.whatsapp_cloud_templates t
  left join public.whatsapp_instances i
    on i.business_account_id = t.meta_waba_id and i.provider = 'cloud_api';

grant select on public.whatsapp_cloud_templates_com_linha to authenticated;
