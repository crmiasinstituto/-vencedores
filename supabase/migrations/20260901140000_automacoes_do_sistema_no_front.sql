-- Expoe no front as automacoes que so existiam no backend (pg_cron + triggers).
--
-- O problema que isso resolve: cron.job_run_details marca "succeeded" assim que o
-- net.http_post ENFILEIRA a requisicao. Se a edge function responder 401/500, o cron
-- continua dizendo "succeeded" e ninguem fica sabendo. Por isso o wrapper abaixo
-- guarda o request_id de cada disparo — com ele da pra ler o status HTTP de verdade
-- em net._http_response e mostrar isso na tela.

-- ---------------------------------------------------------------- telemetria

create table if not exists public.system_automation_runs (
  id         bigserial primary key,
  jobname    text not null,
  request_id bigint,
  started_at timestamptz not null default now()
);

create index if not exists system_automation_runs_job_idx
  on public.system_automation_runs (jobname, started_at desc);

alter table public.system_automation_runs enable row level security;
drop policy if exists system_automation_runs_admin on public.system_automation_runs;
create policy system_automation_runs_admin on public.system_automation_runs
  for select using (public.is_admin());

-- Wrapper usado pelos jobs de cron: dispara e registra o request_id.
create or replace function public.cron_http_call(
  p_job     text,
  p_url     text,
  p_headers jsonb,
  p_body    jsonb default '{}'::jsonb,
  p_timeout int   default 60000
) returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_req bigint;
begin
  select net.http_post(
    url := p_url, body := p_body, params := '{}'::jsonb,
    headers := p_headers, timeout_milliseconds := p_timeout
  ) into v_req;

  insert into public.system_automation_runs (jobname, request_id) values (p_job, v_req);
  delete from public.system_automation_runs where started_at < now() - interval '7 days';
  return v_req;
end $$;

-- ---------------------------------------------------------------- catalogo

-- O que cada automacao faz, em portugues. Sem isso o painel seria uma lista de
-- jobnames tecnicos que ninguem consegue interpretar.
create table if not exists public.system_automation_meta (
  key         text primary key,       -- jobname do cron, ou nome do trigger
  source      text not null,          -- cron | trigger
  label       text not null,
  description text,
  category    text not null default 'Outros',
  target_table text,
  created_at  timestamptz not null default now()
);

