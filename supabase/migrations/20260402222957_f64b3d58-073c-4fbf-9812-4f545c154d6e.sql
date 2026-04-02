
INSERT INTO storage.buckets (id, name, public) VALUES ('deal-videos', 'deal-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload deal videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'deal-videos');

CREATE POLICY "Anyone can view deal videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'deal-videos');
