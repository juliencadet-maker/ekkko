
-- Drop the old policy that allows admins to update any approval
DROP POLICY IF EXISTS "Assigned users can update approval requests" ON public.approval_requests;

-- Create a stricter policy: only the assigned user can update (not admins/owners)
CREATE POLICY "Only assigned user can update approval requests"
ON public.approval_requests
FOR UPDATE
TO authenticated
USING (assigned_to_user_id = auth.uid())
WITH CHECK (assigned_to_user_id = auth.uid());
