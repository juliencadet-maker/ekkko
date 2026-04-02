
-- 1. Rendre le bucket privé
UPDATE storage.buckets SET public = false WHERE id = 'deal-videos';

-- 2. Supprimer les anciennes policies permissives
DROP POLICY IF EXISTS "Anyone can view deal videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload deal videos" ON storage.objects;

-- 3. SELECT : créateur du deal OU manager/admin/owner de l'org
CREATE POLICY "Deal video read access"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deal-videos'
  AND (
    -- Le créateur du deal peut lire ses propres vidéos
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.created_by_user_id = auth.uid()
    )
    OR
    -- Les managers/admins/owners de l'org peuvent lire
    EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.org_memberships m ON m.org_id = c.org_id
      WHERE c.id::text = (storage.foldername(name))[2]
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('org_manager', 'org_admin', 'org_owner')
    )
  )
);

-- 4. INSERT : membres authentifiés de l'org (vérification via org_id dans le path)
CREATE POLICY "Deal video upload access"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'deal-videos'
  AND EXISTS (
    SELECT 1 FROM public.org_memberships m
    WHERE m.user_id = auth.uid()
      AND m.org_id::text = (storage.foldername(name))[1]
      AND m.is_active = true
  )
);
