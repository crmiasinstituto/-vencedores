-- Fecha as 6 tabelas que sobraram do levantamento de 15/07/2026.
-- Estas são mais delicadas que as 48 da migration anterior porque misturam uso anônimo
-- legítimo (/meet/:roomId é rota pública) com uso de host/admin.
--
-- Regra aplicada: o convidado anônimo só precisa de DUAS coisas — achar a sala pelo
-- livekit_room_name e mandar pergunta/nota. Todo o resto (ler perguntas dos outros, ler nota
-- dos outros, ver job de gravação, listar grupos de WhatsApp) é do host, e host é admin.
--
-- ATENÇÃO: o host hoje é definido por ?role=host na URL, e a edge livekit-token concede
-- roomAdmin sem autenticar (ver task de correção). Depois que essa função passar a exigir
-- is_admin(), o host sempre estará autenticado e estas policies fecham certo.

-- ---------------------------------------------------------------------------
-- sales_ranking — ranking do netweaving. Lido pelos membros no portal (Supabase Auth real,
-- portal/src/hooks/useSalesRanking.tsx:73) e por SalesCharts no /admin. Escrita é só admin.
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='sales_ranking' loop
    execute format('drop policy %I on public.sales_ranking', p);
  end loop;
end $$;

alter table public.sales_ranking enable row level security;

create policy "ranking_visivel_pra_logado" on public.sales_ranking
  for select to authenticated using (true);

create policy "ranking_escrita_admin" on public.sales_ranking
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- whatsapp_groups — expõe group_jid e convites dos grupos. Só o painel do host usa
-- (MeetRoom.tsx:2369,2378) e o /admin/grupos. Anon não tem o que fazer aqui.
-- O redirect público /g/:slug NÃO lê esta tabela: passa por resolve_wa_group_redirect(),
-- que é SECURITY DEFINER com grant pro anon (verificado em pg_proc).
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='whatsapp_groups' loop
    execute format('drop policy %I on public.whatsapp_groups', p);
  end loop;
end $$;

alter table public.whatsapp_groups enable row level security;

create policy "admin_full_access" on public.whatsapp_groups
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- lesson_recording_jobs — painel de gravação, host-only (MeetRoom.tsx:2273).
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='lesson_recording_jobs' loop
    execute format('drop policy %I on public.lesson_recording_jobs', p);
  end loop;
end $$;

alter table public.lesson_recording_jobs enable row level security;

create policy "admin_full_access" on public.lesson_recording_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- meetings — o anon PRECISA achar a sala pra entrar (MeetRoom.tsx:1104 roda pra todo mundo),
-- e o membro logado lê em MembrosMeet.tsx:52 (que roda como anon + x-member-token).
-- Então mantemos o SELECT aberto, mas a ESCRITA (started_at/ended_at/transcrição) vira admin.
--
-- DÍVIDA CONHECIDA: o SELECT ainda entrega colunas sensíveis (transcription, ai_summary,
-- support_materials) pra qualquer anon que saiba um livekit_room_name. O certo é uma RPC
-- SECURITY DEFINER resolve_meet_room(room_name) devolvendo só as colunas de entrada, no
-- mesmo padrão de resolve_collective_invite. Isso exige reescrever as queries do MeetRoom
-- e está registrado como task separada.
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='meetings' loop
    execute format('drop policy %I on public.meetings', p);
  end loop;
end $$;

alter table public.meetings enable row level security;

create policy "meet_entrada_publica" on public.meetings
  for select to anon, authenticated using (true);

create policy "meet_escrita_admin" on public.meetings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- meet_questions — convidado anônimo INSERE pergunta (AskQuestionModal.tsx:28).
-- Hoje o anon também consegue LER todas as perguntas de todas as salas; isso fecha.
-- O insert só vale se a sala existir de fato.
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='meet_questions' loop
    execute format('drop policy %I on public.meet_questions', p);
  end loop;
end $$;

alter table public.meet_questions enable row level security;

create policy "pergunta_convidado" on public.meet_questions
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.meetings m
      where m.livekit_room_name = meet_questions.livekit_room_name
    )
  );

create policy "perguntas_host_admin" on public.meet_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- meet_ratings — convidado anônimo dá nota no fim (MeetingRatingModal.tsx:33).
-- Ler nota dos outros é do admin.
-- ---------------------------------------------------------------------------
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='meet_ratings' loop
    execute format('drop policy %I on public.meet_ratings', p);
  end loop;
end $$;

alter table public.meet_ratings enable row level security;

create policy "nota_convidado" on public.meet_ratings
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.meetings m
      where m.livekit_room_name = meet_ratings.livekit_room_name
    )
  );

create policy "notas_admin" on public.meet_ratings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