alter table public.system_automation_meta enable row level security;
drop policy if exists system_automation_meta_admin on public.system_automation_meta;
create policy system_automation_meta_admin on public.system_automation_meta
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.system_automation_meta (key, source, label, description, category, target_table) values
  -- cron
  ('email-automation-tick',        'cron','Motor das automações de lead','Avança um passo de cada fluxo em execução (enviar e-mail, esperar, mover no funil).','E-mail',null),
  ('email-automation-daily',       'cron','Gatilhos diários de e-mail','Roda os gatilhos que dependem da data: aniversário do lead e lead inativo há N dias.','E-mail',null),
  ('email-campanha-retomar',       'cron','Retomada de campanha de e-mail','Reencontra campanhas travadas em "enviando" e continua a fila de onde parou.','E-mail',null),
  ('wa-blast-processor-tick',      'cron','Disparo de campanha WhatsApp','Processa a fila das campanhas de WhatsApp respeitando limite por hora e janela.','WhatsApp',null),
  ('wa-group-cadence-tick',        'cron','Cadência em grupos de WhatsApp','Posta os passos das cadências dentro dos grupos, na ordem e no intervalo configurados.','WhatsApp',null),
  ('event-group-broadcast',        'cron','Divulgação de evento nos grupos','Anuncia o evento coletivo nos grupos escolhidos e repete em D-3, D-1 e 1h antes.','WhatsApp',null),
  ('weekly-group-report',          'cron','Relatório semanal dos grupos','Resumo do que rolou nos grupos, toda sexta às 20:30.','WhatsApp',null),
  ('ai-cadences-tick',             'cron','Cadência do agente de IA','Avança as cadências de follow-up conduzidas pelo agente de vendas.','IA',null),
  ('ai-analyze-conversations',     'cron','Análise das conversas','Lê as conversas do dia e extrai sinais de intenção e objeção.','IA',null),
  ('instagram-followup-check',     'cron','Follow-up de Instagram','Cobra resposta de quem veio do Instagram e ficou parado mais de 60 min.','Social Selling',null),
  ('marketing-midia-cron',         'cron','Publicação de mídia agendada','Publica os posts de marketing que estavam agendados.','Marketing',null),
  ('event-reminders-tick',         'cron','Lembretes de evento','Manda os lembretes para quem se inscreveu nos eventos.','Eventos',null),
  ('collective_event_dispatch_sql_1min','cron','Convites de evento coletivo','Envia os convites em lote e os lembretes dos eventos coletivos.','Eventos',null),
  ('meeting-reminders-check',      'cron','Lembretes de reunião','Avisa participantes das reuniões que estão chegando.','Agenda',null),
  ('ensure-support-meetings',      'cron','Reuniões de suporte recorrentes','Garante que as reuniões fixas de suporte existam na agenda.','Agenda',null),
  ('gcal-pull-tick',               'cron','Google Agenda (importar)','Traz para o CRM os eventos criados no Google Agenda.','Agenda',null),
  ('gcal-push-tick',               'cron','Google Agenda (exportar)','Leva para o Google Agenda as reuniões criadas no CRM.','Agenda',null),
  ('billing-reminders-daily',      'cron','Cobrança de parcelas','Lembra quem tem parcela vencendo ou vencida.','Financeiro',null),
  ('engagement-daily-alert',       'cron','Alerta diário de engajamento','Aponta os leads que esfriaram e precisam de contato.','CRM',null),
  ('admin-notif-tick',             'cron','Notificações do admin','Gera os avisos que aparecem no sininho do painel.','CRM',null),
  -- triggers
  ('trg_profiles_welcome',         'trigger','Boas-vindas ao novo membro','E-mail automático quando um perfil novo é criado.','E-mail','profiles'),
  ('trg_profiles_mover_treinador', 'trigger','Convite/mudança de treinador','Dispara o e-mail quando o membro é movido de treinador.','E-mail','profiles'),
  ('on_member_approved',           'trigger','Aprovação de indicação','Credita os pontos de indicação quando o membro é aprovado.','Comunidade','profiles'),
  ('trg_crm_lead_inscricao_email', 'trigger','E-mail de inscrição (landing)','Confirma por e-mail quem se inscreveu pela landing.','E-mail','crm_leads'),
  ('trg_crm_lead_inscricao_whatsapp','trigger','WhatsApp de inscrição','Manda o WhatsApp de confirmação para quem se inscreveu.','WhatsApp','crm_leads'),
  ('trg_email_automation_crm_leads','trigger','Gatilho das automações de lead','Coloca o lead na fila da automação quando ele é criado ou muda de coluna.','E-mail','crm_leads'),
  ('trg_email_engagement_dispatch','trigger','Gatilho de abertura/clique','Reage quando o lead abre ou clica em um e-mail.','E-mail','email_events'),
  ('trg_sales_events_eduzz_welcome','trigger','Boas-vindas da compra (Eduzz)','E-mail de acesso logo após a compra entrar.','Vendas','sales_events'),
  ('trg_baixar_vaga_evento',       'trigger','Baixa de vaga no evento','Desconta a vaga do evento quando a venda é registrada.','Vendas','sales_events'),
  ('trg_vendas_formacao_sync_crm', 'trigger','Venda de formação → CRM','Toda venda vira lead + evento de venda, sem digitar de novo.','Vendas','vendas_formacao'),
  ('trg_vendas_formacao_parcelas', 'trigger','Geração de parcelas','Cria as parcelas da venda parcelada.','Financeiro','vendas_formacao'),
  ('trg_meeting_notify',           'trigger','Aviso de reunião','Notifica os participantes quando a reunião é criada ou alterada.','Agenda','meetings'),
  ('trg_meeting_to_calendar',      'trigger','Reunião → Google Agenda','Espelha a reunião no Google Agenda.','Agenda','meetings'),
  ('trg_sync_attendee_paid',       'trigger','Pagamento → presença','Marca o participante como pago quando o pagamento entra.','Financeiro','member_payments'),
  ('crm_leads_canon_whatsapp',     'trigger','Padronização do WhatsApp','Normaliza o telefone do lead (DDI/9º dígito) para não duplicar contato.','CRM','crm_leads'),
  ('trg_sync_ig_profile_pic',      'trigger','Foto do Instagram no lead','Copia a foto do perfil do Instagram para o lead do CRM.','Social Selling','social_selling_ig_profiles'),
  ('trigger_generate_referral_code','trigger','Código de indicação','Gera o código único de indicação do membro.','Comunidade','profiles')
