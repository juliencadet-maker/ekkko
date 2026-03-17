
-- Add clone_status to identities table
ALTER TABLE public.identities ADD COLUMN clone_status text DEFAULT 'pending' CHECK (clone_status IN ('pending', 'ready', 'error'));

-- Update existing 'ready' identities to have clone_status = 'ready'
UPDATE public.identities SET clone_status = 'ready' WHERE status = 'ready';

-- Update existing provider type from 'mock' to 'heygen' for all orgs
UPDATE public.providers SET provider_type = 'heygen', name = 'HeyGen' WHERE provider_type = 'mock';
