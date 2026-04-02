ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS is_demo_org BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Set ff_deal_first_ui = true for all existing orgs
UPDATE public.orgs SET settings = COALESCE(settings, '{}'::jsonb) || '{"ff_deal_first_ui": true}'::jsonb;