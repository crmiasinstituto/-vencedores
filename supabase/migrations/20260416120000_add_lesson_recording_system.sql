-- =========================================================
-- LESSON RECORDING SYSTEM
-- Extends meetings/member_lessons for recording classes
-- via meeting room, direct uploads, and scheduled live
-- sessions with members.
-- =========================================================

-- 1) Extend meetings: enable "lesson mode" and scheduled
--    live sessions that publish to the members area
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS livekit_room_name text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_status text,
  ADD COLUMN IF NOT EXISTS kind text DEFAULT 'sales',
  ADD COLUMN IF NOT EXISTS lesson_mode boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS target_module_id uuid,
  ADD COLUMN IF NOT EXISTS target_lesson_title text,
  ADD COLUMN IF NOT EXISTS target_lesson_id uuid,
  ADD COLUMN IF NOT EXISTS members_visible boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS members_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS members_duration_minutes integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS host_name text,
  ADD COLUMN IF NOT EXISTS processing_step text,
  ADD COLUMN IF NOT EXISTS processing_error text;

-- 2) Extend member_lessons for rich content from recordings
ALTER TABLE public.member_lessons
  ADD COLUMN IF NOT EXISTS meeting_id uuid,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_key_points jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_timestamps jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_exercises jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS processing_status text DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS processing_step text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
  -- source: manual, meeting_recording, direct_upload, live_session

-- 3) Lesson jobs table for processing pipeline observability
CREATE TABLE IF NOT EXISTS public.lesson_recording_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id uuid,
  lesson_id uuid,
  module_id uuid,
  title text NOT NULL,
  video_url text,
  video_duration_seconds integer,
  transcription text,
  pdf_url text,
  status text DEFAULT 'pending',
  -- pending, recording, transcribing, analyzing, generating_pdf, publishing, ready, failed
  step text,
  error text,
  source text DEFAULT 'meeting_recording',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.lesson_recording_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on lesson_recording_jobs" ON public.lesson_recording_jobs;
CREATE POLICY "Allow all on lesson_recording_jobs"
  ON public.lesson_recording_jobs FOR ALL USING (true) WITH CHECK (true);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_meetings_livekit_room ON public.meetings(livekit_room_name);
CREATE INDEX IF NOT EXISTS idx_meetings_lesson_mode ON public.meetings(lesson_mode) WHERE lesson_mode = true;
CREATE INDEX IF NOT EXISTS idx_meetings_members_scheduled ON public.meetings(members_scheduled_at) WHERE members_visible = true;
CREATE INDEX IF NOT EXISTS idx_member_lessons_meeting ON public.member_lessons(meeting_id);
CREATE INDEX IF NOT EXISTS idx_lesson_jobs_meeting ON public.lesson_recording_jobs(meeting_id);
CREATE INDEX IF NOT EXISTS idx_lesson_jobs_status ON public.lesson_recording_jobs(status);
