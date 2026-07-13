-- Members/Students table
CREATE TABLE IF NOT EXISTS public.members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  avatar_url text,
  program text DEFAULT 'metodo-squaad',
  status text DEFAULT 'pending', -- pending, active, blocked, expired
  approved_at timestamptz,
  approved_by text,

  -- Session control (single device)
  session_token text,
  session_device text,
  session_started_at timestamptz,
  last_active_at timestamptz,

  -- Gamification
  xp integer DEFAULT 0,
  level text DEFAULT 'iniciante', -- iniciante, explorador, construtor, mestre, lenda
  streak_days integer DEFAULT 0,
  streak_last_date date,
  badges text[] DEFAULT '{}',

  -- Analytics
  total_time_minutes integer DEFAULT 0,
  total_lessons_completed integer DEFAULT 0,
  total_quizzes_completed integer DEFAULT 0,

  -- Metadata
  crm_lead_id uuid,
  enrollment_id uuid,
  welcome_message text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Content Modules (Netflix-style categories)
CREATE TABLE IF NOT EXISTS public.member_modules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  category text DEFAULT 'trilha', -- trilha, bonus, ai-first, masterclass
  sort_order integer DEFAULT 0,
  is_published boolean DEFAULT true,
  is_locked boolean DEFAULT false,
  required_level text, -- minimum level to access
  total_lessons integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Lessons within modules
CREATE TABLE IF NOT EXISTS public.member_lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid REFERENCES public.member_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text DEFAULT 'video', -- video, audio, document, quiz, text
  content_url text, -- video/audio URL
  thumbnail_url text,
  duration_minutes integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  is_published boolean DEFAULT true,

  -- Attachments
  attachments jsonb DEFAULT '[]', -- [{name, url, type, size}]

  -- Quiz data (if type = quiz)
  quiz_data jsonb, -- [{question, options[], correct_index, explanation}]

  created_at timestamptz DEFAULT now()
);

-- Student progress tracking
CREATE TABLE IF NOT EXISTS public.member_progress (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES public.member_lessons(id) ON DELETE CASCADE,
  status text DEFAULT 'not_started', -- not_started, in_progress, completed
  progress_percent integer DEFAULT 0,
  video_position_seconds integer DEFAULT 0, -- resume where left off
  completed_at timestamptz,
  quiz_score integer, -- if lesson is quiz
  time_spent_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(member_id, lesson_id)
);

-- Session logs for analytics
CREATE TABLE IF NOT EXISTS public.member_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  device_info text,
  ip_address text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  duration_minutes integer DEFAULT 0,
  pages_visited text[] DEFAULT '{}'
);

-- AI FIRST files (shared resources)
CREATE TABLE IF NOT EXISTS public.member_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text, -- pdf, doc, xlsx, zip, image, video, audio
  file_size integer,
  category text DEFAULT 'geral', -- geral, template, ferramenta, guia
  uploaded_by text,
  download_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Gamification milestones
CREATE TABLE IF NOT EXISTS public.member_milestones (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES public.members(id) ON DELETE CASCADE,
  milestone_type text NOT NULL, -- first_login, lesson_5, module_complete, quiz_perfect, streak_7, streak_30, level_up
  milestone_name text NOT NULL,
  description text,
  xp_earned integer DEFAULT 0,
  earned_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_modules" ON public.member_modules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_lessons" ON public.member_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_progress" ON public.member_progress FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_sessions" ON public.member_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_files" ON public.member_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on member_milestones" ON public.member_milestones FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_members_email ON public.members(email);
CREATE INDEX idx_members_status ON public.members(status);
CREATE INDEX idx_member_progress_member ON public.member_progress(member_id);
CREATE INDEX idx_member_sessions_member ON public.member_sessions(member_id);
