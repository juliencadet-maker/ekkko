
CREATE POLICY "Org admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM org_memberships m1
    JOIN org_memberships m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid()
      AND m2.user_id = profiles.user_id
      AND m1.is_active = true
      AND m2.is_active = true
      AND m1.role IN ('org_owner', 'org_admin')
  )
);
