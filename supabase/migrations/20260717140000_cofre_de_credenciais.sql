-- Cofre de credenciais gerenciável pelo admin no front.
--
-- Pedido do Carlos: um lugar nas Configurações pra ele alimentar depois "todas as nossas
-- chaves" (Resend, LiveKit, etc.) sem precisar de mim ou do painel do Supabase.
--
-- ── SEGURANÇA (o ponto mais delicado) ────────────────────────────────────────
-- Isto guarda SEGREDO. Três defesas:
--   1. RLS: só is_admin() lê ou escreve. O anon e o membro comum não tocam.
--   2. A UI NUNCA recebe o valor de volta. Ler é via credenciais_status(), que devolve só
--      { slug, configurada: bool } — o segredo não viaja pro navegador de ninguém, nem do
--      admin. Escrever é via salvar_credencial(), que só grava.
--   3. Edge functions leem via service_role (ignora RLS), server-side.
--
-- Não é criptografia em repouso de verdade (o valor fica em texto na tabela, como já ficam os
-- secrets do Supabase). Mas fecha o vetor que importa: vazar chave pro cliente.

create table if not exists public.app_credentials (
  slug          text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

comment on table public.app_credentials is
  'Cofre de chaves de integração, gerenciado pelo admin. RLS admin-only; o valor NUNCA volta '
  'pro cliente (ler é via credenciais_status, que só diz se está configurada). Edge functions '
  'leem via service_role.';

alter table public.app_credentials enable row level security;

create policy "credenciais_admin" on public.app_credentials
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Status: diz o que está configurado SEM devolver o segredo
-- ---------------------------------------------------------------------------
create or replace function public.credenciais_status()
returns table (slug text, configurada boolean, atualizado_em timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.slug, (c.valor is not null and length(c.valor) > 0), c.atualizado_em
    from public.app_credentials c
   where public.is_admin();
$function$;

grant execute on function public.credenciais_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Salvar / substituir uma credencial
--
-- Só admin. Valor vazio APAGA a credencial (jeito de "remover" pela UI). Pra Resend, espelha
-- em email_config, que é de onde send-email-campaign lê hoje — assim o Carlos configura num
-- lugar só e o envio passa a funcionar (falta o SPF do domínio, à parte).
-- ---------------------------------------------------------------------------
create or replace function public.salvar_credencial(p_slug text, p_valor text)
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'só admin gerencia credenciais';
  end if;

  if p_valor is null or length(trim(p_valor)) = 0 then
    delete from public.app_credentials where slug = p_slug;
  else
    insert into public.app_credentials (slug, valor, atualizado_em, atualizado_por)
    values (
      p_slug, trim(p_valor), now(),
      (select email from auth.users where id = auth.uid())
    )
    on conflict (slug) do update
      set valor = excluded.valor, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  end if;

  -- Resend também vai pra email_config (singleton), que é de onde a infra de e-mail lê.
  if p_slug = 'resend_api_key' then
    insert into public.email_config (id, resend_api_key)
    values ('singleton', nullif(trim(coalesce(p_valor, '')), ''))
    on conflict (id) do update set resend_api_key = nullif(trim(coalesce(p_valor, '')), '');
  end if;
end;
$function$;

grant execute on function public.salvar_credencial(text, text) to authenticated;

comment on function public.salvar_credencial(text, text) is
  'Admin grava/substitui uma credencial. Valor vazio remove. resend_api_key também espelha em '
  'email_config, de onde send-email-campaign lê.';
