ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_inbox_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.profiles.last_inbox_seen_at IS
  'Phase 1d.5e (D78-C): last time the AE opened the global Inbox. Used to compute new-since-last-visit signal counts.';

CREATE INDEX IF NOT EXISTS idx_profiles_last_inbox_seen_at
  ON public.profiles (user_id, last_inbox_seen_at);