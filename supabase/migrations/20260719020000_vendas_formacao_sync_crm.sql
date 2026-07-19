-- Toda venda de formação alimenta o dashboard e o mapa central de leads, ponta a ponta.
-- Pedido do Carlos (19/07/2026): dados alinhados por telefone/email/CPF pro Gerente de IA de Vendas.
--
-- Trigger BEFORE em vendas_formacao:
--   1. casa (ou cria) o contato central em crm_leads por telefone (últimos 9 dígitos), email ou CPF;
--   2. gera um sales_events ligado (crm_lead_id) — é o feed que o SalesDashboard / Central 360 /
--      AdminDashboard leem; regenera no update via dedupe_key 'formacao:<id>';
--   3. grava crm_lead_id de volta na venda.

alter table public.vendas_formacao add column if not exists crm_lead_id uuid;

create or replace function public.vendas_formacao_sync_crm()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_lead  uuid;
  v_tel   text := nullif(regexp_replace(coalesce(NEW.cliente_telefone,''),'[^0-9]','','g'),'');
  v_cpf   text := nullif(regexp_replace(coalesce(NEW.cpf,''),'[^0-9]','','g'),'');
  v_email text := nullif(lower(trim(NEW.email)),'');
begin
  select id into v_lead from public.crm_leads
   where (v_tel  is not null and length(v_tel)>=8 and regexp_replace(coalesce(whatsapp,''),'[^0-9]','','g') like '%'||right(v_tel,9))
      or (v_email is not null and lower(email)=v_email)
      or (v_cpf  is not null and regexp_replace(coalesce(cpf,''),'[^0-9]','','g')=v_cpf)
   order by updated_at desc nulls last
   limit 1;

  if v_lead is null then
    insert into public.crm_leads (name, whatsapp, email, cpf, source, deal_value)
    values (NEW.cliente_nome, coalesce(NEW.cliente_telefone,''), v_email, v_cpf, 'venda_formacao', NEW.valor_total)
    returning id into v_lead;
  else
    update public.crm_leads set
      name       = coalesce(nullif(name,''), NEW.cliente_nome),
      email      = coalesce(email, v_email),
      cpf        = coalesce(cpf, v_cpf),
      whatsapp   = coalesce(nullif(whatsapp,''), NEW.cliente_telefone, whatsapp),
      deal_value = greatest(coalesce(deal_value,0), NEW.valor_total),
      updated_at = now()
    where id = v_lead;
  end if;

  delete from public.sales_events where dedupe_key = 'formacao:'||NEW.id;
  insert into public.sales_events (name, email, whatsapp, product_name, product_slug, amount, currency, payment_method, source, crm_lead_id, dedupe_key)
  values (NEW.cliente_nome, v_email, coalesce(NEW.cliente_telefone,''), NEW.produto_nome, NEW.produto, NEW.valor_total, 'BRL', NEW.forma_pagamento, 'formacao', v_lead, 'formacao:'||NEW.id);

  NEW.crm_lead_id := v_lead;
  return NEW;
end $$;

drop trigger if exists trg_vendas_formacao_sync_crm on public.vendas_formacao;
create trigger trg_vendas_formacao_sync_crm
  before insert or update on public.vendas_formacao
  for each row execute function public.vendas_formacao_sync_crm();

-- Datas de pagamento (processo de venda real): data_pagamento = data do cheque único;
-- vencimentos = array de datas ISO dos cheques/parcelas quando há mais de um.
alter table public.vendas_formacao
  add column if not exists data_pagamento date,
  add column if not exists vencimentos    jsonb;
