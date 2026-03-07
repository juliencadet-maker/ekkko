-- Drop the restrictive public update policy and recreate as permissive
DROP POLICY IF EXISTS "Public can decide approval by token" ON public.approval_requests;

CREATE POLICY "Public can decide approval by token"
ON public.approval_requests
FOR UPDATE
TO anon, authenticated
USING ((approval_token IS NOT NULL) AND (status = 'pending'::approval_status))
WITH CHECK ((approval_token IS NOT NULL));