-- Carrossel Viral: template_id + bucket de imagens IA

ALTER TABLE public.viral_carousels
  ADD COLUMN IF NOT EXISTS template_id text DEFAULT 'noir';

-- Storage bucket pra imagens IA dos slides (publico, leitura aberta)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('carousel-images', 'carousel-images', true, 5242880)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880;

-- Policies do bucket
DO $$
BEGIN
  -- read public
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'carousel_images_public_read'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY carousel_images_public_read
        ON storage.objects
        FOR SELECT
        USING (bucket_id = 'carousel-images')
    $sql$;
  END IF;

  -- write open (mesmo padrao das outras tabelas de marketing)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'carousel_images_write_all'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY carousel_images_write_all
        ON storage.objects
        FOR ALL
        USING (bucket_id = 'carousel-images')
        WITH CHECK (bucket_id = 'carousel-images')
    $sql$;
  END IF;
END $$;
