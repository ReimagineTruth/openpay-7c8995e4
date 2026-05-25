-- Make topup-proof bucket private and enforce owner-only access by path prefix
UPDATE storage.buckets SET public = false WHERE id = 'topup-proof';

DROP POLICY IF EXISTS "Topup proof read" ON storage.objects;
DROP POLICY IF EXISTS "Topup proof insert" ON storage.objects;

CREATE POLICY "Topup proof read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'topup-proof' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Topup proof insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'topup-proof' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Topup proof update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'topup-proof' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Topup proof delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'topup-proof' AND (storage.foldername(name))[1] = auth.uid()::text);