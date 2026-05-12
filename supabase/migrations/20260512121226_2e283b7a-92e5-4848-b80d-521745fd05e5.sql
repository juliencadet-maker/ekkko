ALTER TABLE public.early_access_leads
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS effectif text;