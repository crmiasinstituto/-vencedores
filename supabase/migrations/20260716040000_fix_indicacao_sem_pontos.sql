-- CORREÇÃO: indicação não gerava ponto nenhum.
--
-- Regressão introduzida por mim na 20260716020000. Ao mover a criação do perfil pro trigger,
-- levei junto o código do AuthContext que criava a linha em `referrals` — e não recriei. O
-- trigger gravava profiles.referred_by, mas ninguém contava isso: os pontos saem de
-- `referrals` (nw_lifetime_points = count(referrals)*10 + conversões). Resultado: quem indicava
-- via o cadastro acontecer e zero ponto.
--
-- ── QUANDO O PONTO CAI ───────────────────────────────────────────────────────
-- O ponto passa a exigir referral APROVADO, não só cadastrado. Antes, count(referrals) contava
-- qualquer linha — inclusive de gente que preencheu formulário e o time nunca aceitou. Pontuar
-- por cadastro pendente é pagar por lead, não por membro; e num sistema que dá prêmio por
-- ponto, isso é convite pra encher de cadastro falso.
--
-- Fica assim:
--   cadastro pelo link  -> referrals(status='pending'). O padrinho JÁ VÊ que a pessoa entrou.
--   time aprova         -> status='approved' -> 10 pontos.
--   compra no ecossistema -> referral_conversions -> mais pontos (já existia).

-- ---------------------------------------------------------------------------
-- 1. O trigger volta a criar a linha de indicação
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referrer   uuid;
  v_codigo     text := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
  v_declarada  public.faixa;
  v_profile    uuid;
begin
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  begin
    v_declarada := (new.raw_user_meta_data ->> 'faixa_declarada')::public.faixa;
  exception when others then
    v_declarada := null;
  end;

  -- Branca não é pedido: é onde todo mundo começa.
  if v_declarada = 'branco' then
    v_declarada := null;
  end if;

  insert into public.profiles (
    user_id, email, owner_name, nome_completo, telefone, profissao,
    referred_by, faixa_declarada, faixa_solicitada_em, faixa, is_approved, is_new_member
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(new.email, '@', 1)),
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'profissao'), ''),
    v_referrer,
    v_declarada,
    case when v_declarada is not null then now() else null end,
    'branco',
    false,
    true
  )
  on conflict (user_id) do nothing
  returning id into v_profile;

  -- A linha de indicação. É ELA que o padrinho vê e de onde sai o ponto — profiles.referred_by
  -- sozinho não conta pra nada.
  if v_referrer is not null and v_profile is not null and v_referrer <> v_profile then
    insert into public.referrals (referrer_id, referred_id, status, referred_faixa)
    values (v_referrer, v_profile, 'pending', 'branco')
    on conflict do nothing;

    -- O contador de pendentes do padrinho, pra ele ver o movimento na hora.
    insert into public.referral_stats (profile_id, total_referrals, pending_referrals, updated_at)
    values (v_referrer, 0, 1, now())
    on conflict (profile_id) do update
      set pending_referrals = public.referral_stats.pending_referrals + 1,
          updated_at = now();
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Ponto só de indicação APROVADA
-- ---------------------------------------------------------------------------
create or replace function public.nw_lifetime_points(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (
    (select coalesce(count(*), 0) * 10 from public.referrals
      where referrer_id = p_profile and status = 'approved')
    + (select coalesce(sum(pontos), 0) from public.referral_conversions where referrer_id = p_profile)
  )::int;
$function$;

create or replace function public.nw_season_points(
  p_profile uuid,
  p_year integer default (date_part('year', now()))::integer
)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (
    (select coalesce(count(*), 0) * 10 from public.referrals
      where referrer_id = p_profile and status = 'approved'
        and date_part('year', created_at)::int = p_year)
    + (select coalesce(sum(pontos), 0) from public.referral_conversions
        where referrer_id = p_profile and date_part('year', created_at)::int = p_year)
  )::int;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Aprovar o membro aprova a indicação dele
--
-- Sem isto o referral ficava 'pending' pra sempre e o padrinho nunca pontuava, por mais que o
-- time aprovasse a pessoa. O trigger trigger_update_referral_stats já cuida do contador quando
-- o status vira 'approved'.
-- ---------------------------------------------------------------------------
create or replace function public.aprovar_indicacao_do_membro()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.is_approved = true and coalesce(old.is_approved, false) = false then
    update public.referrals
       set status = 'approved',
           approved_at = now(),
           referred_faixa = new.faixa
     where referred_id = new.id
       and status = 'pending';
  end if;
  return new;
end;
$function$;

drop trigger if exists on_member_approved on public.profiles;
create trigger on_member_approved
  after update of is_approved on public.profiles
  for each row execute function public.aprovar_indicacao_do_membro();

comment on function public.aprovar_indicacao_do_membro() is
  'Quando o time aprova o membro, a indicação que o trouxe vira approved e o padrinho pontua. '
  'Sem isto o referral ficava pending pra sempre.';

-- ---------------------------------------------------------------------------
-- 4. Quem indicou eu, e como está — pro padrinho ver o próprio funil
-- ---------------------------------------------------------------------------
create or replace function public.minhas_indicacoes()
returns table (
  nome text,
  status text,
  faixa public.faixa,
  entrou_em timestamptz,
  aprovado_em timestamptz,
  pontos int
)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select
    -- Só o primeiro nome: o padrinho precisa saber QUEM entrou, não os dados da pessoa.
    split_part(coalesce(p.nome_completo, p.owner_name, ''), ' ', 1),
    r.status,
    p.faixa,
    r.created_at,
    r.approved_at,
    case when r.status = 'approved' then 10 else 0 end
  from public.referrals r
  join public.profiles p on p.id = r.referred_id
  where r.referrer_id = (select id from public.profiles where user_id = auth.uid() limit 1)
  order by r.created_at desc;
$function$;

grant execute on function public.minhas_indicacoes() to authenticated;

comment on function public.minhas_indicacoes() is
  'O funil de indicações do próprio membro: quem entrou pelo link dele, em que status e '
  'quantos pontos rendeu. Só primeiro nome — o padrinho não precisa do email de ninguém.';
