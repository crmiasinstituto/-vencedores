-- Fecha as tabelas internas para quem não é colaborador.
--
-- Achado: a policy dessas tabelas era `auth.role() = 'authenticated'`, que quer dizer
-- "qualquer conta logada no projeto" — e não "colaborador". Como o mesmo Supabase Auth
-- atende a comunidade + que Vencedores, as 131 contas de membros passavam no teste.
--
-- Na prática, qualquer membro logado conseguia baixar os 43.727 leads do CRM, o histórico
-- de conversas do WhatsApp e a base de candidatos, chamando a API REST direto.
--
-- A troca é `auth.role() = 'authenticated'` → `is_admin()`, que exige estar em app_admins
-- E ativo. Isso também faz o botão "desativar colaborador" cortar o acesso de verdade:
-- antes ele derrubava só o que passava por is_admin(), e estas tabelas não passavam.
--
-- service_role segue liberado porque as edge functions dependem dele.

do $$
declare
  t text;
  p record;
  -- Todas de operação interna. Nenhuma é lida por tela de membro da comunidade.
  alvos text[] := array[
    'crm_leads', 'crm_activities', 'whatsapp_messages', 'tasks', 'team_members',
    'candidates', 'marketing_campaigns', 'utm_links',
    'cadence_enrollments', 'cadence_sequences'
  ];
begin
  foreach t in array alvos loop
    -- Derruba só as policies com o padrão frouxo; as específicas (mural anônimo do
    -- Reprograme-se 10X, por exemplo) continuam de pé.
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
        and qual like '%auth.role()%authenticated%'
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format($f$
      create policy %I on public.%I
        for all to public
        using (auth.role() = 'service_role' or public.is_admin())
        with check (auth.role() = 'service_role' or public.is_admin())
    $f$, t || '_colaborador_ativo', t);
  end loop;
end $$;
