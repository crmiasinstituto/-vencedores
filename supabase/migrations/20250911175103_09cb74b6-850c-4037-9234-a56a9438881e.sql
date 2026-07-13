-- Create storage bucket for Instagram profile images
INSERT INTO storage.buckets (id, name, public) VALUES ('instagram-profiles', 'instagram-profiles', true);

-- Create policies for Instagram profile images storage
CREATE POLICY "Instagram profile images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'instagram-profiles');

CREATE POLICY "Anyone can upload Instagram profile images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'instagram-profiles');

-- Add columns to leads table for Instagram data
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS instagram_data JSONB,
ADD COLUMN IF NOT EXISTS instagram_profile_pic_url TEXT,
ADD COLUMN IF NOT EXISTS mensagem_personalizada TEXT;