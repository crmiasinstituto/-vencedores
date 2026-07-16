-- CORREÇÃO da 20260715122000_auth_unifica_membros.sql.
--
-- Aquela migration dropou todas as policies de public.members e recriou só "membro lê a si
-- mesmo". Com isso derrubou a regra de CONTRATANTE/PREPOSTO que existia desde
-- 20260518170300_members_rls_part_b_next.sql: um membro contratante enxerga, cria e atualiza
-- os prepostos vinculados a ele (members.contratante_member_id). Sem isso, contratante para
-- de ver os próprios prepostos e o cadastro de preposto quebra com 42501.
--
-- Aqui a semântica original volta inteira. Ela não precisa de nenhuma adaptação pro Supabase
-- Auth: como current_member_id() agora resolve tanto por auth.uid() quanto pelo header
-- x-member-token, as mesmas policies passam a valer nos dois caminhos de login.

do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='members' loop
    execute format('drop policy %I on public.members', p);
  end loop;
end $$;

alter table public.members enable row level security;

-- SELECT: o próprio membro, o contratante (que vê seus prepostos), ou admin.
create policy "Members self or contratante read"
  on public.members
  for select
  using (
    id = public.current_member_id()
    or contratante_member_id = public.current_member_id()
    or public.is_admin()
    or auth.role() = 'service_role'
  );

-- INSERT: contratante cria preposto vinculado a si mesmo. O WITH CHECK exige
-- contratante_member_id = current_member_id(), então um preposto não consegue
-- criar outros prepostos por fora.
create policy "Contratante creates preposto or admin"
  on public.members
  for insert
  with check (
    (contratante_member_id is not null and contratante_member_id = public.current_member_id())
    or public.is_admin()
    or auth.role() = 'service_role'
  );

-- UPDATE: o próprio membro, ou o contratante atualizando um preposto seu.
create policy "Members self or contratante update"
  on public.members
  for update
  using (
    id = public.current_member_id()
    or contratante_member_id = public.current_member_id()
    or public.is_admin()
    or auth.role() = 'service_role'
  )
  with check (
    id = public.current_member_id()
    or contratante_member_id = public.current_member_id()
    or public.is_admin()
    or auth.role() = 'service_role'
  );

-- DELETE: só admin.
create policy "Admin deletes members"
  on public.members
  for delete
  using (public.is_admin() or auth.role() = 'service_role');
