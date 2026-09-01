-- Quem pode publicar treinamento vira CONFIGURAÇÃO, não regra chumbada.
--
-- Estava 'marrom' escrito dentro da policy: mudar para roxo (ou fechar de novo) exigiria
-- uma migration a cada vez. Agora a faixa mínima mora em comunidade_config e a policy lê
-- de lá, então a decisão passa a ser do admin, dentro da própria comunidade.

create table if not exists public.comunidade_config (
  key        text primary key,
  value      jsonb not null,
  descricao  text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.comunidade_config enable row level security;

-- Todo mundo logado lê (o front precisa saber se mostra o botão de publicar);
-- só admin escreve.
drop policy if exists comunidade_config_leitura on public.comunidade_config;
create policy comunidade_config_leitura on public.comunidade_config
  for select to authenticated using (true);

drop policy if exists comunidade_config_admin on public.comunidade_config;
create policy comunidade_config_admin on public.comunidade_config
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.comunidade_config (key, value, descricao) values
  ('treinamento_faixa_minima_publicar', '"marrom"'::jsonb,
   'Faixa mínima para um membro publicar treinamento na comunidade. Vale da faixa escolhida para cima.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- regra única

-- Fonte única da verdade, usada pela policy E pelo front. Se o valor da config for
-- inválido ou sumir, cai em 'marrom' — nunca abre sozinha para todo mundo.
create or replace function public.faixa_minima_publicar_treinamento()
returns public.faixa
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare v text; v_faixa public.faixa;
begin
  select value #>> '{}' into v from public.comunidade_config
   where key = 'treinamento_faixa_minima_publicar';
  begin
    v_faixa := v::public.faixa;
  exception when others then
    v_faixa := 'marrom'::public.faixa;
  end;
  return coalesce(v_faixa, 'marrom'::public.faixa);
end $$;

create or replace function public.pode_publicar_treinamento()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select public.is_admin()
      or public.current_faixa() >= public.faixa_minima_publicar_treinamento();
$$;

grant execute on function public.pode_publicar_treinamento() to authenticated;
grant execute on function public.faixa_minima_publicar_treinamento() to authenticated;

-- ---------------------------------------------------------------- policies passam a ler a config

drop policy if exists trainings_membro_insert on public.trainings;
create policy trainings_membro_insert on public.trainings
  for insert to authenticated
  with check (public.pode_publicar_treinamento() and created_by = auth.uid());

drop policy if exists trainings_membro_update on public.trainings;
create policy trainings_membro_update on public.trainings
  for update to authenticated
  using (created_by = auth.uid() and public.pode_publicar_treinamento())
  with check (created_by = auth.uid());

drop policy if exists trainings_membro_delete on public.trainings;
create policy trainings_membro_delete on public.trainings
  for delete to authenticated
  using (created_by = auth.uid() and public.pode_publicar_treinamento());

drop policy if exists "Faixa marrom pode subir video de treinamento" on storage.objects;
drop policy if exists "Membro autorizado sobe video de treinamento" on storage.objects;
create policy "Membro autorizado sobe video de treinamento" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'videos' and public.pode_publicar_treinamento());

-- ---------------------------------------------------------------- escrita da config

create or replace function public.set_comunidade_config(p_key text, p_value jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;

  -- Só chaves conhecidas: sem isso a tabela vira depósito de qualquer coisa que o front mandar.
  if p_key not in ('treinamento_faixa_minima_publicar') then
    raise exception 'chave de configuracao desconhecida: %', p_key;
  end if;

  if p_key = 'treinamento_faixa_minima_publicar' then
    begin
      perform (p_value #>> '{}')::public.faixa;
    exception when others then
      raise exception 'faixa invalida: %', p_value #>> '{}';
    end;
  end if;

  insert into public.comunidade_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end $$;

grant execute on function public.set_comunidade_config(text, jsonb) to authenticated;
