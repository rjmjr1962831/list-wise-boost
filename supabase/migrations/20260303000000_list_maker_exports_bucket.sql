-- Create storage bucket for List Maker CSV exports (staging-only use)
INSERT INTO storage.buckets (id, name, public)
VALUES ('list-maker-exports', 'list-maker-exports', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for download links (bucket is public; objects inherit)
CREATE POLICY "List Maker: public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'list-maker-exports');
