-- Marca quem já comprou o Reprograme-se 10X 32ª edição.
--
-- O problema real: o time abre a conversa no WhatsApp para falar de outra coisa e acaba
-- oferecendo o ingresso para quem já pagou. A tag existe para isso aparecer antes de
-- qualquer abordagem.
--
-- Três tags, cada uma respondendo uma pergunta:
--   ja-comprou            → "não ofereça" (serve para qualquer produto, é o alerta)
--   rpg10x-32-edicao      → de qual edição estamos falando
--   rpg10x-32-online/ssa  → presencial em Salvador ou online

create or replace function public.tags_da_venda_rpg10x(p_produto text)
returns text[]
language sql
immutable
as $$
  select case
    when p_produto is null then '{}'::text[]
    when p_produto !~* 'rpg10x|reprograme' then '{}'::text[]
    when p_produto ~* 'online' then array['ja-comprou','rpg10x-32-edicao','rpg10x-32-online']
    else array['ja-comprou','rpg10x-32-edicao','rpg10x-32-ssa']
  end;
$$;

-- Aplica as tags no lead sem apagar as que ele já tem e sem duplicar.
create or replace function public.aplicar_tags_venda_rpg10x()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_tags text[];
begin
  if new.crm_lead_id is null then return new; end if;

  v_tags := public.tags_da_venda_rpg10x(new.product_name);
  if array_length(v_tags, 1) is null then return new; end if;

  update public.crm_leads l
     set tags = (
           select array_agg(distinct t)
           from unnest(coalesce(l.tags, '{}'::text[]) || v_tags) t
         ),
         updated_at = now()
   where l.id = new.crm_lead_id
     -- só escreve se falta alguma; evita update inútil e ruído no updated_at
     and not (coalesce(l.tags, '{}'::text[]) @> v_tags);

  return new;
end $$;

drop trigger if exists trg_tags_venda_rpg10x on public.sales_events;
create trigger trg_tags_venda_rpg10x
  after insert on public.sales_events
  for each row execute function public.aplicar_tags_venda_rpg10x();

-- ── Backfill: as compras que já entraram, de 03/08 em diante ────────────────────
-- 03/08 é a virada para a 32ª edição (a primeira venda do lote novo).
with alvo as (
  select s.crm_lead_id, public.tags_da_venda_rpg10x(s.product_name) as tags
  from public.sales_events s
  where s.created_at >= '2026-08-03'
    and s.crm_lead_id is not null
    and array_length(public.tags_da_venda_rpg10x(s.product_name), 1) is not null
),
consolidado as (
  select crm_lead_id, array_agg(distinct t) as tags
  from alvo, unnest(tags) t
  group by crm_lead_id
)
update public.crm_leads l
   set tags = (
         select array_agg(distinct x)
         from unnest(coalesce(l.tags, '{}'::text[]) || c.tags) x
       ),
       updated_at = now()
  from consolidado c
 where l.id = c.crm_lead_id
   and not (coalesce(l.tags, '{}'::text[]) @> c.tags);
