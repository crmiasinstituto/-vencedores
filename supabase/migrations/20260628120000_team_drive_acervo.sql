-- ============================================================
-- Acervo do Time (Drive B2) + Quadro estilo Trello + login proprio
--
-- Tres camadas:
--   1) team_users / team_sessions: contas independentes do time, login
--      por email+senha (pgcrypto bf). NAO usa Supabase Auth nem members.
--   2) Acervo: drive_folders + drive_files (URL publica no Backblaze B2,
--      upload via edge create-b2-upload-url ja existente).
--   3) Quadro: drive_boards / drive_lists / drive_cards / drive_card_files
--      (kanban estilo Trello, cards podem anexar arquivos do acervo).
--
-- RLS espelha o padrao do current_member_id(): a pagina externa do time
-- manda o header x-team-token (role anon), current_team_user_id() resolve
-- na DB. O admin (Supabase Auth) entra pelo mesmo conjunto de tabelas via
-- is_admin(). Mesmo acervo compartilhado pros dois.
-- ============================================================

-- ─── 1) Contas do time ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'member', -- 'member' | 'editor'
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_user_id  uuid NOT NULL REFERENCES public.team_users(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS idx_team_sessions_token ON public.team_sessions(token);

-- ─── 2) Acervo: pastas + arquivos ───────────────────────────
CREATE TABLE IF NOT EXISTS public.drive_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  parent_id   uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  color       text DEFAULT '#FAC800',
  created_by  text,            -- nome de quem criou (time ou admin), denormalizado
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_folders_parent ON public.drive_folders(parent_id);

CREATE TABLE IF NOT EXISTS public.drive_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id    uuid REFERENCES public.drive_folders(id) ON DELETE SET NULL,
  name         text NOT NULL,
  file_url     text NOT NULL,   -- URL publica no B2
  file_key     text,            -- key no bucket (pra referencia/futuro delete no B2)
  file_type    text,            -- pdf | video | image | audio | doc | zip | file
  file_size    bigint,
  mime         text,
  thumbnail_url text,           -- miniatura (foto reduzida / frame do video) no B2
  uploaded_by  text,            -- nome de quem subiu, denormalizado
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_files_folder ON public.drive_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_drive_files_created ON public.drive_files(created_at DESC);

-- ─── 3) Quadro estilo Trello ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.drive_boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drive_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES public.drive_boards(id) ON DELETE CASCADE,
  name        text NOT NULL,
  position    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_lists_board ON public.drive_lists(board_id);

CREATE TABLE IF NOT EXISTS public.drive_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid NOT NULL REFERENCES public.drive_lists(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  position      int NOT NULL DEFAULT 0,
  assignee_name text,
  due_date      date,
  label_color   text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drive_cards_list ON public.drive_cards(list_id);

CREATE TABLE IF NOT EXISTS public.drive_card_files (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id    uuid NOT NULL REFERENCES public.drive_cards(id) ON DELETE CASCADE,
  file_id    uuid NOT NULL REFERENCES public.drive_files(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, file_id)
);

-- ─── 4) current_team_user_id(): le x-team-token do request ───
-- Espelha public.current_member_id(). SECURITY DEFINER pra ler
-- team_sessions sem RLS recursivo.
CREATE OR REPLACE FUNCTION public.current_team_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  headers json;
  v_token text;
  u_id    uuid;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
  IF headers IS NULL THEN RETURN NULL; END IF;
  v_token := headers ->> 'x-team-token';
  IF v_token IS NULL OR length(v_token) < 16 THEN RETURN NULL; END IF;

  SELECT s.team_user_id INTO u_id
    FROM public.team_sessions s
    JOIN public.team_users u ON u.id = s.team_user_id
   WHERE s.token = v_token
     AND s.expires_at > now()
     AND u.is_active = true
   LIMIT 1;

  RETURN u_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.current_team_user_id() TO anon, authenticated;
COMMENT ON FUNCTION public.current_team_user_id() IS
  'Le x-team-token do header da request PostgREST, resolve em team_users.id via team_sessions.';

