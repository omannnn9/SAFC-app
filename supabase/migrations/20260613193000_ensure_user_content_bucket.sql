-- Ensure the application storage bucket exists before object policies run.
-- Fixes Supabase Storage "no bucket found" errors for avatars, cover images,
-- post images, direct-message images, and event photos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-content',
  'user-content',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "user-content public read" ON storage.objects;
CREATE POLICY "user-content public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'user-content');

DROP POLICY IF EXISTS "user-content owner insert" ON storage.objects;
CREATE POLICY "user-content owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "user-content owner update" ON storage.objects;
CREATE POLICY "user-content owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "user-content owner delete" ON storage.objects;
CREATE POLICY "user-content owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);
