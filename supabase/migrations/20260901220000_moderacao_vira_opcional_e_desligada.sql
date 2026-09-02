-- Moderação prévia passa a ser OPCIONAL, e nasce DESLIGADA.
--
-- Decisão do Carlos (01/09/2026): treinador faixa marrom ou preta anexa o treinamento dele
-- e vai direto ao ar, sem fila de aprovação. A maquinaria de moderação continua aqui atrás
-- de uma chave em comunidade_config — ligar de novo é um clique, não uma migration.

insert into public.comunidade_config (key, value, descricao) values
  ('treinamento_exige_aprovacao', 'false'::jsonb,
   'Se ligado, treinamento publicado por membro entra despublicado e só vai ao ar depois que um admin aprova.')
on conflict (key) do nothing;

create or replace function public.treinamento_exige_aprovacao()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select value = 'true'::jsonb from public.comunidade_config
      where key = 'treinamento_exige_aprovacao'),
    false
  );
$$;

grant execute on function public.treinamento_exige_aprovacao() to authenticated;

-- ---------------------------------------------------------------- entrada

create or replace function public.trainings_moderacao_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $$
begin
  if public.is_admin() or not public.treinamento_exige_aprovacao() then
    new.moderacao_status := 'aprovado';
    -- Sem fila, o membro publica no ar. is_active só fica false se ele mesmo pediu.
    new.is_active := coalesce(new.is_active, true);
    return new;
  end if;

  new.moderacao_status := 'pendente';
  new.is_active        := false;
  new.moderado_em      := null;
  new.moderado_por     := null;
  new.motivo_rejeicao  := null;
  return new;
end $$;

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

  -- O autor nunca decide o próprio veredito nem troca a autoria, com ou sem moderação.
  new.moderado_em     := old.moderado_em;
  new.moderado_por    := old.moderado_por;
  new.motivo_rejeicao := old.motivo_rejeicao;
  new.created_by      := old.created_by;

  if not public.treinamento_exige_aprovacao() then
    -- Sem fila: ele edita o que é dele e o conteúdo continua no ar.
    new.moderacao_status := 'aprovado';
    return new;
  end if;

  new.moderacao_status := old.moderacao_status;
  new.is_active        := old.is_active;

  -- Com fila ligada, editar o conteúdo devolve para a fila: senão bastaria publicar algo
  -- inofensivo, esperar aprovar e trocar o vídeo depois.
  if (new.title         is distinct from old.title)
  or (new.description   is distinct from old.description)
  or (new.video_url     is distinct from old.video_url)
  or (new.thumbnail_url is distinct from old.thumbnail_url)
  or (new.category_id   is distinct from old.category_id)
  or (new.faixa_minima  is distinct from old.faixa_minima)
  or (new.duration      is distinct from old.duration)
  then
    new.moderacao_status := 'pendente';
    new.is_active        := false;
    new.moderado_em      := null;
    new.moderado_por     := null;
    new.motivo_rejeicao  := null;
  end if;

  return new;
end $$;

-- Nada ficou preso na fila quando a moderação foi desligada.
update public.trainings
   set moderacao_status = 'aprovado', is_active = true
 where moderacao_status = 'pendente'
   and not public.treinamento_exige_aprovacao();

-- ---------------------------------------------------------------- config aceita a chave nova

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

  if p_key not in ('treinamento_faixa_minima_publicar', 'treinamento_exige_aprovacao') then
    raise exception 'chave de configuracao desconhecida: %', p_key;
  end if;

  if p_key = 'treinamento_faixa_minima_publicar' then
    begin
      perform (p_value #>> '{}')::public.faixa;
    exception when others then
      raise exception 'faixa invalida: %', p_value #>> '{}';
    end;
  end if;

  if p_key = 'treinamento_exige_aprovacao' and jsonb_typeof(p_value) <> 'boolean' then
    raise exception 'esta configuracao e true ou false';
  end if;

  insert into public.comunidade_config (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update
    set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  return jsonb_build_object('ok', true, 'key', p_key, 'value', p_value);
end $$;

grant execute on function public.set_comunidade_config(text, jsonb) to authenticated;
