-- Mural de membros da landing: rostos de quem já faz parte.
--
-- A landing é pública e o RLS de profiles é `to authenticated` (diretorio_visivel_pra_membro),
-- então o anon não lê a tabela — e nem deve: lá tem email, telefone, CPF do onboarding.
--
-- Esta RPC é a exceção estreita: devolve SÓ foto e primeiro nome de quem está aprovado. Mesmo
-- padrão do member_leaderboard() que já existe no CRM.
--
-- Só o PRIMEIRO nome: numa parede pública, "Ludmila" diz o que precisa dizer sem entregar o
-- nome completo de ninguém pra scraper.

create or replace function public.mural_de_membros(p_limit int default 180)
returns table (nome text, foto_url text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    split_part(coalesce(p.nome_completo, p.owner_name, ''), ' ', 1) as nome,
    p.photo_url
  from public.profiles p
  where p.is_approved = true
    and p.photo_url is not null
    and p.photo_url <> ''
    and coalesce(p.nome_completo, p.owner_name, '') <> ''
  order by p.created_at desc
  limit greatest(1, least(p_limit, 500));
$function$;

grant execute on function public.mural_de_membros(int) to anon, authenticated;

comment on function public.mural_de_membros(int) is
  'Rostos pro mural da landing pública. Devolve só primeiro nome + foto de quem está aprovado '
  'e tem foto. Não expõe email, telefone nem sobrenome. Exige photo_url: uma parede com '
  'avatar quebrado é pior que uma parede menor.';

-- Quantos membros aprovados existem, pro contador. Separado do mural porque o mural exige
-- foto e o contador não: a pessoa conta mesmo sem ter subido retrato.
create or replace function public.total_de_membros()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int from public.profiles where is_approved = true;
$function$;

grant execute on function public.total_de_membros() to anon, authenticated;
