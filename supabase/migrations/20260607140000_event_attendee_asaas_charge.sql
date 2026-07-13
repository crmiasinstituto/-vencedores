-- Cobranca Asaas na hora pro inscrito do evento (aplicada em prod via MCP 2026-06-07).
-- Cria member + contract + parcela e liga em event_attendees.member_payment_id; o
-- frontend chama a edge certificada asaas-create-payment pra gerar a fatura. Um trigger
-- reflete o "pago" do webhook no inscrito, sem precisar redeployar a edge do webhook.

create or replace function public.create_event_attendee_charge(
  p_attendee_id uuid, p_product text, p_amount numeric, p_billing_type text default 'UNDEFINED'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record; v_member_id uuid; v_contract_id uuid; v_payment_id uuid;
  v_cpf text; v_email text; v_phone text;
begin
  select * into a from public.event_attendees where id = p_attendee_id;
  if a.id is null then return jsonb_build_object('ok',false,'error','inscrito nao encontrado'); end if;
  if coalesce(p_amount,0) <= 0 then return jsonb_build_object('ok',false,'error','valor invalido'); end if;

  v_cpf := regexp_replace(coalesce(a.cpf,''), '\D','','g');
  if length(v_cpf) not in (11,14) then
    return jsonb_build_object('ok',false,'error','CPF do inscrito obrigatorio pra gerar cobranca Asaas');
  end if;

  v_phone := regexp_replace(coalesce(a.whatsapp,''), '\D','','g');
  v_email := coalesce(nullif(trim(a.email),''), 'evento+'||v_cpf||'@squaad.com.br');

  select id into v_member_id from public.members where regexp_replace(coalesce(cpf,''),'\D','','g') = v_cpf limit 1;
  if v_member_id is null then
    insert into public.members (name, email, phone, cpf) values (a.name, v_email, v_phone, v_cpf) returning id into v_member_id;
  end if;

  insert into public.member_contracts (member_id, crm_lead_id, program, total_value, num_installments, payment_method, status, gateway)
  values (v_member_id, a.crm_lead_id, coalesce(p_product,'Venda evento'), p_amount, 1, lower(p_billing_type), 'active', 'asaas')
  returning id into v_contract_id;

  insert into public.member_payments (contract_id, member_id, installment_number, value, due_date, status, payment_method)
  values (v_contract_id, v_member_id, 1, p_amount, current_date, 'pending', lower(p_billing_type))
  returning id into v_payment_id;

  update public.event_attendees set
    member_payment_id = v_payment_id, product = p_product, amount = p_amount,
    payment_method = lower(p_billing_type),
    origin = case when origin = 'auto' then 'manual' else origin end,
    updated_at = now()
  where id = p_attendee_id;

  return jsonb_build_object('ok',true,'member_id',v_member_id,'contract_id',v_contract_id,'payment_id',v_payment_id);
end $$;
grant execute on function public.create_event_attendee_charge(uuid,text,numeric,text) to authenticated, service_role;

create or replace function public.sync_attendee_paid_from_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'paid' and (OLD.status is distinct from 'paid') then
    update public.event_attendees
      set payment_status = 'paid', payment_method = coalesce(NEW.payment_method, payment_method), updated_at = now()
    where member_payment_id = NEW.id;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_sync_attendee_paid on public.member_payments;
create trigger trg_sync_attendee_paid after update on public.member_payments
  for each row execute function public.sync_attendee_paid_from_payment();
