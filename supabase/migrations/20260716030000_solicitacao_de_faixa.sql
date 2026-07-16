-- Declarar faixa vira SOLICITAÇÃO, e deixa de ser barreira no cadastro.
--
-- Pedido do Carlos: "quando o lead for se cadastrar, se ele não souber a faixa, deixe ele
-- branca ali na boas-vindas; quando ele definir a faixa, aí fica a solicitação para nosso time
-- aprovar ele na faixa".
--
-- ── O QUE MUDA ───────────────────────────────────────────────────────────────
-- Antes (meu erro): o cadastro EXIGIA escolher a faixa. Quem chega novo não sabe o que é FPO
-- nem Practitioner — perguntar isso na porta trava justamente quem o ecossistema mais quer.
--
-- Agora: quem não sabe entra BRANCA e acabou. Nada pra aprovar — branca é o começo, não um
-- privilégio. Declarar faixa acima de branca é que vira pedido pro time.
--
-- ── POR QUE NÃO PRECISA DE TABELA NOVA ───────────────────────────────────────
-- A solicitação é um ESTADO do perfil, não uma entidade: existe no máximo uma por pessoa, e a
-- anterior não interessa depois de resolvida. Duas colunas dizem tudo:
--
--   faixa_declarada       o que a pessoa pede. null = não pediu nada.
--   faixa_solicitada_em   quando pediu. null = não há pedido aberto.
--
-- Pedido pendente = faixa_solicitada_em IS NOT NULL. Ao decidir, o time zera as duas.

alter table public.profiles
  add column if not exists faixa_solicitada_em timestamptz;

comment on column public.profiles.faixa_solicitada_em is
  'Quando a pessoa pediu a faixa de faixa_declarada. Null = sem pedido aberto. O time zera '
  'esta coluna ao aprovar ou recusar.';

create index if not exists profiles_faixa_pendente_idx
  on public.profiles(faixa_solicitada_em) where faixa_solicitada_em is not null;

-- ---------------------------------------------------------------------------
-- O membro pede uma faixa
--
-- SECURITY DEFINER porque o membro NÃO pode escrever em profiles.faixa (só o admin pode, via
-- policy). Esta função é a única porta: ela escreve em faixa_declarada, nunca em faixa.
-- ---------------------------------------------------------------------------
create or replace function public.solicitar_faixa(p_faixa public.faixa)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_profile uuid;
  v_atual   public.faixa;
begin
  select id, faixa into v_profile, v_atual
    from public.profiles where user_id = auth.uid() limit 1;

  if v_profile is null then
    raise exception 'sem perfil para este usuário';
  end if;

  -- Pedir branca não é pedido: é o padrão de quem entra. Cancela qualquer pedido aberto.
  if p_faixa = 'branco' then
    update public.profiles
       set faixa_declarada = null, faixa_solicitada_em = null, updated_at = now()
     where id = v_profile;
    return;
  end if;

  -- Pedir o que já tem também não é pedido.
  if p_faixa = v_atual then
    update public.profiles
       set faixa_declarada = null, faixa_solicitada_em = null, updated_at = now()
     where id = v_profile;
    return;
  end if;

  update public.profiles
     set faixa_declarada = p_faixa,
         faixa_solicitada_em = now(),
         updated_at = now()
   where id = v_profile;
end;
$function$;

grant execute on function public.solicitar_faixa(public.faixa) to authenticated;

comment on function public.solicitar_faixa(public.faixa) is
  'O membro pede uma faixa. Escreve só em faixa_declarada — nunca em faixa, que é do admin. '
  'Pedir branca ou a faixa que já tem cancela o pedido em vez de abrir um.';

-- ---------------------------------------------------------------------------
-- O time decide
-- ---------------------------------------------------------------------------
create or replace function public.decidir_faixa(
  p_profile uuid,
  p_aprovar boolean,
  p_faixa public.faixa default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_pedida public.faixa;
begin
  if not public.is_admin() then
    raise exception 'só admin decide faixa';
  end if;

  select faixa_declarada into v_pedida from public.profiles where id = p_profile;

  if p_aprovar then
    -- p_faixa permite ao time conceder uma faixa DIFERENTE da pedida: a pessoa se declara
    -- roxa, o time confere e vê que é verde. Sem isso, aprovar seria só "sim ou não" e o time
    -- teria que recusar pra depois corrigir na mão.
    update public.profiles
       set faixa = coalesce(p_faixa, v_pedida, faixa),
           is_approved = true,
           approved_at = now(),
           faixa_declarada = null,
           faixa_solicitada_em = null,
           updated_at = now()
     where id = p_profile;
  else
    -- Recusar fecha o pedido e mantém a faixa atual. Não desaprova a pessoa: ela continua
    -- membro, só não na faixa que pediu.
    update public.profiles
       set faixa_declarada = null,
           faixa_solicitada_em = null,
           updated_at = now()
     where id = p_profile;
  end if;
end;
$function$;

grant execute on function public.decidir_faixa(uuid, boolean, public.faixa) to authenticated;

comment on function public.decidir_faixa(uuid, boolean, public.faixa) is
  'O admin aprova ou recusa o pedido de faixa. p_faixa permite conceder faixa diferente da '
  'pedida (a pessoa acha que é roxa, o time confere e concede verde).';

-- ---------------------------------------------------------------------------
-- O trigger do cadastro: faixa declarada vira pedido, não privilégio
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
begin
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  -- Texto inválido vira null em vez de derrubar o cadastro: perder o cadastro por causa de um
  -- campo secundário seria trocar um bug por outro.
  begin
    v_declarada := (new.raw_user_meta_data ->> 'faixa_declarada')::public.faixa;
  exception when others then
    v_declarada := null;
  end;

  -- Branca não é pedido: é onde todo mundo começa. Só faixa acima disso vira solicitação.
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
    -- Todo mundo entra branco, independente do que declarou. A faixa real é a que o time
    -- confirma; a declarada é só o pedido.
    'branco',
    false,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;
