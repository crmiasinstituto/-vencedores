-- Moderação prévia: treinamento de membro entra despublicado e só vai ao ar depois que
-- um admin aprova.
--
-- O ponto delicado e a razão de isto ser TRIGGER e não policy: RLS decide se a linha pode
-- ser escrita, não QUAIS COLUNAS. Com a policy de UPDATE que o membro já tem, ele poderia
-- mandar `is_active = true` no próprio treinamento e se auto-aprovar — a moderação seria
-- decorativa. O trigger roda depois da policy e reescreve o que o membro tentou colocar
-- nessas colunas.

alter table public.trainings
  add column if not exists moderacao_status text not null default 'aprovado',
  add column if not exists moderado_em      timestamptz,
  add column if not exists moderado_por     uuid,
  add column if not exists motivo_rejeicao  text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trainings_moderacao_status_chk'
  ) then
    alter table public.trainings add constraint trainings_moderacao_status_chk
      check (moderacao_status in ('pendente','aprovado','rejeitado'));
  end if;
end $$;

-- Tudo que já existe é conteúdo da equipe: continua aprovado.
update public.trainings set moderacao_status = 'aprovado' where moderacao_status is null;

create index if not exists trainings_moderacao_idx
  on public.trainings (moderacao_status) where moderacao_status = 'pendente';

-- ---------------------------------------------------------------- entrada

create or replace function public.trainings_moderacao_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if public.is_admin() then
    new.moderacao_status := coalesce(new.moderacao_status, 'aprovado');
    return new;
  end if;

  -- Membro não escolhe o próprio destino: entra pendente e fora do ar.
  new.moderacao_status := 'pendente';
  new.is_active        := false;
  new.moderado_em      := null;
  new.moderado_por     := null;
  new.motivo_rejeicao  := null;
  return new;
end $$;

drop trigger if exists trg_trainings_moderacao_insert on public.trainings;
create trigger trg_trainings_moderacao_insert
  before insert on public.trainings
  for each row execute function public.trainings_moderacao_insert();

-- ---------------------------------------------------------------- edição

create or replace function public.trainings_moderacao_update()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- O membro não mexe no veredito, aconteça o que acontecer no payload.
  new.moderacao_status := old.moderacao_status;
  new.is_active        := old.is_active;
  new.moderado_em      := old.moderado_em;
  new.moderado_por     := old.moderado_por;
  new.motivo_rejeicao  := old.motivo_rejeicao;
  new.created_by       := old.created_by;

  -- Editar o conteúdo devolve para a fila. Sem isso a moderação seria contornável:
  -- publica algo inofensivo, espera aprovar, troca o vídeo depois.
  if (new.title            is distinct from old.title)
  or (new.description      is distinct from old.description)
  or (new.video_url        is distinct from old.video_url)
  or (new.thumbnail_url    is distinct from old.thumbnail_url)
  or (new.category_id      is distinct from old.category_id)
  or (new.faixa_minima     is distinct from old.faixa_minima)
  or (new.duration         is distinct from old.duration)
  then
    new.moderacao_status := 'pendente';
    new.is_active        := false;
    new.moderado_em      := null;
    new.moderado_por     := null;
    new.motivo_rejeicao  := null;
  end if;

  return new;
end $$;

drop trigger if exists trg_trainings_moderacao_update on public.trainings;
create trigger trg_trainings_moderacao_update
  before update on public.trainings
  for each row execute function public.trainings_moderacao_update();

-- ---------------------------------------------------------------- visibilidade

-- Pendente e rejeitado só aparecem para o autor e para o admin.
drop policy if exists treinamentos_por_faixa on public.trainings;
create policy treinamentos_por_faixa on public.trainings
  for select using (
    created_by = auth.uid()
    or public.is_admin()
    or (
      is_active = true
      and moderacao_status = 'aprovado'
      and public.current_faixa() >= faixa_minima
    )
  );

-- ---------------------------------------------------------------- fila do admin

create or replace function public.moderar_treinamento(
  p_id      uuid,
  p_aprovar boolean,
  p_motivo  text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
declare v_titulo text;
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;

  update public.trainings set
    moderacao_status = case when p_aprovar then 'aprovado' else 'rejeitado' end,
    is_active        = p_aprovar,
    moderado_em      = now(),
    moderado_por     = auth.uid(),
    motivo_rejeicao  = case when p_aprovar then null else p_motivo end
  where id = p_id
  returning title into v_titulo;

  if v_titulo is null then
    raise exception 'treinamento nao encontrado';
  end if;

  return jsonb_build_object('ok', true, 'title', v_titulo, 'aprovado', p_aprovar);
end $$;

grant execute on function public.moderar_treinamento(uuid, boolean, text) to authenticated;

-- Fila com o autor resolvido (profiles não é legível pelo join do PostgREST).
create or replace function public.trainings_pendentes()
returns table (
  id uuid, title text, description text, thumbnail_url text, video_url text,
  duration text, faixa_minima public.faixa, category_id uuid, categoria text,
  created_at timestamptz, created_by uuid, autor_nome text, autor_faixa public.faixa
)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select t.id, t.title, t.description, t.thumbnail_url, t.video_url,
         t.duration, t.faixa_minima, t.category_id, c.nome,
         t.created_at, t.created_by, p.nome_completo, p.faixa
  from public.trainings t
  left join public.profiles p on p.user_id = t.created_by
  left join public.training_categories c on c.id = t.category_id
  where public.is_admin() and t.moderacao_status = 'pendente'
  order by t.created_at;
$$;

grant execute on function public.trainings_pendentes() to authenticated;

-- Contador para o badge do menu, sem trazer a fila inteira.
create or replace function public.trainings_pendentes_count()
returns int
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select case when public.is_admin()
    then (select count(*)::int from public.trainings where moderacao_status = 'pendente')
    else 0 end;
$$;

grant execute on function public.trainings_pendentes_count() to authenticated;