on conflict (key) do update set
  label = excluded.label, description = excluded.description,
  category = excluded.category, source = excluded.source, target_table = excluded.target_table;

-- ---------------------------------------------------------------- leitura

create or replace function public.list_system_automations()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'cron'
as $$
declare v_crons jsonb; v_triggers jsonb;
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;

  select coalesce(jsonb_agg(x order by x->>'category', x->>'label'), '[]'::jsonb) into v_crons
  from (
    select jsonb_build_object(
      'key',          j.jobname,
      'source',       'cron',
      'label',        coalesce(m.label, j.jobname),
      'description',  m.description,
      'category',     coalesce(m.category, 'Outros'),
      'schedule',     j.schedule,
      'active',       j.active,
      'last_run_at',  r.start_time,
      'cron_status',  r.status,
      -- status HTTP de verdade, quando o job passa pelo wrapper cron_http_call
      'http_status',  resp.status_code,
      'http_at',      resp.created,
      'http_body',    left(coalesce(resp.content, resp.error_msg, ''), 200),
      'instrumented', (sar.request_id is not null)
    ) as x
    from cron.job j
    left join public.system_automation_meta m on m.key = j.jobname and m.source = 'cron'
    left join lateral (
      select d.status, d.start_time
      from cron.job_run_details d
      where d.jobid = j.jobid and d.start_time is not null
      order by d.start_time desc limit 1
    ) r on true
    left join lateral (
      select s.request_id
      from public.system_automation_runs s
      where s.jobname = j.jobname
      order by s.started_at desc limit 1
    ) sar on true
    left join net._http_response resp on resp.id = sar.request_id
  ) t;

  select coalesce(jsonb_agg(x order by x->>'category', x->>'label'), '[]'::jsonb) into v_triggers
  from (
    select jsonb_build_object(
      'key',         m.key,
      'source',      'trigger',
      'label',       m.label,
      'description', m.description,
      'category',    m.category,
      'target_table',m.target_table,
      -- tgenabled 'D' = desabilitado; ausente na lista = trigger nao existe mais
      'active',      (tg.tgname is not null and tg.tgenabled <> 'D'),
      'exists',      (tg.tgname is not null)
    ) as x
    from public.system_automation_meta m
    left join pg_trigger tg on tg.tgname = m.key and not tg.tgisinternal
    where m.source = 'trigger'
  ) t;

  return jsonb_build_object(
    'crons', v_crons,
    'triggers', v_triggers,
    'http_errors_24h', (
      select count(*) from net._http_response
      where created > now() - interval '24 hours' and (status_code >= 400 or status_code is null)
    )
  );
end $$;

grant execute on function public.list_system_automations() to authenticated;

create or replace function public.toggle_system_automation(p_jobname text, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'cron'
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;
  if not exists (select 1 from cron.job where jobname = p_jobname) then
    raise exception 'job % nao existe', p_jobname;
  end if;
  perform cron.alter_job(
    (select jobid from cron.job where jobname = p_jobname),
    active := p_active
  );
  return jsonb_build_object('ok', true, 'jobname', p_jobname, 'active', p_active);
end $$;

grant execute on function public.toggle_system_automation(text, boolean) to authenticated;
