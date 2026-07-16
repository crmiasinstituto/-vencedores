-- Troca o modelo de PLANO por FAIXA, e tira categoria e treinador do código pro banco.
--
-- ── POR QUE FAIXA E NÃO PLANO ────────────────────────────────────────────────
-- bronze/prata/ouro/semente é modelo de assinatura: você compra um tier e fica nele.
-- O ecossistema do IAS não funciona assim — é PROGRESSÃO, e cada etapa SOBREPÕE a anterior,
-- então a pessoa está sempre numa faixa só:
--
--   branco    inscrito; foi a evento simples ou beneficente e não avançou
--   vermelho  fez o Reprograme-se, mas não foi pra FPO nem FPI
--   verde     fez FPO (Formação Palestrantes e Oradores) e FPI (Formação Practitioner),
--             mas não adquiriu a Master
--   roxo      adquiriu a Master, mas não foi pro Trainer
--   marrom    fez a formação Trainer
--   preta     acima do Trainer — quem forma treinador
--
-- A ordem do enum É a progressão: comparação de faixa mínima usa a ordem natural do enum
-- (faixa >= 'verde'), então nunca precisa de tabela de/para nem CASE espalhado no código.
--
-- ── O QUE MUDA EM CADA TABELA ────────────────────────────────────────────────
-- profiles.plan            -> profiles.faixa          (uma faixa por pessoa)
-- events.required_plan     -> events.faixas_permitidas  ARRAY — evento aceita VÁRIAS faixas
-- trainings.required_plan  -> trainings.faixa_minima
-- referrals.referred_plan  -> referrals.referred_faixa
--
-- ── CATEGORIA VIRA TABELA ────────────────────────────────────────────────────
-- training_category era enum. Enum só muda por migration, e o Carlos quer cadastrar categoria
-- pelo frontend. Virou tabela.

-- ---------------------------------------------------------------------------
-- 1. A faixa
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.faixa as enum ('branco', 'vermelho', 'verde', 'roxo', 'marrom', 'preta');
exception when duplicate_object then null;
end $$;

comment on type public.faixa is
  'Progressão do membro no ecossistema. A ordem do enum é a progressão: cada faixa sobrepõe a '
  'anterior, então a pessoa está sempre em uma só. branco=inscrito sem avanço; vermelho=fez '
  'Reprograme-se; verde=fez FPO+FPI; roxo=fez Master; marrom=fez Trainer; preta=forma treinador.';

-- ---------------------------------------------------------------------------
-- 1b. As policies que liam profiles.plan saem agora e voltam no passo 10, já em faixa.
--     Elas escopavam o catálogo por tier ("required_plan = 'prata' e o cara é prata ou ouro").
--     Não dá pra dropar a coluna com elas de pé.
-- ---------------------------------------------------------------------------
drop policy if exists "View events by plan"    on public.events;
drop policy if exists "View trainings by plan" on public.trainings;

-- ---------------------------------------------------------------------------
-- 2. profiles.plan -> profiles.faixa
--    Todo mundo entra em branco: as tabelas estão vazias e ninguém tem histórico de formação
--    registrado aqui ainda. Quem já fez alguma formação será promovido pelo admin.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists faixa public.faixa not null default 'branco';
alter table public.profiles drop column if exists plan;

-- A profissão da pessoa. O onboarding passa a perguntar isso — o ecossistema é sobre gente,
-- não sobre empresa.
alter table public.profiles add column if not exists profissao text;
alter table public.profiles add column if not exists nome_completo text;
alter table public.profiles add column if not exists telefone text;

create index if not exists profiles_faixa_idx on public.profiles(faixa);

-- ---------------------------------------------------------------------------
-- 3. events: múltiplas faixas + treinador que ministra
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists faixas_permitidas public.faixa[] not null default
    array['branco','vermelho','verde','roxo','marrom','preta']::public.faixa[];

comment on column public.events.faixas_permitidas is
  'Quais faixas podem entrar. Array porque um evento pode ser aberto a mais de uma faixa sem '
  'ser aberto a todas — ex.: só verde e roxo. Vazio = ninguém; o default é todo mundo.';

alter table public.events drop column if exists required_plan;
-- is_vip existia pra dizer "somente Ouro". Com faixa isso vira faixas_permitidas.
alter table public.events drop column if exists is_vip;

-- ---------------------------------------------------------------------------
-- 4. treinadores
--    Fonte única de quem ministra. Pode ser um membro que chegou na marrom/preta
--    (profile_id), alguém da equipe interna (team_member_id), ou avulso (os dois null) —
--    Isaac e os treinadores do Instituto entram assim enquanto não tiverem conta.
-- ---------------------------------------------------------------------------
create table if not exists public.treinadores (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  foto_url       text,
  bio            text,
  profile_id     uuid references public.profiles(id) on delete set null,
  team_member_id uuid references public.team_members(id) on delete set null,
  ativo          boolean not null default true,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now()
);

comment on table public.treinadores is
  'Quem ministra evento/treinamento. Um treinador pode vir de profiles (membro que chegou na '
  'faixa marrom ou preta), de team_members (equipe interna) ou ser avulso. A landing lê daqui.';

create index if not exists treinadores_ativo_idx on public.treinadores(ativo, ordem);

alter table public.events add column if not exists treinador_id uuid
  references public.treinadores(id) on delete set null;

