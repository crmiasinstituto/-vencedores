-- Contadores por etapa do editor de automação: público do gatilho (ex.: leads com a tag)
-- e, em cada etapa de envio, quantos já receberam (X/total). p_filter é o filtro do gatilho
-- que está na tela (vale mesmo antes de salvar).
create or replace function public.automation_node_stats(p_automation_id uuid, p_filter jsonb default '{}'::jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_publico bigint;
  v_tem_filtro boolean := coalesce(p_filter->>'tag','') <> '' or coalesce(p_filter->>'board_id','') <> '' or coalesce(p_filter->>'column_id','') <> '';
  v_res jsonb;
begin
  if not public.is_admin() then return null; end if;

  if v_tem_filtro then
    select count(*) into v_publico from crm_leads l
    where (coalesce(p_filter->>'tag','') = '' or l.tags @> array[p_filter->>'tag'])
      and (coalesce(p_filter->>'board_id','') = '' or l.board_id = (p_filter->>'board_id')::uuid)
      and (coalesce(p_filter->>'column_id','') = '' or l.column_id = (p_filter->>'column_id')::uuid);
  end if;

  with
  runs as (
    select count(*) total from email_automation_runs where automation_id = p_automation_id
  ),
  aqui as (
    select current_node_id nid, count(*) n from email_automation_runs
    where automation_id = p_automation_id and status = 'active' group by 1
  ),
  em as (
    select c.audience_filters->>'node_id' nid,
      count(distinct q.lead_id) filter (where q.sent_at is not null or q.status in ('sent','delivered','opened','clicked')) enviados,
      count(distinct q.lead_id) filter (where q.delivered_at is not null or q.status in ('delivered','opened','clicked')) entregues,
      count(distinct q.lead_id) filter (where q.opened_at is not null) abertos,
      count(distinct q.lead_id) filter (where q.clicked_at is not null) clicados,
      count(distinct q.lead_id) filter (where q.status in ('failed','bounced') or q.bounced_at is not null) falhas
    from email_campaigns c join email_campaign_leads q on q.campaign_id = c.id
    where c.automation_id = p_automation_id group by 1
  ),
  wa as (
    select m.metadata->>'node_id' nid,
      count(distinct m.lead_id) enviados,
      count(distinct m.lead_id) filter (where m.status in ('delivered','read') or m.delivered_at is not null) entregues,
      count(distinct m.lead_id) filter (where m.status = 'read' or m.read_at is not null) abertos,
      0::bigint clicados,
      count(distinct m.lead_id) filter (where m.status = 'failed') falhas
    from whatsapp_messages m
    where m.direction = 'outbound' and m.metadata->>'automation_id' = p_automation_id::text group by 1
  ),
  erros as (
    select ca.metadata->>'node_id' nid, count(distinct ca.lead_id) falhas
    from crm_activities ca
    where ca.activity_type = 'automation_error' and ca.metadata->>'automation_id' = p_automation_id::text group by 1
  ),
  por_no as (
    select nid, sum(enviados) enviados, sum(entregues) entregues, sum(abertos) abertos, sum(clicados) clicados, sum(falhas) falhas
    from (select * from em union all select * from wa
          union all select nid, 0, 0, 0, 0, falhas from erros) x
    where nid is not null group by nid
  )
  select jsonb_build_object(
    'publico', v_publico,
    'entraram', (select total from runs),
    'nodes', coalesce((select jsonb_object_agg(nid, jsonb_build_object(
        'enviados', enviados, 'entregues', entregues, 'abertos', abertos, 'clicados', clicados, 'falhas', falhas)) from por_no), '{}'::jsonb),
    'aqui', coalesce((select jsonb_object_agg(nid, n) from aqui where nid is not null), '{}'::jsonb)
  ) into v_res;
  return v_res;
end $$;

grant execute on function public.automation_node_stats(uuid, jsonb) to authenticated;

-- WhatsApps já enviados pelo fluxo de boas-vindas 50K: marca a etapa de origem.
update whatsapp_messages set metadata = metadata || '{"node_id":"sendWhatsappCloud-1793898227569"}'::jsonb
where metadata->>'automation_id' = 'e8b7361f-77b7-418d-a511-7ccafb018072' and metadata->>'node_id' is null;
