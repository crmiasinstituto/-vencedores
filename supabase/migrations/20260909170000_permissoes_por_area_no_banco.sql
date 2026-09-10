-- Permissões de colaborador passam a valer NO BANCO, não só escondendo telas.
--
-- Como estava: `permissoes` existia em app_admins mas nenhuma policy olhava para ela.
-- is_admin() respondia true para qualquer colaborador ativo, então o recorte por área
-- era só cosmético — bastava chamar a API direto para ler tudo. O aviso na própria tela
-- dizia isso ("no banco, todo colaborador ainda é tratado como administrador").
--
-- O que muda:
--   is_admin()        continua = colaborador ATIVO (desativar já cortava e segue cortando)
--   is_admin_total()  só quem tem '*' — usado nas tabelas com credencial
--   tem_acesso(url)   '*' ou a url específica; é o que as telas por área devem usar

create or replace function public.minhas_permissoes()
returns text[]
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select coalesce(a.permissoes, '{}'::text[])
  from public.app_admins a
  where a.email = (select lower(u.email) from auth.users u where u.id = auth.uid())
    and a.is_active
  limit 1;
$$;

grant execute on function public.minhas_permissoes() to authenticated;

-- Acesso irrestrito: é o que '*' significa. Quem tem recorte NÃO passa aqui.
create or replace function public.is_admin_total()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select coalesce(public.minhas_permissoes() @> array['*'], false);
$$;

grant execute on function public.is_admin_total() to authenticated;

-- Acesso a uma área (a chave é a própria url da tela).
create or replace function public.tem_acesso(p_url text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select coalesce(
    public.minhas_permissoes() @> array['*']
    or public.minhas_permissoes() @> array[p_url],
    false);
$$;

grant execute on function public.tem_acesso(text) to authenticated;

-- ── Credenciais: só acesso total ────────────────────────────────────────────────
--
-- email_config guarda a chave da API do Resend e estava com policy `using (true)` para
-- qualquer authenticated: qualquer colaborador logado lia a chave e podia disparar e-mail
-- em nome do instituto por fora do CRM.

drop policy if exists email_config_authenticated_all on public.email_config;
create policy email_config_admin_total on public.email_config
  for all to authenticated
  using (public.is_admin_total()) with check (public.is_admin_total());

-- whatsapp_instances guarda o token da uazapi e o access token da Meta.
drop policy if exists admin_full_access on public.whatsapp_instances;
create policy whatsapp_instances_admin_total on public.whatsapp_instances
  for all to authenticated
  using (public.is_admin_total()) with check (public.is_admin_total());

-- Mas o inbox e as telas de WhatsApp precisam saber QUE instâncias existem, sem ver
-- credencial. Daí uma view sem as colunas secretas.
create or replace view public.whatsapp_instances_publicas as
  select id, instance_name, phone_number, provider, status, channel, purpose,
         business_account_id, phone_number_id, avatar_url, is_dedicated_blast,
         created_at, updated_at
  from public.whatsapp_instances;

grant select on public.whatsapp_instances_publicas to authenticated;

-- ── app_admins: quem mexe em permissão ──────────────────────────────────────────
--
-- Tem RLS ligado e ZERO policies, então nem o front lê — a tela de colaboradores vai por
-- RPC. Deixo explícito que só acesso total enxerga, senão um colaborador com recorte
-- poderia se auto-promover para '*'.

drop policy if exists app_admins_total on public.app_admins;
create policy app_admins_total on public.app_admins
  for all to authenticated
  using (public.is_admin_total()) with check (public.is_admin_total());
