-- Números de cada fluxo de automação para a lista e o relatório (quantos entraram,
-- quantos e-mails/WhatsApps saíram, abertos, cliques e falhas).
-- WhatsApp: o motor grava metadata.automation_id na mensagem enviada; falhas e pulos
-- viram crm_activities (activity_type = 'automation_error') com metadata.automation_id.

create or replace function public.automation_stats()
returns table (
  automation_id uuid,
  entraram bigint, em_andamento bigint, concluidos bigint, falharam bigint,
  emails_enviados bigint, emails_entregues bigint, emails_abertos bigint, emails_clicados bigint, emails_falhas bigint,
  whatsapp_enviados bigint, whatsapp_entregues bigint, whatsapp_lidos bigint, whatsapp_falhas bigint,
  ultimo_envio timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id,
    coalesce(r.entraram,0), coalesce(r.em_andamento,0), coalesce(r.concluidos,0), coalesce(r.falharam,0),
    coalesce(e.enviados,0), coalesce(e.entregues,0), coalesce(e.abertos,0), coalesce(e.clicados,0), coalesce(e.falhas,0),
    coalesce(w.enviados,0), coalesce(w.entregues,0), coalesce(w.lidos,0), coalesce(f.falhas,0),
    greatest(e.ultimo, w.ultimo)
  from email_automations a
  left join lateral (
    select count(*) entraram,
      count(*) filter (where status='active') em_andamento,
      count(*) filter (where status='completed') concluidos,
      count(*) filter (where status='failed') falharam
    from email_automation_runs where automation_id = a.id
  ) r on true
  left join lateral (
    select count(*) filter (where q.sent_at is not null or q.status in ('sent','delivered','opened','clicked')) enviados,
      count(*) filter (where q.delivered_at is not null or q.status in ('delivered','opened','clicked')) entregues,
      count(*) filter (where q.opened_at is not null) abertos,
      count(*) filter (where q.clicked_at is not null) clicados,
      count(*) filter (where q.status in ('failed','bounced') or q.bounced_at is not null) falhas,
      max(q.sent_at) ultimo
    from email_campaign_leads q join email_campaigns c on c.id = q.campaign_id
    where c.automation_id = a.id
  ) e on true
  left join lateral (
    select count(*) enviados,
      count(*) filter (where m.status in ('delivered','read') or m.delivered_at is not null) entregues,
      count(*) filter (where m.status = 'read' or m.read_at is not null) lidos,
      max(m.created_at) ultimo
    from whatsapp_messages m
    where m.direction = 'outbound' and m.metadata->>'automation_id' = a.id::text
  ) w on true
  left join lateral (
    select count(*) falhas from crm_activities ca
    where ca.activity_type = 'automation_error' and ca.metadata->>'automation_id' = a.id::text
  ) f on true
  where public.is_admin();
$$;

create or replace function public.automation_whatsapp_log(p_automation_id uuid, p_limit int default 200)
returns table (quando timestamptz, lead_id uuid, lead_nome text, telefone text, status text, conteudo text, erro text)
language sql stable security definer set search_path = public as $$
  select * from (
    select m.created_at, m.lead_id, l.name, m.remote_phone,
      coalesce(m.status, 'sent'), m.content, m.error_message
    from whatsapp_messages m left join crm_leads l on l.id = m.lead_id
    where m.direction = 'outbound' and m.metadata->>'automation_id' = p_automation_id::text
    union all
    select ca.created_at, ca.lead_id, l.name, l.whatsapp, 'failed', null, ca.description
    from crm_activities ca left join crm_leads l on l.id = ca.lead_id
    where ca.activity_type = 'automation_error' and ca.metadata->>'automation_id' = p_automation_id::text
  ) x
  where public.is_admin()
  order by 1 desc
  limit p_limit;
$$;

grant execute on function public.automation_stats() to authenticated;
grant execute on function public.automation_whatsapp_log(uuid, int) to authenticated;

-- A mensagem de boas-vindas da Operação 50K enviada no teste de 05/11 antes da marcação existir.
update whatsapp_messages set metadata = metadata || '{"automation_id":"e8b7361f-77b7-418d-a511-7ccafb018072"}'::jsonb
where lead_id = '6d3bd2c9-acd5-484a-ba25-6e59753a9d6b' and direction = 'outbound'
  and metadata->>'template_name' = 'boas_vindas_operacao50k' and metadata->>'automation_id' is null;