-- ─── 5) team_login(): valida email+senha, cria sessao ───────
CREATE OR REPLACE FUNCTION public.team_login(p_email text, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  u        public.team_users%ROWTYPE;
  v_token  text;
BEGIN
  IF p_email IS NULL OR p_password IS NULL OR length(p_password) < 4 THEN
    RETURN json_build_object('error', 'Email e senha sao obrigatorios');
  END IF;

  SELECT * INTO u FROM public.team_users
   WHERE email = lower(trim(p_email)) LIMIT 1;

  -- Mensagem generica pra nao enumerar usuarios
  IF NOT FOUND OR u.password_hash IS NULL
     OR u.password_hash <> crypt(p_password, u.password_hash) THEN
    RETURN json_build_object('error', 'Email ou senha incorretos');
  END IF;

  IF NOT u.is_active THEN
    RETURN json_build_object('error', 'Acesso desativado. Fale com o administrador.');
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.team_sessions (team_user_id, token)
  VALUES (u.id, v_token);

  UPDATE public.team_users SET last_login_at = now(), updated_at = now()
   WHERE id = u.id;

  RETURN json_build_object(
    'token', v_token,
    'user', json_build_object('id', u.id, 'name', u.name, 'email', u.email, 'role', u.role)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.team_login(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.team_logout(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.team_sessions WHERE token = p_token;
$$;
GRANT EXECUTE ON FUNCTION public.team_logout(text) TO anon, authenticated;

-- ─── 6) RPCs de gestao (admin) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_team_user(p_name text, p_email text, p_password text, p_role text DEFAULT 'member')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('error', 'Apenas admin');
  END IF;
  IF p_email IS NULL OR length(trim(p_email)) < 4 OR p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object('error', 'Email valido e senha de 6+ caracteres sao obrigatorios');
  END IF;
  INSERT INTO public.team_users (name, email, password_hash, role)
  VALUES (trim(p_name), lower(trim(p_email)), crypt(p_password, gen_salt('bf', 10)), coalesce(p_role, 'member'))
  RETURNING id INTO v_id;
  RETURN json_build_object('id', v_id);
EXCEPTION WHEN unique_violation THEN
  RETURN json_build_object('error', 'Ja existe uma conta com esse email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_team_user(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_team_password(p_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN json_build_object('error', 'Apenas admin'); END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RETURN json_build_object('error', 'Senha de 6+ caracteres');
  END IF;
  UPDATE public.team_users
     SET password_hash = crypt(p_password, gen_salt('bf', 10)), updated_at = now()
   WHERE id = p_id;
  -- invalida sessoes ativas ao trocar senha
  DELETE FROM public.team_sessions WHERE team_user_id = p_id;
  RETURN json_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_set_team_password(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_team_user(p_id uuid, p_active boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RETURN json_build_object('error', 'Apenas admin'); END IF;
  UPDATE public.team_users SET is_active = p_active, updated_at = now() WHERE id = p_id;
  IF NOT p_active THEN
    DELETE FROM public.team_sessions WHERE team_user_id = p_id;
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_team_user(uuid, boolean) TO authenticated;

-- ─── 7) RLS ─────────────────────────────────────────────────
ALTER TABLE public.team_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_folders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_boards    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_lists     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_card_files ENABLE ROW LEVEL SECURITY;

-- team_users: so admin (gestao). Login/leitura propria passa por RPC SECURITY DEFINER.
DROP POLICY IF EXISTS "team_users admin" ON public.team_users;
CREATE POLICY "team_users admin" ON public.team_users
  FOR ALL
  USING (public.is_admin() OR auth.role() = 'service_role')
  WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- team_sessions: ninguem direto (so via RPC definer). Policy fechada por seguranca.
DROP POLICY IF EXISTS "team_sessions admin" ON public.team_sessions;
CREATE POLICY "team_sessions admin" ON public.team_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Acervo + quadro: time logado (x-team-token) OU admin OU service_role.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'drive_folders','drive_files','drive_boards','drive_lists','drive_cards','drive_card_files'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "drive team or admin" ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY "drive team or admin" ON public.%I
        FOR ALL
        USING (public.current_team_user_id() IS NOT NULL OR public.is_admin() OR auth.role() = 'service_role')
        WITH CHECK (public.current_team_user_id() IS NOT NULL OR public.is_admin() OR auth.role() = 'service_role')
    $f$, t);
  END LOOP;
END $$;

-- ─── 8) Grants de tabela (RLS gateia as linhas) ─────────────
GRANT SELECT ON public.team_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.drive_folders, public.drive_files, public.drive_boards,
  public.drive_lists, public.drive_cards, public.drive_card_files
  TO anon, authenticated;
