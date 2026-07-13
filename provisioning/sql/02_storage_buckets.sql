-- ============================================================
-- 02_storage_buckets.sql
-- Recria os 11 buckets de arquivos + as 16 policies de storage.objects.
-- Buckets e policies NAO vem na fotografia do schema public, por isso o arquivo separado.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- ---- Buckets -------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('carousel-images',       'carousel-images',       true, 5242880,   null),
  ('chat-media',            'chat-media',            true, null,      null),
  ('email-assets',          'email-assets',          true, null,      null),
  ('instagram-media',       'instagram-media',       true, null,      null),
  ('instagram-profiles',    'instagram-profiles',    true, null,      null),
  ('masterclass-assets',    'masterclass-assets',    true, 104857600, array['video/mp4','image/jpeg','image/png','audio/mpeg','image/webp']),
  ('masterclass-onboarding','masterclass-onboarding',true, 5242880,   array['image/jpeg','image/png','image/webp']),
  ('member-files',          'member-files',          true, 104857600, null),
  ('module-thumbnails',     'module-thumbnails',     true, 10485760,  array['image/png','image/jpeg','image/webp']),
  ('user-uploads',          'user-uploads',          true, null,      null),
  ('whatsapp-instances',    'whatsapp-instances',    true, 5242880,   array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---- Policies em storage.objects ----------------------------------------
-- (instagram-media, member-files, module-thumbnails, user-uploads nao tem policy
--  publica no original: acesso via service_role/edge. Mantido igual.)

drop policy if exists "Anyone can upload Instagram profile images" on storage.objects;
create policy "Anyone can upload Instagram profile images" on storage.objects
  for insert to public with check (bucket_id = 'instagram-profiles');

drop policy if exists "Instagram profile images are publicly accessible" on storage.objects;
create policy "Instagram profile images are publicly accessible" on storage.objects
  for select to public using (bucket_id = 'instagram-profiles');

drop policy if exists "Public read access for chat-media" on storage.objects;
create policy "Public read access for chat-media" on storage.objects
  for select to public using (bucket_id = 'chat-media');

drop policy if exists "Public upload access for chat-media" on storage.objects;
create policy "Public upload access for chat-media" on storage.objects
  for insert to public with check (bucket_id = 'chat-media');

drop policy if exists "carousel_images_public_read" on storage.objects;
create policy "carousel_images_public_read" on storage.objects
  for select to public using (bucket_id = 'carousel-images');

drop policy if exists "carousel_images_write_all" on storage.objects;
create policy "carousel_images_write_all" on storage.objects
  for all to public using (bucket_id = 'carousel-images') with check (bucket_id = 'carousel-images');

drop policy if exists "email_assets_authenticated_delete" on storage.objects;
create policy "email_assets_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'email-assets');

drop policy if exists "email_assets_authenticated_update" on storage.objects;
create policy "email_assets_authenticated_update" on storage.objects
  for update to authenticated using (bucket_id = 'email-assets');

drop policy if exists "email_assets_authenticated_write" on storage.objects;
create policy "email_assets_authenticated_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'email-assets');

drop policy if exists "email_assets_public_read" on storage.objects;
create policy "email_assets_public_read" on storage.objects
  for select to public using (bucket_id = 'email-assets');

drop policy if exists "mc_assets_public_read" on storage.objects;
create policy "mc_assets_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'masterclass-assets');

drop policy if exists "selfie_all_roles_all" on storage.objects;
create policy "selfie_all_roles_all" on storage.objects
  for all to anon, authenticated using (bucket_id = 'masterclass-onboarding') with check (bucket_id = 'masterclass-onboarding');

drop policy if exists "whatsapp_instances_delete" on storage.objects;
create policy "whatsapp_instances_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'whatsapp-instances');

drop policy if exists "whatsapp_instances_read" on storage.objects;
create policy "whatsapp_instances_read" on storage.objects
  for select to public using (bucket_id = 'whatsapp-instances');

drop policy if exists "whatsapp_instances_update" on storage.objects;
create policy "whatsapp_instances_update" on storage.objects
  for update to authenticated using (bucket_id = 'whatsapp-instances');

drop policy if exists "whatsapp_instances_upload" on storage.objects;
create policy "whatsapp_instances_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'whatsapp-instances');
