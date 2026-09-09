-- Resposta automática quando o lead aperta um botão do template.
--
-- Caso que motivou: o template utilitário do Reprograme-se 10X tem o botão
-- "Confirmar inscrição". Quando o lead toca, ele abre a janela de 24h — e é aí que dá
-- pra mandar áudio, imagem, o que for, sem precisar de outro template. Esta tabela deixa
-- essa regra configurável no front em vez de chumbada em código.
--
-- Por que áudio só depois do clique: fora da janela de 24h a Meta só aceita template, e
-- template não carrega áudio. O clique é o que destrava.

create table if not exists public.wa_respostas_automaticas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  -- Texto do botão que dispara. Comparado sem acento e sem caixa.
  gatilho      text not null,
  -- null = qualquer número; preenchido = só naquela linha.
  instance_id  uuid references public.whatsapp_instances(id) on delete cascade,
  tipo         text not null default 'audio',   -- audio | text | image | video | document
  media_url    text,
  mensagem     text,
  -- Segundos a esperar antes de responder. Resposta instantânea parece robô.
  delay_segundos int not null default 3,
  is_active    boolean not null default true,
  total_enviados int not null default 0,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint wa_respostas_automaticas_tipo_chk
    check (tipo in ('audio','text','image','video','document'))
);

create index if not exists wa_respostas_automaticas_ativo_idx
  on public.wa_respostas_automaticas (is_active) where is_active;

alter table public.wa_respostas_automaticas enable row level security;

drop policy if exists wa_respostas_automaticas_admin on public.wa_respostas_automaticas;
create policy wa_respostas_automaticas_admin on public.wa_respostas_automaticas
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Log: o que foi respondido pra quem, e a trava contra responder duas vezes o mesmo clique.
create table if not exists public.wa_respostas_automaticas_log (
  id           uuid primary key default gen_random_uuid(),
  regra_id     uuid not null references public.wa_respostas_automaticas(id) on delete cascade,
  remote_phone text not null,
  wamid        text,
  status       text not null default 'enviado',
  erro         text,
  created_at   timestamptz not null default now()
);

-- O webhook da Meta reentrega a mesma mensagem quando não recebe 200 a tempo. Sem esta
-- trava, o lead ouviria o mesmo áudio várias vezes.
create unique index if not exists wa_respostas_log_wamid_uq
  on public.wa_respostas_automaticas_log (regra_id, wamid) where wamid is not null;

alter table public.wa_respostas_automaticas_log enable row level security;
drop policy if exists wa_respostas_log_admin on public.wa_respostas_automaticas_log;
create policy wa_respostas_log_admin on public.wa_respostas_automaticas_log
  for select to authenticated using (public.is_admin());

create or replace function public.wa_respostas_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_wa_respostas_updated_at on public.wa_respostas_automaticas;
create trigger trg_wa_respostas_updated_at
  before update on public.wa_respostas_automaticas
  for each row execute function public.wa_respostas_touch();

-- Normaliza pra comparar: sem acento, sem caixa, sem espaço sobrando. "Confirmar inscrição"
-- e "confirmar inscricao" precisam casar, senão a regra falha por um acento.
create or replace function public.wa_normaliza_texto(p text)
returns text
language sql immutable
set search_path to 'public', 'extensions'
as $$
  select trim(lower(translate(
    coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  )));
$$;

-- Qual regra responde a este clique. O webhook chama isto e não precisa saber a lógica.
create or replace function public.wa_resposta_para_botao(
  p_texto       text,
  p_instance_id uuid
) returns table (
  id uuid, tipo text, media_url text, mensagem text, delay_segundos int
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select r.id, r.tipo, r.media_url, r.mensagem, r.delay_segundos
  from public.wa_respostas_automaticas r
  where r.is_active
    and (r.instance_id is null or r.instance_id = p_instance_id)
    and public.wa_normaliza_texto(p_texto) = public.wa_normaliza_texto(r.gatilho)
  -- Regra específica da linha ganha da regra "qualquer número".
  order by (r.instance_id is not null) desc
  limit 1;
$$;

grant execute on function public.wa_resposta_para_botao(text, uuid) to service_role;
