-- Fecha as tabelas que o clone da base SQUAAD trouxe com policy USING(true) pro role public.
-- Levantamento de 15/07/2026: 54 tabelas abertas à chave anon (que é pública, vai no bundle JS).
--
-- Destas 54, 49 só são acessadas pelo front dentro de /admin (guard real: Supabase Auth +
-- AdminLayout + is_admin()) ou não têm acesso nenhum do front. Elas vão pro gate is_admin().
-- As 5 restantes (meetings, meet_questions, meet_ratings, lesson_recording_jobs,
-- whatsapp_groups) são alcançadas por anon via /meet/:roomId e são tratadas em migration
-- separada, junto com a correção do ?role=host.
--
-- Edge functions usam service_role, que ignora RLS por completo — dropar as policies aqui
-- não afeta nenhuma delas.
--
-- As rotas públicas (/r/:token, /evento/:token, /inscricao/:token, /g/:slug) não leem estas
-- tabelas direto: passam por RPC SECURITY DEFINER com grant pro anon (verificado em pg_proc:
-- resolve_event_signup, register_event_attendee, save_attendee_instagram,
-- resolve_collective_invite, confirm_collective_rsvp, event_public_identify,
-- resolve_wa_group_redirect). Por isso trancar a tabela não quebra o fluxo público.

do $$
declare
  t text;
  p text;
  alvo text[] := array[
    -- /admin/agentes
    'ai_agent_cadence_enrollments', 'ai_agent_conversations', 'ai_agent_logs', 'ai_sales_agents',
    -- /admin (dashboard, crm, agenda, clientes, recebimentos)
    'admin_notifications', 'calendar_events', 'call_history', 'client_contracts',
    'client_onboarding_changes', 'clients', 'coach_sessions', 'crm_boards', 'crm_columns',
    'lead_conversation_insights', 'leads', 'sales_events', 'sales_playbooks',
    -- /admin/marketing*
    'collective_event_invites', 'marketing_ai_outputs', 'marketing_ai_sessions',
    'marketing_briefing', 'marketing_initiatives', 'viral_carousels',
    -- /admin/whatsapp, /admin/grupos, /admin/configuracoes
    'r10x_settings', 'wavoip_devices', 'webhook_configs', 'whatsapp_group_participants',
    'whatsapp_group_questions', 'whatsapp_instances',
    -- onboarding legado (o form externo aponta pro banco antigo da SQUAAD, não pra este)
    'metodo_squaad_enrollments', 'vhs_onboarding_progress', 'vhs_participants',
    -- sem acesso do front: só RPC SECURITY DEFINER
    'event_interactions',
    -- sem acesso do front nenhum (órfãs do clone; FK pra clients, cara de form de onboarding
    -- que não existe nestes repos). Trancadas por ora — se algum form aparecer, o 42501 no
    -- log do PostgREST diz exatamente qual.
    'client_audience', 'client_branding', 'client_expansion', 'client_goals', 'client_materials',
    'client_operations', 'client_policies', 'client_products', 'client_technical',
    -- módulo prospecção: src/modules/ não existe no repo; só edge function (service_role)
    'prospeccao_buscas', 'prospeccao_diagnosticos', 'prospeccao_leads_descobertos',
    'prospeccao_member_leads', 'prospeccao_prompts_config', 'prospeccao_templates_nicho'
  ];
begin
  foreach t in array alvo loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'pulando %: tabela não existe', t;
      continue;
    end if;

    -- Derruba TODA policy existente na tabela. As herdadas do clone são USING(true) pro
    -- role public; não há nenhuma que valha a pena preservar.
    for p in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "admin_full_access" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
    raise notice 'trancada: %', t;
  end loop;
end $$;
