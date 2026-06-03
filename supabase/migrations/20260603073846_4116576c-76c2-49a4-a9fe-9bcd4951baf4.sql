
CREATE POLICY "user-content public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'user-content');

CREATE POLICY "user-content owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user-content owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "user-content owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-content' AND auth.uid()::text = (storage.foldername(name))[1]);
