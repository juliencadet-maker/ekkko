
-- Fix storage policies: paths are like "identities/{org_id}/..." so org_id is at position 2
DROP POLICY IF EXISTS "Users can upload identity assets to their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can view identity assets in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can view generated videos in their org" ON storage.objects;

CREATE POLICY "Users can upload identity assets to their org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[2] = get_user_org_id(auth.uid())::text
);

CREATE POLICY "Users can view identity assets in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[2] = get_user_org_id(auth.uid())::text
);

CREATE POLICY "Users can view generated videos in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'generated_videos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);
