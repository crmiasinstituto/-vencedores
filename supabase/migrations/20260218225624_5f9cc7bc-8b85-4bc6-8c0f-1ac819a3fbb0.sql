
-- Create chat-media storage bucket for file uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read files from chat-media bucket
CREATE POLICY "Public read access for chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');

-- Allow anyone to upload files to chat-media bucket
CREATE POLICY "Public upload access for chat-media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-media');
