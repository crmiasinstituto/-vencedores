-- Remove a moderação de treinamentos por inteiro (decisão do Carlos).
--
-- Treinador faixa marrom ou preta anexa o treinamento dele e vai ao ar. Ponto.
-- Some a fila, somem as colunas de veredito, somem os triggers.
--
-- O que continua protegendo a autoria depois disso: a policy de UPDATE tem
-- `with check (created_by = auth.uid())`, então o membro não consegue deixar a linha
-- com a autoria de outra pessoa. E `is_active` tem default true, que era o que o
-- trigger de insert fazia na prática.

drop trigger if exists trg_trainings_moderacao_insert on public.trainings;
drop trigger if exists trg_trainings_moderacao_update on public.trainings;

drop function if exists public.trainings_moderacao_insert();
drop function if exists public.trainings_moderacao_update();
drop function if exists public.moderar_treinamento(uuid, boolean, text);
drop function if exists public.trainings_pendentes();
drop function if exists public.trainings_pendentes_count();
drop function if exists public.treinamento_exige_aprovacao();

-- A visibilidade volta a ser só faixa + publicado (o autor segue vendo o dele).
drop policy if exists treinamentos_por_faixa on public.trainings;
create policy treinamentos_por_faixa on public.trainings
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or (is_active = true and public.current_faixa() >= faixa_minima)
  );

drop index if exists public.trainings_moderacao_idx;

alter table public.trainings drop constraint if exists trainings_moderacao_status_chk;
alter table public.trainings
  drop column if exists moderacao_status,
  drop column if exists moderado_em,
  drop column if exists moderado_por,
  drop column if exists motivo_rejeicao;

delete from public.comunidade_config where key = 'treinamento_exige_aprovacao';

-- set_comunidade_config volta a conhecer só a faixa mínima.
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

  if p_key not in ('treinamento_faixa_minima_publicar') then
    raise exception 'chave de configuracao desconhecida: %', p_key;
  end if;

  begin
    perform (p_value #>> '{}')::public.faixa;
  exception when others then
    raise exception 'faixa invalida: %', p_value #>> '{}';
  end;

  insert into public.comunidade_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end $$;

grant execute on function public.set_comunidade_config(text, jsonb) to authenticated;
