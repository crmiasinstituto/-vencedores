-- Campos do primeiro acesso: Instagram (obrigatório), WhatsApp, CPF, data de nascimento.
--
-- Pedido do Carlos: o cadastro precisa coletar nome completo, Instagram (obrigatório),
-- WhatsApp, CPF, data de nascimento e email. O ecossistema é sobre pessoas — esses dados são
-- como o time conhece e valida cada membro.
--
-- profiles já tinha instagram, telefone, whatsapp, nome_completo. Faltavam cpf e nascimento.

alter table public.profiles add column if not exists cpf text;
alter table public.profiles add column if not exists data_nascimento date;

comment on column public.profiles.cpf is
  'CPF do membro, coletado no cadastro. Só dígitos (o front limpa a máscara antes de enviar).';

-- ---------------------------------------------------------------------------
-- O trigger passa a gravar os campos novos vindos do signUp (raw_user_meta_data)
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
  v_nascimento date;
  v_wpp        text := nullif(trim(new.raw_user_meta_data ->> 'whatsapp'), '');
begin
  if v_codigo is not null then
    select id into v_referrer from public.profiles where referral_code = v_codigo limit 1;
  end if;

  begin
    v_declarada := (new.raw_user_meta_data ->> 'faixa_declarada')::public.faixa;
  exception when others then
    v_declarada := null;
  end;
  if v_declarada = 'branco' then
    v_declarada := null;
  end if;

  -- Data inválida vira null em vez de derrubar o cadastro.
  begin
    v_nascimento := (new.raw_user_meta_data ->> 'data_nascimento')::date;
  exception when others then
    v_nascimento := null;
  end;

  insert into public.profiles (
    user_id, email, owner_name, nome_completo, telefone, whatsapp, profissao,
    instagram, cpf, data_nascimento,
    referred_by, faixa_declarada, faixa_solicitada_em, faixa, is_approved, is_new_member
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(new.email, '@', 1)),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''), v_wpp),
    v_wpp,
    nullif(trim(new.raw_user_meta_data ->> 'profissao'), ''),
    -- Instagram sem o @: guarda só o handle, a UI põe o @ de volta.
    regexp_replace(coalesce(nullif(trim(new.raw_user_meta_data ->> 'instagram'), ''), ''), '^@', ''),
    -- CPF só com dígitos.
    nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'cpf', ''), '[^0-9]', '', 'g'), ''),
    v_nascimento,
    v_referrer,
    v_declarada,
    case when v_declarada is not null then now() else null end,
    'branco',
    false,
    true
  )
  on conflict (user_id) do nothing
  returning id into v_profile;

  -- A linha de indicação (o padrinho vê, e é de onde sai o ponto).
  if v_referrer is not null and v_profile is not null and v_referrer <> v_profile then
    insert into public.referrals (referrer_id, referred_id, status, referred_faixa)
    values (v_referrer, v_profile, 'pending', 'branco')
    on conflict do nothing;

    insert into public.referral_stats (profile_id, total_referrals, pending_referrals, updated_at)
    values (v_referrer, 0, 1, now())
    on conflict (profile_id) do update
      set pending_referrals = public.referral_stats.pending_referrals + 1,
          updated_at = now();
  end if;

  return new;
end;
$function$;
