-- Unifica a identidade do membro no Supabase Auth.
--
-- Antes desta migration existiam TRÊS identidades pra mesma pessoa, sem nenhuma FK ligando:
--   auth.users            → admin do CRM (is_admin() via app_admins) e membro do portal
--   public.members        → membro do CRM/LMS, com password_hash e session_token próprios
--   public.profiles       → membro do portal (netweaving), já ligado a auth.users
--
-- A partir daqui auth.users é a identidade única. members.user_id e profiles.user_id são as
-- duas pontas: a mesma pessoa é um auth.users, com um members (LMS) e/ou um profiles (netweaving).
--
-- Por que current_member_id() ganha um caminho novo em vez de ser substituída: 17 policies de
-- RLS dependem dela (member_progress, member_milestones, member_sessions, member_contracts,
-- member_payments, member_lessons, member_modules, member_files...). Ensinando a função a
-- resolver por auth.uid() TAMBÉM, nenhuma dessas 17 precisa ser reescrita — some o risco de
-- errar uma policy no meio da migração.
--
-- O caminho legado (header x-member-token) continua valendo, então o login antigo não quebra
-- durante a transição. Ele sai depois que o front migrar pro supabase.auth.

-- ---------------------------------------------------------------------------
-- 1. A ponte members → auth.users
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Um auth.users é no máximo um member. Índice parcial porque user_id fica null nos membros
-- ainda não migrados.
create unique index if not exists members_user_id_key
  on public.members(user_id) where user_id is not null;

create index if not exists members_email_lower_idx on public.members(lower(email));

-- Backfill por email pra qualquer membro que já tenha conta no Auth.
-- (Hoje members está vazio; isto existe pro caso de importar dados antes do front migrar.)
update public.members m
   set user_id = u.id
  from auth.users u
 where m.user_id is null
   and lower(m.email) = lower(u.email);

-- ---------------------------------------------------------------------------
-- 2. current_member_id() passa a resolver pelos DOIS caminhos
-- ---------------------------------------------------------------------------
create or replace function public.current_member_id()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  headers json;
  token   text;
  m_id    uuid;
  uid     uuid;
begin
  -- Caminho novo: Supabase Auth. Preferido — sessão de verdade, refresh, reset de senha.
  uid := auth.uid();
  if uid is not null then
    select id into m_id
      from public.members
     where user_id = uid
       and status = 'active'
     limit 1;
    if m_id is not null then
      return m_id;
    end if;
  end if;

  -- Caminho legado: header x-member-token vindo do localStorage (client.ts:44).
  -- Mantido pra não derrubar sessão de membro durante a migração do front.
  begin
    headers := current_setting('request.headers', true)::json;
  exception when others then
    return null;
  end;
  if headers is null then return null; end if;

  token := headers ->> 'x-member-token';
  if token is null or length(token) < 16 then return null; end if;

  select id into m_id
    from public.members
   where session_token = token
     and status = 'active'
   limit 1;
  return m_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. O membro logado enxerga a própria linha em members
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='members' loop
    execute format('drop policy %I on public.members', p);
  end loop;
end $$;

alter table public.members enable row level security;

create policy "membro_le_a_si_mesmo" on public.members
  for select to anon, authenticated
  using (id = public.current_member_id());

create policy "membro_atualiza_a_si_mesmo" on public.members
  for update to anon, authenticated
  using (id = public.current_member_id())
  with check (id = public.current_member_id());

create policy "members_admin_full" on public.members
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. profiles (netweaving) — o portal chamava has_role()/user_roles, que NUNCA existiram
--    neste banco: o /admin do portal estava sem porteiro. Gate único: is_admin().
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
    execute format('drop policy %I on public.profiles', p);
  end loop;
end $$;

alter table public.profiles enable row level security;

-- O diretório de empresas do netweaving é o produto: todo membro aprovado vê os outros.
create policy "diretorio_visivel_pra_membro" on public.profiles
  for select to authenticated using (is_approved = true);

create policy "membro_le_o_proprio_perfil" on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy "membro_edita_o_proprio_perfil" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No signup a pessoa cria o próprio profile (portal AuthContext.tsx:66).
-- Não pode se auto-aprovar nem se auto-promover: is_approved tem que nascer false.
create policy "cria_o_proprio_perfil" on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid() and coalesce(is_approved, false) = false);

create policy "profiles_admin_full" on public.profiles
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
