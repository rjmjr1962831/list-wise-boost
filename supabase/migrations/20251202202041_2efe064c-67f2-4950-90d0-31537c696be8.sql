-- Allow anyone to upload photos to the professional-photos bucket
-- This is safe because the bucket is already public and we're using unique file names
CREATE POLICY "Anyone can upload professional photos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'professional-photos');