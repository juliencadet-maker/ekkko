
-- Fix 1: Replace overly broad public SELECT policy on videos
-- Drop the existing too-permissive policy
DROP POLICY IF EXISTS "Public can view videos by share token" ON public.videos;

-- Create a properly scoped policy: public can only access via share_token match
-- This requires the caller to know the exact share_token
CREATE POLICY "Public can view video by share token"
ON public.videos FOR SELECT
USING (is_active = true AND share_token = current_setting('request.headers', true)::json->>'x-share-token');

-- Actually, RLS can't easily use custom headers. Better approach:
-- Allow public select only when filtering by share_token (the token acts as the auth)
DROP POLICY IF EXISTS "Public can view video by share token" ON public.videos;

-- Public users must provide the share_token in their query filter
-- Without knowing the token, they can't enumerate videos
CREATE POLICY "Public can view video by exact share token"
ON public.videos FOR SELECT TO anon
USING (is_active = true);

-- Wait, anon role won't work with supabase client defaults. Let me reconsider.
-- The landing page uses the anon key but still hits the authenticated role.
-- The real fix: remove the broad policy entirely and create an edge function for public access.
-- For now, keep the org-member policy (already exists) and remove the public one.

DROP POLICY IF EXISTS "Public can view video by exact share token" ON public.videos;

-- Fix 2: Tighten storage policies
-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Users can upload their own identity assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can view identity assets in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can view generated videos in their org" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload generated videos" ON storage.objects;

-- Recreate with org-scoped path validation for identity_assets
CREATE POLICY "Users can upload identity assets to their org"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);

CREATE POLICY "Users can view identity assets in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity_assets'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);

-- Org-scoped policies for generated_videos
CREATE POLICY "Users can view generated videos in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'generated_videos'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = get_user_org_id(auth.uid())::text
);
