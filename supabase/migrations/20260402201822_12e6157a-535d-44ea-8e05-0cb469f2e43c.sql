
-- SESSION A2 — Enrichir tables existantes

-- 1. campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS account_id uuid NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_identity_status text DEFAULT 'unknown';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS first_signal_at timestamptz NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_experience_mode text DEFAULT 'push_only';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_owner_id uuid NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS snoozed_until timestamptz NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS crm_stage text NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_risk_level text DEFAULT 'healthy';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_risk_override bool DEFAULT false;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS first_action_completed_at timestamptz NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS first_outcome_detected_at timestamptz NULL;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- CRITIQUE : rendre identity_id nullable
ALTER TABLE public.campaigns ALTER COLUMN identity_id DROP NOT NULL;

-- 2. deal_scores
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS trajectory text DEFAULT 'stable';
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS signal_coverage float DEFAULT 0;
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS layer_coverage jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS priority_deal_score float DEFAULT 0;

-- 3. viewers
ALTER TABLE public.viewers ADD COLUMN IF NOT EXISTS identity_confidence text DEFAULT 'low';
ALTER TABLE public.viewers ADD COLUMN IF NOT EXISTS identity_cluster_id uuid NULL;
ALTER TABLE public.viewers ADD COLUMN IF NOT EXISTS contact_type text DEFAULT 'unknown';
