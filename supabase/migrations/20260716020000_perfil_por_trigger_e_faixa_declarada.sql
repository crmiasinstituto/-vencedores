-- Conserta a PERDA DE CADASTRO e adiciona a faixa declarada no cadastro.
--
-- ── O BUG ────────────────────────────────────────────────────────────────────
-- Em 16/07/2026, isaacandradedantos@gmail.com se cadastrou e o perfil NUNCA foi criado. Havia
-- 2 usuários em auth.users e 0 em profiles.
--
-- Causa: o projeto tem mailer_autoconfirm = false (exige confirmar email), então signUp() NÃO
-- devolve sessão. O `supabase.from('profiles').insert(...)` que o AuthContext fazia logo depois
-- rodava como ANON — e a policy "cria_o_proprio_perfil" é `to authenticated`. O banco recusava.
-- Pior: o front fazia só `console.error(profileError)` e mostrava "Cadastro enviado!". Falha
-- silenciosa, cadastro perdido.
--
-- ── A CORREÇÃO ───────────────────────────────────────────────────────────────
-- O perfil passa a nascer no SERVIDOR, por trigger em auth.users. Não depende de sessão, não
-- depende de RLS, não dá pra falhar em silêncio no cliente. É o padrão do Supabase.
--
-- ── A FAIXA DECLARADA ────────────────────────────────────────────────────────
-- Pedido do Carlos: "precisa perguntar qual faixa o lead é, para que nosso time interno possa
-- aprovar cada um manualmente; ele fica ativo com sua pulseira de graduação mediante aceitação".
--
-- Então são DUAS colunas, e a diferença importa:
--   faixa_declarada  o que a PESSOA diz que é, no cadastro. Nunca dá acesso a nada.
--   faixa            a oficial, que o time confirma na aprovação. É esta que o RLS lê.
--
-- Se fossem a mesma coluna, qualquer um se declarava faixa preta e destrancava o catálogo
-- inteiro antes de alguém olhar.

alter table public.profiles
  add column if not exists faixa_declarada public.faixa;

comment on column public.profiles.faixa_declarada is
  'A faixa que a pessoa DIZ ter, informada no cadastro. Não dá acesso a nada — é só o que o '
  'time usa pra conferir na aprovação. A que vale é profiles.faixa, que só o admin muda.';

-- ---------------------------------------------------------------------------
-- O perfil nasce junto com o usuário
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
  -- Quem indicou, se veio código do link /i/<codigo>.
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  -- A faixa declarada. Texto inválido vira null em vez de derrubar o cadastro: perder o
  -- cadastro por causa de um campo secundário seria trocar um bug por outro.
  begin
    v_declarada := (new.raw_user_meta_data ->> 'faixa_declarada')::public.faixa;
  exception when others then
    v_declarada := null;
  end;

  insert into public.profiles (
    user_id, email, owner_name, nome_completo, telefone, profissao,
    referred_by, faixa_declarada, faixa, is_approved, is_new_member
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
    -- Todo mundo entra branco, INDEPENDENTE do que declarou. A faixa real é a que o time
    -- confirma; a declarada é só o palpite da pessoa.
    'branco',
    -- Ninguém entra aprovado. O acesso vem da aceitação do time.
    false,
    true
  )
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Cria o profile junto com o auth.users. Existe porque o cliente NÃO consegue: com '
  'mailer_autoconfirm=false o signUp não devolve sessão, e o insert do front ia como anon '
  'contra uma policy `to authenticated` — falhava calado e o cadastro se perdia.';

-- ---------------------------------------------------------------------------
-- Resgata quem já se cadastrou e ficou sem perfil
-- ---------------------------------------------------------------------------
insert into public.profiles (user_id, email, owner_name, nome_completo, faixa, is_approved, is_new_member)
select
  u.id,
  u.email,
  split_part(u.email, '@', 1),
  split_part(u.email, '@', 1),
  'branco',
  false,
  true
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.id is null
on conflict (user_id) do nothing;
