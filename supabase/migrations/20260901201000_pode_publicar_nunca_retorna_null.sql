-- current_faixa() e NULL para quem nao tem profile, e "false or NULL" e NULL, nao false.
-- Funcionava porque o front faz Boolean(...), mas uma permissao nao deve responder "talvez".
create or replace function public.pode_publicar_treinamento()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $$
  select coalesce(
    public.is_admin()
      or coalesce(public.current_faixa() >= public.faixa_minima_publicar_treinamento(), false),
    false
  );
$$;
