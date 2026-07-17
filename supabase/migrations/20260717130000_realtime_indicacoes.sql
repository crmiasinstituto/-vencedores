-- Realtime na tabela referrals, pro padrinho ser avisado na hora que a indicação é aprovada.
--
-- Pedido do Carlos: "notificar quem indicou em tempo real que a indicação deu certo, para
-- manter todos cientes da evolução".
--
-- Realtime respeita RLS: o Supabase só entrega a linha pra quem passa na policy SELECT. A
-- policy "View own referrals" já deixa o referrer ver os próprios referrals, então o padrinho
-- (e só ele) recebe o evento. Ninguém vê indicação dos outros.
--
-- REPLICA IDENTITY FULL: sem isso, o payload de UPDATE traz só a PK no `old`. Precisamos do
-- valor ANTIGO de `status` pra saber que a transição foi pending→approved (e não qualquer
-- update). Full manda a linha antiga inteira.

alter table public.referrals replica identity full;

-- Entra na publicação do Realtime. O guard evita erro se já estiver.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'referrals'
  ) then
    alter publication supabase_realtime add table public.referrals;
  end if;
end $$;
