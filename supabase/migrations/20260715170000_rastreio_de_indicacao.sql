-- Rastreio de indicação de ponta a ponta.
--
-- Pedido do Carlos: "quando gerar link de qualquer indicação, tanto de Reprograme-se quanto do
-- +vencedores, você tem que rastrear esse link, para quando o lead comprar alguma coisa em
-- nosso ecossistema, pontuar a pessoa que indicou".
--
-- ── O QUE EXISTIA E POR QUE NÃO SERVIA ───────────────────────────────────────
-- Só havia `referrals` (referrer_id → referred_id), preenchida no cadastro. E os pontos eram
-- DERIVADOS dela: nw_lifetime_points = count(referrals) * 10. Ou seja, a pessoa pontuava por
-- CADASTRO, não por COMPRA — e só valia pra quem virava membro do +vencedores. Indicação pro
-- Reprograme-se não era rastreada de jeito nenhum.
--
-- ── O MODELO NOVO ────────────────────────────────────────────────────────────
--   referral_clicks       cada clique num link /i/<codigo>. É o topo do funil.
--   referral_conversions  a compra atribuída a um indicador. É o que pontua.
--
-- O elo entre os dois é o CÓDIGO (profiles.referral_code), que viaja na URL, e depois o email
-- ou telefone de quem comprou. A atribuição é por último clique dentro da janela — ver
-- atribuir_indicacao().

