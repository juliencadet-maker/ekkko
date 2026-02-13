-- Add approval_token for secure public access to approval review
ALTER TABLE public.approval_requests 
ADD COLUMN approval_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Add notification preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN notification_channels text[] DEFAULT ARRAY['email']::text[];

-- Add index for fast token lookup
CREATE INDEX idx_approval_requests_token ON public.approval_requests (approval_token);

-- Allow public (anonymous) read of approval_requests by token for the review page
CREATE POLICY "Public can view approval by token"
ON public.approval_requests
FOR SELECT
USING (approval_token IS NOT NULL);

-- Allow public update of approval_requests by token (for approve/reject actions)
CREATE POLICY "Public can decide approval by token"
ON public.approval_requests
FOR UPDATE
USING (approval_token IS NOT NULL AND status = 'pending');
