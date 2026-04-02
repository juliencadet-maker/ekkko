ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS script_oral TEXT,
  ADD COLUMN IF NOT EXISTS script_oral_generated_at TIMESTAMPTZ;