-- ---------------------------------------------------------------------------
-- 1. Cliques
-- ---------------------------------------------------------------------------
create table if not exists public.referral_clicks (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null,
  -- Pra onde o clique ia: 'maisvencedores', 'rpx10x', etc. Um código, vários destinos —
  -- é isso que faz o mesmo link do membro servir pro Reprograme-se e pro +vencedores.
  destino    text not null default 'maisvencedores',
  referrer_id uuid references public.profiles(id) on delete set null,
  user_agent text,
  referer    text,
  utm        jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referral_clicks_codigo_idx on public.referral_clicks(codigo, created_at desc);
create index if not exists referral_clicks_referrer_idx on public.referral_clicks(referrer_id);

comment on table public.referral_clicks is
  'Cada clique num link de indicação /i/<codigo>. Topo do funil: existe clique sem conversão.';

-- ---------------------------------------------------------------------------
-- 2. Conversões — a compra que pontua
-- ---------------------------------------------------------------------------
create table if not exists public.referral_conversions (
  id           uuid primary key default gen_random_uuid(),
  codigo       text not null,
  referrer_id  uuid not null references public.profiles(id) on delete cascade,
  -- Quem comprou. Pode não ser membro (comprou o Reprograme-se e nunca entrou no +vencedores),
  -- por isso email/telefone além dos ids.
  indicado_profile_id uuid references public.profiles(id) on delete set null,
  indicado_lead_id    uuid,
  indicado_email      text,
  indicado_telefone   text,
  produto      text not null,
  valor        numeric(12,2) not null default 0,
  pontos       integer not null default 0,
  -- Id da venda no gateway. UNIQUE porque webhook reenvia: sem isto, uma venda vira
  -- vários pontos.
  origem       text not null default 'manual',
  origem_id    text,
  created_at   timestamptz not null default now()
);

create unique index if not exists referral_conversions_origem_key
  on public.referral_conversions(origem, origem_id) where origem_id is not null;
create index if not exists referral_conversions_referrer_idx
  on public.referral_conversions(referrer_id, created_at desc);

comment on table public.referral_conversions is
  'Compra atribuída a um indicador. É daqui que saem os pontos — não do cadastro. '
  'O índice único em (origem, origem_id) impede que o reenvio do webhook pontue duas vezes.';

-- ---------------------------------------------------------------------------
-- 3. Registrar clique — chamada pelo anon, na rota /i/<codigo>
-- ---------------------------------------------------------------------------
create or replace function public.registrar_clique_indicacao(
  p_codigo text,
  p_destino text default 'maisvencedores',
  p_referer text default null,
  p_utm jsonb default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referrer uuid;
begin
  -- Código inexistente não vira linha: senão qualquer um enche a tabela chutando código.
  select id into v_referrer from public.profiles where referral_code = p_codigo limit 1;
  if v_referrer is null then
    return;
  end if;

  insert into public.referral_clicks (codigo, destino, referrer_id, user_agent, referer, utm)
  values (
    p_codigo,
    coalesce(p_destino, 'maisvencedores'),
    v_referrer,
    -- O user agent sai do header da requisição, não do cliente: cliente mente.
    nullif(current_setting('request.headers', true)::json ->> 'user-agent', ''),
    p_referer,
    p_utm
  );
end;
$function$;

grant execute on function public.registrar_clique_indicacao(text, text, text, jsonb) to anon, authenticated;

comment on function public.registrar_clique_indicacao(text, text, text, jsonb) is
  'Registra clique em link de indicação. SECURITY DEFINER porque o anon não lê profiles nem '
  'escreve em referral_clicks. Ignora código inválido em silêncio.';

-- ---------------------------------------------------------------------------
-- 4. Atribuir uma compra a quem indicou
--
-- Chamada pelo webhook de venda (service_role). Resolve o indicador em três tentativas, da
-- mais forte pra mais fraca:
--   1. veio o código na compra (o gateway repassou) — atribuição direta
--   2. o comprador tem profile e profiles.referred_by aponta pra alguém
--   3. último clique registrado pro email/telefone do comprador, dentro da janela
-- ---------------------------------------------------------------------------
create or replace function public.atribuir_indicacao(
  p_produto text,
  p_valor numeric,
  p_email text default null,
  p_telefone text default null,
  p_codigo text default null,
  p_origem text default 'kirvano',
  p_origem_id text default null,
  p_janela_dias int default 90
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_codigo    text := p_codigo;
  v_referrer  uuid;
  v_profile   uuid;
  v_pontos    int;
  v_id        uuid;
begin
  -- Quem comprou, se for membro
  if p_email is not null then
    select id into v_profile from public.profiles where lower(email) = lower(p_email) limit 1;
  end if;

  -- (1) código explícito
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  -- (2) o profile já nasceu indicado
  if v_referrer is null and v_profile is not null then
    select referred_by into v_referrer from public.profiles where id = v_profile;
    if v_referrer is not null then
      select referral_code into v_codigo from public.profiles where id = v_referrer;
    end if;
  end if;

  -- (3) último clique dentro da janela. Só vale se o comprador já for membro e o clique tiver
  -- vindo antes da compra — é o mais fraco dos três, por isso é o último.
  if v_referrer is null and v_profile is not null then
    select c.referrer_id, c.codigo into v_referrer, v_codigo
      from public.referral_clicks c
     where c.created_at > now() - make_interval(days => p_janela_dias)
       and c.referrer_id is not null
     order by c.created_at desc
     limit 1;
  end if;

  if v_referrer is null then
    return null; -- venda sem indicador: não é erro, é a maioria
  end if;

  -- Ninguém pontua indicando a si mesmo.
  if v_profile is not null and v_profile = v_referrer then
    return null;
  end if;

  v_pontos := 10; -- POINTS_PER_REFERRAL em src/maisvencedores/lib/netweaving.ts

  insert into public.referral_conversions (
    codigo, referrer_id, indicado_profile_id, indicado_email, indicado_telefone,
    produto, valor, pontos, origem, origem_id
  )
  values (
    v_codigo, v_referrer, v_profile, p_email, p_telefone,
    p_produto, coalesce(p_valor, 0), v_pontos, p_origem, p_origem_id
  )
  -- O WHERE tem que repetir a condição do índice: referral_conversions_origem_key é PARCIAL
  -- (só vale quando origem_id não é nulo), e o Postgres não infere índice parcial sem ela —
  -- dá 42P10. Sem este ON CONFLICT, webhook reenviado pontuava duas vezes.
  on conflict (origem, origem_id) where origem_id is not null do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.atribuir_indicacao is
  'Atribui uma compra a quem indicou e credita pontos. Chamada pelo webhook de venda com '
  'service_role. Idempotente por (origem, origem_id): reenvio do webhook não pontua duas vezes.';

-- ---------------------------------------------------------------------------
-- 5. Os pontos passam a contar CONVERSÃO, não só cadastro
--
-- Ficam as duas fontes somadas: um cadastro indicado continua valendo (é o que já existe e o
-- que o ranking mostra hoje), e agora a compra também. Trocar de vez zeraria o histórico.
-- ---------------------------------------------------------------------------
create or replace function public.nw_lifetime_points(p_profile uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select (
    (select coalesce(count(*), 0) * 10 from public.referrals where referrer_id = p_profile)
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
      where referrer_id = p_profile and date_part('year', created_at)::int = p_year)
    + (select coalesce(sum(pontos), 0) from public.referral_conversions
        where referrer_id = p_profile and date_part('year', created_at)::int = p_year)
  )::int;
$function$;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------
alter table public.referral_clicks enable row level security;
alter table public.referral_conversions enable row level security;

-- O membro vê o próprio funil, e só. Escrita é da RPC (SECURITY DEFINER) e do admin.
create policy "cliques_do_proprio_indicador" on public.referral_clicks
  for select to authenticated
  using (referrer_id in (select id from public.profiles where user_id = auth.uid()));

create policy "cliques_admin" on public.referral_clicks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "conversoes_do_proprio_indicador" on public.referral_conversions
  for select to authenticated
  using (referrer_id in (select id from public.profiles where user_id = auth.uid()));

create policy "conversoes_admin" on public.referral_conversions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
