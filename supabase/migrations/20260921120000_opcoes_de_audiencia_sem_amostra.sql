-- Opções de audiência (tags, origens, responsáveis) vindas do banco inteiro, não de uma amostra.
--
-- O hook useAudienceOptions montava a lista de tags no navegador a partir de
-- `crm_leads.select('source, tags, assigned_to').limit(5000)`. Dois problemas somados:
--   1. o PostgREST corta em 1000 linhas, então o `limit(5000)` nunca foi respeitado;
--   2. são 18.079 leads com e-mail e 3.397 tags distintas — a amostra enxergava 1.206.
-- Resultado: tag de produto com poucos compradores (compra-realizada-3067982, com 2 leads;
-- compra-realizada-3067984, com 20) simplesmente não aparecia no seletor, embora o filtro
-- server-side (`l.tags && ...` em get_email_audience_count) funcionasse perfeitamente com ela.
--
-- Aqui a lista passa a ser calculada no banco, com contagem, sem amostragem.
create or replace function public.opcoes_de_audiencia()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_tags     jsonb;
  v_sources  jsonb;
  v_resp     jsonb;
begin
  if not public.is_admin() then
    raise exception 'apenas admin';
  end if;

  -- Todas as tags do CRM. `com_email` é quantos desses leads são alcançáveis por e-mail —
  -- o seletor é usado tanto pra e-mail quanto pra WhatsApp, então nenhuma tag fica de fora.
  select coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'leads', leads, 'com_email', com_email)
                            order by leads desc, tag), '[]'::jsonb)
    into v_tags
  from (
    select t as tag,
           count(*) as leads,
           count(*) filter (where l.email is not null and l.email <> '') as com_email
      from public.crm_leads l, unnest(l.tags) t
     where nullif(t, '') is not null
     group by t
  ) x;

  select coalesce(jsonb_agg(distinct l.source order by l.source), '[]'::jsonb)
    into v_sources
  from public.crm_leads l
  where nullif(l.source, '') is not null;

  select coalesce(jsonb_agg(distinct l.assigned_to order by l.assigned_to), '[]'::jsonb)
    into v_resp
  from public.crm_leads l
  where nullif(l.assigned_to, '') is not null;

  return jsonb_build_object('tags', v_tags, 'sources', v_sources, 'assigned_to', v_resp);
end $$;

grant execute on function public.opcoes_de_audiencia() to authenticated;
