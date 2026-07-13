-- Lembretes D-3/D-1/H-1 dos eventos coletivos.
-- Contexto: o dispatcher SQL existente (dispatch_collective_event_batch) so manda o
-- CONVITE INICIAL. A logica de lembrete nunca existiu, por isso o "D-3 nao disparou".
-- Esta funcao envia o template_html do evento com o assunto do marco e marca a coluna
-- do marco (d3/d1/h1_email_sent_at). So manda pra quem JA recebeu o convite inicial.
-- Aplicada em producao via MCP em 2026-06-07.

create or replace function public.dispatch_collective_event_reminders(p_event_id uuid, p_batch_size int default 300)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_event record; v_cfg record;
  v_min numeric; v_milestone text; v_col text; v_subject_prefix text;
  v_meses text[] := ARRAY['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  v_sched_brt timestamp; v_date_text text; v_time_text text; v_local_text text;
  v_app_url text := 'https://squaad.com.br';
  v_batch jsonb := '[]'::jsonb; v_ids uuid[] := '{}';
  v_html_map jsonb := '{}'::jsonb; v_email_map jsonb := '{}'::jsonb;
  v_inv record; v_first text; v_link text; v_html text; v_subject text;
  v_count int := 0; v_req bigint;
begin
  select * into v_event from public.collective_events where id = p_event_id;
  if v_event is null then return jsonb_build_object('error','event_not_found'); end if;
  if v_event.template_html is null then return jsonb_build_object('error','no_template_html'); end if;

  v_min := extract(epoch from (v_event.scheduled_at - now()))/60;
  if v_min <= 0 then return jsonb_build_object('ok',true,'sent',0,'message','event_started'); end if;
  if v_min <= 60 then v_milestone:='h1'; v_col:='h1_email_sent_at'; v_subject_prefix:='Em 1 hora: ';
  elsif v_min <= 1440 then v_milestone:='d1'; v_col:='d1_email_sent_at'; v_subject_prefix:='Amanha: ';
  elsif v_min <= 4320 then v_milestone:='d3'; v_col:='d3_email_sent_at'; v_subject_prefix:='Faltam 3 dias: ';
  else return jsonb_build_object('ok',true,'sent',0,'message','no_milestone_due'); end if;

  select resend_api_key, from_email, from_name into v_cfg from public.email_config where id='singleton';
  if v_cfg.resend_api_key is null then return jsonb_build_object('error','resend_not_configured'); end if;

  v_sched_brt := v_event.scheduled_at at time zone 'America/Sao_Paulo';
  v_date_text := extract(day from v_sched_brt)::text || ' de ' || v_meses[extract(month from v_sched_brt)::int];
  v_time_text := regexp_replace(to_char(v_sched_brt,'HH24"h"MI'),'h00$','h');
  v_local_text := case
    when v_event.event_format='online' then 'online via sala SQUAAD'
    when v_event.event_format='presencial' then coalesce(nullif(concat_ws(', ',v_event.venue_name,v_event.venue_address),''),'a confirmar')
    else coalesce('presencial em '||nullif(concat_ws(', ',v_event.venue_name,v_event.venue_address),'')||' ou online','presencial ou online') end;

  for v_inv in execute format($q$
      select cei.id, cei.lead_id, cei.token, l.name, l.email
      from public.collective_event_invites cei join public.crm_leads l on l.id = cei.lead_id
      where cei.event_id = $1 and cei.invite_email_sent_at is not null
        and cei.%I is null and l.email is not null and l.email <> '' and coalesce(l.email_opted_out,false)=false
      order by cei.id limit $2
    $q$, v_col) using p_event_id, p_batch_size
  loop
    v_first := split_part(coalesce(v_inv.name,''),' ',1);
    v_link := v_app_url || '/r/' || v_inv.token;
    v_subject := v_subject_prefix || v_event.title;
    v_html := v_event.template_html;
    v_html := regexp_replace(v_html,'\{\{\s*primeiro_nome\s*\}\}',v_first,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*nome\s*\}\}',coalesce(v_inv.name,''),'gi');
    v_html := regexp_replace(v_html,'\{\{\s*nome_evento\s*\}\}',v_event.title,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*data_evento\s*\}\}',v_date_text,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*hora_evento\s*\}\}',v_time_text,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*local_evento\s*\}\}',v_local_text,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*link_evento\s*\}\}',v_link,'gi');
    v_html := regexp_replace(v_html,'\{\{\s*link_grupo_whatsapp\s*\}\}',coalesce(v_event.whatsapp_group_url,''),'gi');
    v_batch := v_batch || jsonb_build_array(jsonb_build_object(
      'from', coalesce(v_cfg.from_name,'SQUAAD')||' <'||coalesce(v_cfg.from_email,'no-reply@squaad.com.br')||'>',
      'to', jsonb_build_array(v_inv.email), 'subject', v_subject, 'html', v_html));
    v_ids := array_append(v_ids, v_inv.id);
    v_email_map := v_email_map || jsonb_build_object(v_inv.id::text, v_inv.email);
    v_html_map := v_html_map || jsonb_build_object(v_inv.id::text, substring(v_html,1,50000));
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then return jsonb_build_object('ok',true,'sent',0,'milestone',v_milestone,'message','nothing_to_send'); end if;

  select net.http_post(url := 'https://api.resend.com/emails/batch',
    headers := jsonb_build_object('Authorization','Bearer '||v_cfg.resend_api_key,'Content-Type','application/json'),
    body := v_batch, timeout_milliseconds := 30000) into v_req;

  execute format('update public.collective_event_invites set %I = now() where id = any($1)', v_col) using v_ids;

  insert into public.email_sends (lead_id, email, status, sent_at, html)
  select cei.lead_id, v_email_map->>cei.id::text, 'sent', now(), v_html_map->>cei.id::text
  from public.collective_event_invites cei where cei.id = any(v_ids);

  return jsonb_build_object('ok',true,'sent',v_count,'milestone',v_milestone,'net_request_id',v_req);
end $$;
grant execute on function public.dispatch_collective_event_reminders(uuid,int) to authenticated, service_role;