-- Os treinadores do IAS Instituto. Sem foto: são pessoas reais e ainda não temos os arquivos —
-- não preencher com banco de imagem.
insert into public.treinadores (nome, ordem) values
  ('Isaac Santos', 0),
  ('Ludmila Badaró', 1),
  ('Soraya Storino', 2),
  ('Alexandre Solto Maior', 3),
  ('Claudia Uchoa', 4)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. categorias de treinamento: enum -> tabela
-- ---------------------------------------------------------------------------
create table if not exists public.training_categories (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  slug       text not null unique,
  grupo      text,
  ordem      integer not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.training_categories is
  'Categorias de treinamento. Era enum (training_category); virou tabela porque o admin '
  'cadastra categoria nova pela tela, e enum só muda por migration.';

insert into public.training_categories (nome, slug, grupo, ordem) values
  -- As 7 áreas que a landing promete. Vêm primeiro de propósito: é o que o ecossistema diz que
  -- entrega, então é assim que o catálogo deve se organizar.
  ('Espiritualidade',          'espiritualidade',   'Áreas da vida', 1),
  ('Comunicação',              'comunicacao',       'Áreas da vida', 2),
  ('Inteligência Emocional',   'inteligencia-emocional', 'Áreas da vida', 3),
  ('Relacionamentos',          'relacionamentos',   'Áreas da vida', 4),
  ('Vida Financeira',          'vida-financeira',   'Áreas da vida', 5),
  ('Produtividade',            'produtividade',     'Áreas da vida', 6),
  ('Desenvolvimento Pessoal',  'desenvolvimento-pessoal', 'Áreas da vida', 7),
  -- As formações, que são o produto.
  ('Reprograme-se 10X',        'reprograme-se-10x', 'Formações', 10),
  ('FPO — Formação Palestrantes e Oradores', 'fpo', 'Formações', 11),
  ('FPI — Formação Practitioner', 'fpi',           'Formações', 12),
  ('Master',                   'master',           'Formações', 13),
  ('Trainer',                  'trainer',          'Formações', 14),
  -- As 6 que já existiam. Mantidas pra não órfãnar treinamento já cadastrado nelas.
  ('Vendas',                   'vendas',           'Negócios', 20),
  ('Marketing',                'marketing',        'Negócios', 21),
  ('Financeiro',               'financeiro',       'Negócios', 22),
  ('Liderança',                'lideranca',        'Negócios', 23),
  ('Networking',               'networking',       'Negócios', 24),
  ('IA & Tecnologia',          'ia-tecnologia',    'Negócios', 25)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 6. trainings: faixa mínima + categoria por FK
-- ---------------------------------------------------------------------------
alter table public.trainings add column if not exists faixa_minima public.faixa not null default 'branco';
alter table public.trainings add column if not exists category_id uuid
  references public.training_categories(id) on delete set null;

-- Preserva a categoria de quem já estava cadastrado, casando o enum antigo com o slug novo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema='public' and table_name='trainings' and column_name='category'
  ) then
    update public.trainings t
       set category_id = c.id
      from public.training_categories c
     where t.category_id is null
       and c.slug = replace(t.category::text, '_', '-');
  end if;
end $$;

alter table public.trainings drop column if exists required_plan;
alter table public.trainings drop column if exists category;

-- ---------------------------------------------------------------------------
-- 7. referrals
-- ---------------------------------------------------------------------------
alter table public.referrals add column if not exists referred_faixa public.faixa;
alter table public.referrals drop column if exists referred_plan;

-- ---------------------------------------------------------------------------
-- 8. membership_plan sai de cena
-- ---------------------------------------------------------------------------
drop type if exists public.membership_plan;
drop type if exists public.training_category;

-- ---------------------------------------------------------------------------
-- 9. RLS das tabelas novas
--    Mesmo padrão do resto: catálogo é lido por quem está logado, escrita é do admin.
--    Ver 20260715120000_rls_fecha_tabelas_admin.sql.
-- ---------------------------------------------------------------------------
alter table public.treinadores enable row level security;
alter table public.training_categories enable row level security;

create policy "treinadores_leitura_logado" on public.treinadores
  for select to authenticated using (ativo = true);
create policy "treinadores_admin" on public.treinadores
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "categorias_leitura_logado" on public.training_categories
  for select to authenticated using (ativo = true);
create policy "categorias_admin" on public.training_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 10. O catálogo volta a ser escopado — agora por faixa
-- ---------------------------------------------------------------------------

-- A faixa de quem está logado. SECURITY DEFINER porque o RLS de profiles não deixaria a
-- policy de events ler a linha do próprio usuário sem recursão.
create or replace function public.current_faixa()
returns public.faixa
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select p.faixa from public.profiles p where p.user_id = auth.uid() limit 1;
$function$;

comment on function public.current_faixa() is
  'Faixa do usuário logado, pra escopar catálogo no RLS. Null se não tiver profile.';

-- Evento: a minha faixa precisa estar na lista de permitidas.
create policy "eventos_por_faixa" on public.events
  for select to authenticated
  using (
    is_active = true
    and (
      public.is_admin()
      or public.current_faixa() = any (faixas_permitidas)
    )
  );

-- Treinamento: minha faixa tem que alcançar a mínima. A comparação usa a ORDEM do enum
-- faixa (branco < vermelho < verde < roxo < marrom < preta), que é a própria progressão —
-- por isso não existe tabela de/para nem CASE em lugar nenhum.
create policy "treinamentos_por_faixa" on public.trainings
  for select to authenticated
  using (
    is_active = true
    and (
      public.is_admin()
      or public.current_faixa() >= faixa_minima
    )
  );
