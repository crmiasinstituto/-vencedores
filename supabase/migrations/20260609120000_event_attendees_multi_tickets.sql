-- Multiplos ingressos por comprador (comprou pra si + outras pessoas).
-- Ex: lead com 2 compras (1 + 2 ingressos no array products da Kirvano) = 3 ingressos.
-- Aplicada em prod via MCP 2026-06-09.

alter table public.event_attendees
  add column if not exists tickets_total int not null default 1,
  add column if not exists tickets_checked_in int not null default 0;

update public.event_attendees
  set tickets_checked_in = case when checked_in_at is not null then greatest(tickets_checked_in,1) else tickets_checked_in end
  where tickets_checked_in = 0 and checked_in_at is not null;

-- import soma os ingressos de TODAS as compras de masterclass do lead
create or replace function public.import_event_buyers(p_event_id uuid, p_board_slug text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_board_id uuid; v_inserted int := 0;
begin
  select id into v_board_id from public.crm_boards where slug = p_board_slug;
  if v_board_id is null then return 0; end if;

  with comprou as (
    select distinct on (l.whatsapp) l.id as lead_id, l.name, l.whatsapp, l.email, l.cpf
    from public.crm_leads l
    join public.crm_columns c on c.id = l.column_id
    where l.board_id = v_board_id and c.name = 'Comprou' and l.whatsapp is not null
    order by l.whatsapp, l.updated_at desc nulls last
  ),
  sales_agg as (
    select s.crm_lead_id,
           sum( case when jsonb_typeof(s.raw_payload->'products') = 'array'
                     then greatest((select count(*) from jsonb_array_elements(s.raw_payload->'products') p
                            where coalesce(p->>'is_order_bump','false') <> 'true' and coalesce(p->>'format','ticket') = 'ticket'), 1)
                     else 1 end ) as tickets,
           sum(coalesce(s.amount,0)) as total_amount,
           (array_agg(s.id order by s.created_at desc))[1] as last_sale_id,
           (array_agg(s.product_name order by s.created_at desc))[1] as last_product,
           (array_agg(s.payment_method order by s.created_at desc))[1] as last_method,
           (array_agg(s.instagram order by s.created_at desc) filter (where s.instagram is not null))[1] as ig,
           (array_agg(s.instagram_profile_pic_url order by s.created_at desc) filter (where s.instagram_profile_pic_url is not null))[1] as pic
    from public.sales_events s
    where s.source = 'kirvano' and coalesce(s.product_name,'') ilike '%masterclass%'
    group by s.crm_lead_id
  ),
  enriched as (
    select cp.*, sa.tickets, sa.total_amount, sa.last_sale_id, sa.last_product, sa.last_method, sa.ig, sa.pic
    from comprou cp left join sales_agg sa on sa.crm_lead_id = cp.lead_id
  ),
  ins as (
    insert into public.event_attendees (
      event_id, name, whatsapp, email, cpf, instagram, instagram_profile_pic_url,
      origin, product, amount, payment_method, payment_status, crm_lead_id, sales_event_id, tickets_total)
    select p_event_id, e.name, e.whatsapp, e.email, e.cpf, replace(coalesce(e.ig,''),'@',''),
           e.pic, 'compra', coalesce(e.last_product, 'Masterclass IA'), e.total_amount,
           coalesce(e.last_method, 'kirvano'), 'paid', e.lead_id, e.last_sale_id, coalesce(e.tickets, 1)
    from enriched e
    on conflict (event_id, whatsapp) where whatsapp is not null do update set
      crm_lead_id = excluded.crm_lead_id,
      sales_event_id = coalesce(excluded.sales_event_id, public.event_attendees.sales_event_id),
      product = coalesce(public.event_attendees.product, excluded.product),
      amount = excluded.amount, payment_status = 'paid',
      tickets_total = greatest(coalesce(excluded.tickets_total,1), 1),
      instagram = coalesce(nullif(public.event_attendees.instagram,''), excluded.instagram),
      instagram_profile_pic_url = coalesce(public.event_attendees.instagram_profile_pic_url, excluded.instagram_profile_pic_url),
      updated_at = now()
    returning 1
  )
  select count(*) into v_inserted from ins;
  return v_inserted;
end $$;
grant execute on function public.import_event_buyers(uuid, text) to authenticated, service_role;

-- credenciar +1 / -1 ingresso
create or replace function public.adjust_event_checkin(p_attendee_id uuid, p_delta int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row record; v_new int;
begin
  select id, name, tickets_total, tickets_checked_in into v_row from public.event_attendees where id = p_attendee_id;
  if v_row.id is null then return jsonb_build_object('ok',false,'error','inscrito nao encontrado'); end if;
  v_new := least(greatest(v_row.tickets_checked_in + p_delta, 0), greatest(v_row.tickets_total,1));
  update public.event_attendees set tickets_checked_in = v_new,
    checked_in_at = case when v_new > 0 then coalesce(checked_in_at, now()) else null end, updated_at = now()
  where id = p_attendee_id;
  return jsonb_build_object('ok',true,'attendee_id',v_row.id,'tickets_checked_in',v_new,'tickets_total',greatest(v_row.tickets_total,1));
end $$;
grant execute on function public.adjust_event_checkin(uuid, int) to authenticated, service_role;

create or replace function public.toggle_event_checkin(p_attendee_id uuid, p_checked boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row record;
begin
  update public.event_attendees set
    tickets_checked_in = case when p_checked then greatest(tickets_total,1) else 0 end,
    checked_in_at = case when p_checked then now() else null end, updated_at = now()
  where id = p_attendee_id returning id, name, checked_in_at, tickets_checked_in, tickets_total into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'Inscrito nao encontrado'); end if;
  return jsonb_build_object('ok', true, 'attendee_id', v_row.id, 'checked_in_at', v_row.checked_in_at,
                            'tickets_checked_in', v_row.tickets_checked_in, 'tickets_total', greatest(v_row.tickets_total,1));
end $$;
grant execute on function public.toggle_event_checkin(uuid, boolean) to authenticated, service_role;

create or replace function public.checkin_by_code(p_event_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row record; v_new int; v_was int;
begin
  select id, name, tickets_total, tickets_checked_in into v_row
  from public.event_attendees where event_id = p_event_id and checkin_code = p_code;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'QR nao confere com este evento'); end if;
  v_was := v_row.tickets_checked_in;
  v_new := least(v_row.tickets_checked_in + 1, greatest(v_row.tickets_total,1));
  update public.event_attendees set tickets_checked_in = v_new, checked_in_at = coalesce(checked_in_at, now()), updated_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true, 'attendee_id', v_row.id, 'name', v_row.name,
    'already', v_was >= greatest(v_row.tickets_total,1), 'tickets_checked_in', v_new, 'tickets_total', greatest(v_row.tickets_total,1));
end $$;
grant execute on function public.checkin_by_code(uuid, text) to authenticated, service_role;
