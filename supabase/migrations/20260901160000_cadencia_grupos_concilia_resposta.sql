-- net.http_post e assincrono: quando o insert do log acontece, a resposta ainda
-- nao existe. Sem conciliar, uma mensagem que a uazapi recusou (grupo inexistente,
-- sessao deslogada, numero fora do grupo) fica registrada como "sent" e o painel
-- mente exatamente como o pg_cron mentia.
--
-- Esta funcao volta nos envios recentes, le a resposta real pelo request_id e
-- corrige o status. Roda no inicio de cada rodada do motor.

create or replace function public.wa_group_cadence_conciliar()
returns int
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_n int;
begin
  with corrigidos as (
    update public.wa_group_cadence_sends s
       set status = case
             when resp.status_code between 200 and 299 then 'sent'
             else 'failed'
           end,
           error = case
             when resp.status_code between 200 and 299 then null
             else left(coalesce(resp.error_msg, resp.content, 'HTTP ' || resp.status_code), 300)
           end
      from net._http_response resp
     where resp.id = s.request_id
       and s.sent_at > now() - interval '2 days'
       and s.status <> case when resp.status_code between 200 and 299 then 'sent' else 'failed' end
    returning 1
  )
  select count(*) into v_n from corrigidos;
  return v_n;
end $$;

-- Encaixa a conciliacao no inicio do motor.
create or replace function public.run_wa_group_cadences()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare
  cad          record;
  passo        record;
  gj           text;
  v_token      text;
  v_url        text;
  v_due        timestamptz;
  v_agora_local time;
  v_enviados   int := 0;
  v_erros      int := 0;
  v_no_run     int;
  v_req        bigint;
  v_reservado  uuid;
  v_nome_grupo text;
  v_texto      text;
  v_pendentes  int;
  v_conciliados int;
begin
  v_conciliados := public.wa_group_cadence_conciliar();
  v_agora_local := (now() at time zone 'America/Sao_Paulo')::time;

  for cad in
    select * from public.wa_group_cadences
    where status in ('draft','running')
      and (status = 'running' or (start_at is not null and start_at <= now()))
    order by created_at
  loop
    if v_agora_local < cad.window_start or v_agora_local > cad.window_end then
      continue;
    end if;

    if cad.started_at is null then
      update public.wa_group_cadences
        set started_at = coalesce(start_at, now()), status = 'running'
        where id = cad.id
        returning started_at into cad.started_at;
      cad.status := 'running';
    end if;

    select i.instance_token, coalesce(i.api_url, 'https://squaad.uazapi.com')
      into v_token, v_url
      from public.whatsapp_instances i
     where i.provider = 'uazapi'
       and i.instance_token is not null
       and (cad.instance_id is null or i.id = cad.instance_id)
     order by (i.id = cad.instance_id) desc
     limit 1;

    if v_token is null then
      continue;
    end if;

    v_no_run := 0;

    for passo in
      select * from public.wa_group_cadence_steps
      where cadence_id = cad.id order by step_order
    loop
      v_due := public.wa_group_cadence_step_due_at(cad.started_at, cad.id, passo.step_order);
      exit when v_due > now();

      for gj in select jsonb_array_elements_text(cad.group_jids) loop
        exit when v_no_run >= cad.max_per_run;

        if exists (
          select 1 from public.wa_group_cadence_sends s
          where s.step_id = passo.id and s.group_jid = gj
        ) then
          continue;
        end if;

        select name into v_nome_grupo from public.whatsapp_groups where group_jid = gj;
        v_texto := replace(passo.message, '{{grupo}}', coalesce(v_nome_grupo, ''));

        -- reserva antes de enviar: o indice unico impede a duplicata numa corrida
        v_reservado := null;
        begin
          insert into public.wa_group_cadence_sends
            (cadence_id, step_id, group_jid, group_name, status)
          values (cad.id, passo.id, gj, v_nome_grupo, 'sending')
          returning id into v_reservado;
        exception when unique_violation then
          continue;
        end;

        begin
          if passo.media_url is not null and passo.media_url <> '' then
            select net.http_post(
              v_url || '/send/media',
              jsonb_build_object(
                'number', replace(gj, '@g.us', '') || '@g.us',
                'type',   coalesce(passo.media_type, 'image'),
                'file',   passo.media_url,
                'text',   v_texto
              ),
              '{}'::jsonb,
              jsonb_build_object('Content-Type','application/json','token',v_token),
              8000
            ) into v_req;
          else
            select net.http_post(
              v_url || '/send/text',
              jsonb_build_object(
                'number', replace(gj, '@g.us', '') || '@g.us',
                'text',   v_texto
              ),
              '{}'::jsonb,
              jsonb_build_object('Content-Type','application/json','token',v_token),
              8000
            ) into v_req;
          end if;

          -- fica em 'sending' ate a conciliacao ler a resposta de verdade
          update public.wa_group_cadence_sends
            set request_id = v_req
            where id = v_reservado;

          v_enviados := v_enviados + 1;

        exception when others then
          update public.wa_group_cadence_sends
            set status = 'failed', error = sqlerrm
            where id = v_reservado;
          v_erros := v_erros + 1;
        end;

        v_no_run := v_no_run + 1;
      end loop;

      exit when v_no_run >= cad.max_per_run;
    end loop;

    update public.wa_group_cadences c set
      sent_count   = (select count(*) from public.wa_group_cadence_sends s where s.cadence_id = c.id and s.status='sent'),
      failed_count = (select count(*) from public.wa_group_cadence_sends s where s.cadence_id = c.id and s.status='failed')
    where c.id = cad.id;

    select
      (select count(*) from public.wa_group_cadence_steps where cadence_id = cad.id)
      * jsonb_array_length(cad.group_jids)
      - (select count(*) from public.wa_group_cadence_sends where cadence_id = cad.id)
    into v_pendentes;

    if v_pendentes <= 0 and (select count(*) from public.wa_group_cadence_steps where cadence_id = cad.id) > 0 then
      update public.wa_group_cadences
        set status = 'completed', completed_at = now()
        where id = cad.id and status = 'running';
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'enviados', v_enviados, 'erros', v_erros, 'conciliados', v_conciliados
  );
end $$;
