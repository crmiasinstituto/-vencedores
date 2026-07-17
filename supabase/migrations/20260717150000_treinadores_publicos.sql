-- Treinadores visíveis na landing (pública).
--
-- A landing é anônima e a tabela treinadores é `to authenticated`. Estes são rostos que a
-- página EXISTE pra mostrar, então uma RPC pública devolve só o que aparece: nome, foto e uma
-- linha de papel. Nada sensível (profile_id, team_member_id ficam de fora).

create or replace function public.treinadores_publicos()
returns table (nome text, foto_url text, papel text, ordem integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    t.nome,
    t.foto_url,
    -- Uma linha curta pro card. Se a bio for grande, corta; se vazia, cai num rótulo neutro.
    coalesce(nullif(left(coalesce(t.bio, ''), 60), ''), 'Treinador do IAS Instituto'),
    t.ordem
  from public.treinadores t
  where t.ativo = true
  order by t.ordem, t.nome;
$function$;

grant execute on function public.treinadores_publicos() to anon, authenticated;

comment on function public.treinadores_publicos() is
  'Treinadores pra vitrine da landing pública: só nome, foto e papel. A tabela treinadores em '
  'si é to authenticated; esta é a exceção estreita pro que a landing mostra.';
