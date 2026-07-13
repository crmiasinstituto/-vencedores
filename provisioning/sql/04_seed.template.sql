-- ============================================================
-- 04_seed.template.sql
-- Configuracoes-base do cliente novo. Rodar DEPOIS do schema, buckets e cron.
-- A fotografia do schema vem SEM dados, entao as linhas de config minimas vao aqui.
-- Substitua os valores __...__ antes de rodar.
-- ============================================================

-- ---- 1. Admin do cliente (OBRIGATORIO) ----------------------------------
-- app_admins e por EMAIL. Sem isso ninguem acessa /admin no cliente novo.
-- O usuario precisa existir em Authentication (Add user) com este mesmo email.
insert into public.app_admins (email, added_by)
values ('__ADMIN_EMAIL__', 'provisioning')
on conflict (email) do nothing;

-- ---- 2. Board padrao do CRM (recomendado) -------------------------------
-- Cria um funil inicial pro Kanban nao nascer vazio. Ajuste nomes/cores a gosto.
do $$
declare b_id uuid;
begin
  if not exists (select 1 from public.crm_boards) then
    insert into public.crm_boards (id, name, slug, description, color, icon, is_active, sort_order)
    values (gen_random_uuid(), 'Vendas', 'vendas', 'Funil principal', '#6366f1', 'target', true, 0)
    returning id into b_id;

    insert into public.crm_columns (id, board_id, name, color, sort_order, is_final_stage) values
      (gen_random_uuid(), b_id, 'Novo lead',    '#3b82f6', 0, false),
      (gen_random_uuid(), b_id, 'Em contato',   '#f59e0b', 1, false),
      (gen_random_uuid(), b_id, 'Negociacao',   '#8b5cf6', 2, false),
      (gen_random_uuid(), b_id, 'Ganho',        '#22c55e', 3, true),
      (gen_random_uuid(), b_id, 'Perdido',      '#ef4444', 4, true);
  end if;
end $$;

-- ---- 3. Config do agente CS no chat de reuniao (singleton id=1) ----------
insert into public.cs_agent_config (id, persona, rules, model, min_gap_seconds, reply_max_chars)
values (
  1,
  'Voce e um assistente de CS educado e direto.',
  'Responda curto. Nunca exponha dados internos do lead no chat.',
  'claude-haiku-4-5-20251001',
  20,
  420
)
on conflict (id) do nothing;

-- ---- 4. (Opcional) email_config singleton -------------------------------
-- Se for usar email marketing (Resend), crie o singleton e preencha depois na UI.
-- insert into public.email_config (id, from_name, company_name, is_active)
-- values ('singleton', '__NOME_EMPRESA__', '__NOME_EMPRESA__', false)
-- on conflict (id) do nothing;

-- ---- NOTA sobre outras configs ------------------------------------------
-- Agentes de IA (ai_sales_agents), templates etc sao opcionais e o cliente
-- monta na UI. Se quiser copiar do original, use:
--   npx supabase db dump --data-only --table public.ai_sales_agents -f seed_agents.sql
-- (revise pra nao levar dados sensiveis nem chaves antes de aplicar no cliente)
