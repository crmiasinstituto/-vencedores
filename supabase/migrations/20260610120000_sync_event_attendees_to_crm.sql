-- Joga inscritos do evento pro CRM (kanban) + tags pra segmentar campanha + puxa foto do lead.
-- Quem nao tem lead (auto-cadastro/cortesia/walk-in) e achado por WhatsApp no board ou criado
-- na coluna "Lead Capturado". Tags: titulo do evento (todos) + 'Credenciado' (quem compareceu).
-- Foto: copia instagram_profile_pic_url (ou whatsapp) do lead pro inscrito quando faltar.
-- Aplicada em prod via MCP 2026-06-10.
create or replace function public.sync_event_attendees_to_crm(p_event_id uuid, p_board_slug text default 'masterclass-ia')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_board_id uuid; v_col_id uuid; v_title text; v_tag text;
  a record; v_lead_id uuid; v_phone text; v_cpf text; v_pic text;
  v_created int := 0; v_linked int := 0; v_tagged int := 0; v_photos int := 0;
  v_existing text[]; v_new text[];
begin
  select id into v_board_id from public.crm_boards where slug = p_board_slug;
  if v_board_id is null then return jsonb_build_object('ok',false,'error','board nao encontrado'); end if;
  select title into v_title from public.collective_events where id = p_event_id;
  if v_title is null then return jsonb_build_object('ok',false,'error','evento nao encontrado'); end if;
  v_tag := v_title;

  select id into v_col_id from public.crm_columns where board_id = v_board_id and name = 'Lead Capturado' limit 1;
  if v_col_id is null then select id into v_col_id from public.crm_columns where board_id = v_board_id order by sort_order limit 1; end if;

  for a in select * from public.event_attendees where event_id = p_event_id loop
    v_lead_id := a.crm_lead_id;
    v_phone := nullif(regexp_replace(coalesce(a.whatsapp,''),'\D','','g'),'');
    v_cpf := nullif(regexp_replace(coalesce(a.cpf,''),'\D','','g'),'');

    if v_lead_id is null then
      if v_phone is not null then
        select id into v_lead_id from public.crm_leads where board_id = v_board_id and whatsapp = v_phone limit 1;
      end if;
      if v_lead_id is null then
        insert into public.crm_leads (board_id, column_id, name, whatsapp, email, source, tags, cpf)
        values (v_board_id, v_col_id, a.name, v_phone, nullif(trim(coalesce(a.email,'')),''), 'evento_credenciamento',
                array[v_tag], case when length(coalesce(v_cpf,'')) in (11,14) then v_cpf else null end)
        returning id into v_lead_id;
        v_created := v_created + 1;
      else
        v_linked := v_linked + 1;
      end if;
      update public.event_attendees set crm_lead_id = v_lead_id, updated_at = now() where id = a.id;
    end if;

    select coalesce(tags,'{}') into v_existing from public.crm_leads where id = v_lead_id;
    v_new := v_existing;
    if not (v_tag = any(v_new)) then v_new := array_append(v_new, v_tag); end if;
    if (a.tickets_checked_in > 0 or a.checked_in_at is not null) and not ('Credenciado' = any(v_new)) then
      v_new := array_append(v_new, 'Credenciado');
    end if;
    if v_new <> v_existing then
      update public.crm_leads set tags = v_new, updated_at = now() where id = v_lead_id;
      v_tagged := v_tagged + 1;
    end if;

    if v_cpf is not null and length(v_cpf) in (11,14) then
      update public.crm_leads set cpf = v_cpf where id = v_lead_id and coalesce(cpf,'') = '';
    end if;

    if coalesce(a.instagram_profile_pic_url,'') = '' then
      select coalesce(nullif(instagram_profile_pic_url,''), nullif(whatsapp_profile_pic_url,'')) into v_pic
      from public.crm_leads where id = v_lead_id;
      if v_pic is not null then
        update public.event_attendees set instagram_profile_pic_url = v_pic, updated_at = now() where id = a.id;
        v_photos := v_photos + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok',true,'created',v_created,'linked',v_linked,'tagged',v_tagged,'photos',v_photos,'event_tag',v_tag);
end $$;
grant execute on function public.sync_event_attendees_to_crm(uuid, text) to authenticated, service_role;
