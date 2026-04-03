ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_value numeric DEFAULT NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS committee_size_declared integer DEFAULT NULL;