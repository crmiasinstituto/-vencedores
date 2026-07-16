-- Destinos de checkout: o /i/<codigo> passa a servir qualquer gateway.
--
-- Pedido do Carlos: "o link não será da Kirvano, mas sim de outros checkouts como Eduzz,
-- Hotmart... então vamos pensar que lá na frente teremos outras integrações".
--
-- ── O PROBLEMA REAL DO MULTI-GATEWAY ─────────────────────────────────────────
-- Não é receber a venda — pra isso já existe `receive-sale-webhook`, que normaliza qualquer
-- gateway numa forma só. O problema é o CAMINHO DE IDA: o código de indicação precisa viajar
-- até o checkout e voltar no webhook, e cada gateway carrega isso num parâmetro diferente:
--
--   Hotmart  ?src=<codigo>          (volta como `src` no postback)
--   Eduzz    ?utm_source=<codigo>
--   Kirvano  ?utm_source=<codigo>
--
-- Chumbar esse de/para no código significa que cada checkout novo vira deploy. Virou tabela:
-- cadastrar um destino é inserir uma linha.

create table if not exists public.checkout_destinos (
  id            uuid primary key default gen_random_uuid(),
  -- O que vai na URL: /i/<codigo>?d=<slug>. Curto porque isso é colado no WhatsApp.
  slug          text not null unique,
  nome          text not null,
  -- Pra onde mandar. Null = destino interno (o cadastro do +vencedores).
  url           text,
  -- Qual gateway processa. Vira `origem` em referral_conversions, e é metade da chave de
  -- idempotência (origem, origem_id) — dois gateways podem repetir transaction_id.
  gateway       text,
  -- O parâmetro que leva o código até o checkout. É isto que muda entre Hotmart e Eduzz.
  param_codigo  text not null default 'utm_source',
  ativo         boolean not null default true,
  ordem         integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table public.checkout_destinos is
  'Destinos do link rastreado /i/<codigo>?d=<slug>. param_codigo existe porque cada gateway '
  'carrega o rastreio num parâmetro diferente (Hotmart=src, Eduzz/Kirvano=utm_source). '
  'Checkout novo = linha nova, sem deploy.';

insert into public.checkout_destinos (slug, nome, url, gateway, param_codigo, ordem) values
  -- Destino interno: url null manda pro /maisvencedores/convite/<codigo>.
  ('maisvencedores', '+ que Vencedores — cadastro', null, null, 'ref', 0),
  -- O Reprograme-se ainda não tem URL: o Carlos precisa mandar. Com url null, cai no cadastro
  -- em vez de jogar a pessoa em lugar nenhum — e o clique já é rastreado do mesmo jeito.
  ('rpx10x', 'Reprograme-se 10X', null, null, 'src', 1)
on conflict (slug) do nothing;

alter table public.checkout_destinos enable row level security;

-- O link /i/ é público: o anon precisa resolver o destino sem estar logado.
create policy "destinos_leitura_publica" on public.checkout_destinos
  for select to anon, authenticated using (ativo = true);

create policy "destinos_admin" on public.checkout_destinos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Resolver o destino: devolve pro front a URL já montada com o código no lugar certo.
-- SECURITY DEFINER + grant pro anon porque isto roda antes de qualquer login.
-- ---------------------------------------------------------------------------
create or replace function public.resolver_destino_indicacao(
  p_codigo text,
  p_slug text default 'maisvencedores'
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  d record;
  v_url text;
begin
  select * into d from public.checkout_destinos where slug = p_slug and ativo limit 1;

  -- Slug desconhecido ou destino sem URL: cai no cadastro interno. Nunca devolve nulo — a
  -- pessoa clicou num link e tem que chegar em algum lugar.
  if d is null or d.url is null or d.url = '' then
    return jsonb_build_object(
      'url', '/maisvencedores/convite/' || p_codigo,
      'externo', false,
      'gateway', null
    );
  end if;

  v_url := d.url
        || case when position('?' in d.url) > 0 then '&' else '?' end
        || d.param_codigo || '=' || p_codigo;

  return jsonb_build_object('url', v_url, 'externo', true, 'gateway', d.gateway);
end;
$function$;

grant execute on function public.resolver_destino_indicacao(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- atribuir_indicacao: tirar o viés de Kirvano
--
-- O default de p_origem era 'kirvano'. Com Eduzz e Hotmart entrando, um default assim faz uma
-- venda da Hotmart ser gravada como Kirvano quando o adaptador esquece de passar a origem — e
-- aí a chave de idempotência (origem, origem_id) colide entre gateways diferentes. Sem default:
-- quem chama diz de onde veio.
-- ---------------------------------------------------------------------------
drop function if exists public.atribuir_indicacao(text, numeric, text, text, text, text, text, int);

create or replace function public.atribuir_indicacao(
  p_produto text,
  p_valor numeric,
  p_origem text,
  p_email text default null,
  p_telefone text default null,
  p_codigo text default null,
  p_origem_id text default null,
  p_janela_dias int default 90
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_codigo    text := nullif(trim(p_codigo), '');
  v_referrer  uuid;
  v_profile   uuid;
  v_pontos    int;
  v_id        uuid;
begin
  if p_origem is null or trim(p_origem) = '' then
    raise exception 'p_origem é obrigatório: identifica o gateway (kirvano, eduzz, hotmart...) e é metade da chave de idempotência';
  end if;

  if p_email is not null then
    select id into v_profile from public.profiles where lower(email) = lower(p_email) limit 1;
  end if;

  -- (1) o código veio na venda (o checkout repassou o param). É a atribuição mais forte.
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  -- (2) o comprador já é membro e nasceu indicado
  if v_referrer is null and v_profile is not null then
    select referred_by into v_referrer from public.profiles where id = v_profile;
    if v_referrer is not null then
      select referral_code into v_codigo from public.profiles where id = v_referrer;
    end if;
  end if;

  -- (3) último clique na janela. O mais fraco — por isso é o último.
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
    p_produto, coalesce(p_valor, 0), v_pontos, lower(trim(p_origem)), p_origem_id
  )
  -- O WHERE repete a condição do índice: referral_conversions_origem_key é PARCIAL, e o
  -- Postgres não infere índice parcial sem ela (42P10).
  on conflict (origem, origem_id) where origem_id is not null do nothing
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.atribuir_indicacao is
  'Atribui uma compra a quem indicou e credita pontos. Serve qualquer gateway: p_origem diz '
  'qual (kirvano, eduzz, hotmart...) e é obrigatório porque forma a chave de idempotência com '
  'p_origem_id. Chamar com service_role, do adaptador do webhook.';
