-- Faixa marrom pra cima pode publicar treinamento na comunidade.
--
-- Ate aqui so is_admin() escrevia em trainings. A regra e por FAIXA e a faixa e uma
-- hierarquia (branco < vermelho < verde < roxo < marrom < preta), entao "marrom" quer
-- dizer marrom E preta — quem subiu na faixa nao perde o que ja podia fazer.

alter table public.trainings
  add column if not exists created_by uuid default auth.uid();

comment on column public.trainings.created_by is
  'Quem publicou. NULL = veio da equipe (antes desta coluna existir).';

create index if not exists trainings_created_by_idx on public.trainings (created_by);

-- ---------------------------------------------------------------- quem pode escrever

-- Publicar: precisa ser marrom+ e so consegue publicar em nome de si mesmo.
drop policy if exists trainings_membro_insert on public.trainings;
create policy trainings_membro_insert on public.trainings
  for insert to authenticated
  with check (
    public.current_faixa() >= 'marrom'::public.faixa
    and created_by = auth.uid()
  );

-- Editar e apagar: so o proprio treinamento. Nao mexe no dos outros nem no da equipe.
drop policy if exists trainings_membro_update on public.trainings;
create policy trainings_membro_update on public.trainings
  for update to authenticated
  using (created_by = auth.uid() and public.current_faixa() >= 'marrom'::public.faixa)
  with check (created_by = auth.uid());

drop policy if exists trainings_membro_delete on public.trainings;
create policy trainings_membro_delete on public.trainings
  for delete to authenticated
  using (created_by = auth.uid() and public.current_faixa() >= 'marrom'::public.faixa);

-- Ler: o autor enxerga o proprio treinamento mesmo despublicado, senao ele sumiria da
-- tela da pessoa no instante em que um admin o desativasse.
drop policy if exists treinamentos_por_faixa on public.trainings;
create policy treinamentos_por_faixa on public.trainings
  for select using (
    created_by = auth.uid()
    or (is_active = true and (public.is_admin() or public.current_faixa() >= faixa_minima))
  );

-- ---------------------------------------------------------------- upload de vídeo

-- O bucket videos so aceitava upload de admin — sem isso o membro monta o formulario
-- inteiro e toma erro no unico passo que importa.
drop policy if exists "Faixa marrom pode subir video de treinamento" on storage.objects;
create policy "Faixa marrom pode subir video de treinamento" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and public.current_faixa() >= 'marrom'::public.faixa
  );

-- A thumbnail vai pro bucket uploads, que ja aceita qualquer autenticado.

-- ---------------------------------------------------------------- autoria na listagem

-- Usada pelo painel do admin pra mostrar quem publicou cada treinamento. Vai por RPC
-- porque profiles nao e legivel de graca pelo join do PostgREST.
create or replace function public.trainings_com_autor()
returns table (
  id uuid, title text, faixa_minima public.faixa, is_active boolean,
  created_at timestamptz, created_by uuid, autor_nome text, autor_faixa public.faixa
)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select t.id, t.title, t.faixa_minima, t.is_active, t.created_at, t.created_by,
         p.nome_completo, p.faixa
  from public.trainings t
  left join public.profiles p on p.user_id = t.created_by
  where public.is_admin()
  order by t.created_at desc;
$$;

grant execute on function public.trainings_com_autor() to authenticated;
