-- ============================================
-- Captura de Páginas (integração com landing pages externas, estilo SellFlux)
--
-- Cada integração diz pra onde vai o lead que preenche o formulário de uma página:
-- quadro, coluna e tags. A página manda o formulário pra Netlify function captura-pagina
-- (?f=<slug>&chave=<public_key>), que cria/atualiza o card e registra o envio.
--
-- As tags entram num UPDATE separado do INSERT, de propósito: é o UPDATE que dispara
-- lead_tag_added em dispatch_email_automation_event, então uma automação de e-mail com
-- gatilho "Tag adicionada" roda tanto pra lead novo quanto pra quem já estava no quadro.
-- ============================================

create table if not exists public.page_integrations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  public_key text not null default replace(gen_random_uuid()::text, '-', ''),
  board_id uuid not null references public.crm_boards(id) on delete cascade,
  column_id uuid references public.crm_columns(id) on delete set null,
  tags text[] not null default '{}',
  redirect_url text,
  success_message text,
  is_active boolean not null default true,
  total_received integer not null default 0,
  last_received_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_integration_submissions (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.page_integrations(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  status text not null check (status in ('novo', 'atualizado', 'teste', 'erro')),
  payload jsonb not null default '{}',
  error text,
  origin text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_integration_submissions_integration
  on public.page_integration_submissions (integration_id, created_at desc);

alter table public.page_integrations enable row level security;
alter table public.page_integration_submissions enable row level security;

drop policy if exists page_integrations_admin on public.page_integrations;
create policy page_integrations_admin on public.page_integrations
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists page_integration_submissions_admin on public.page_integration_submissions;
create policy page_integration_submissions_admin on public.page_integration_submissions
  for all using (public.is_admin()) with check (public.is_admin());

drop trigger if exists update_page_integrations_updated_at on public.page_integrations;
create trigger update_page_integrations_updated_at
  before update on public.page_integrations
  for each row execute function public.update_updated_at_column();

-- Contador de envios (chamado pela captura-pagina com a service_role)
create or replace function public.page_integration_bump(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.page_integrations
     set total_received = total_received + 1,
         last_received_at = now()
   where id = p_id;
$$;

revoke all on function public.page_integration_bump(uuid) from public, anon, authenticated;
grant execute on function public.page_integration_bump(uuid) to service_role;

-- Operação 50K vira a primeira integração. A página já publicada usa o slug como ?quadro=
-- e o LEAD_CAPTURE_TOKEN global, e a captura-pagina aceita esse formato antigo.
insert into public.page_integrations (name, slug, board_id, column_id, tags, redirect_url)
select 'Operação 50K', 'operacao-50k', b.id, c.id, array['Operação 50K'], 'https://iasinstitute.com.br/parabens-50k'
  from public.crm_boards b
  join lateral (
    select id from public.crm_columns where board_id = b.id order by sort_order asc limit 1
  ) c on true
 where b.slug = 'operacao-50k'
on conflict (slug) do nothing;
