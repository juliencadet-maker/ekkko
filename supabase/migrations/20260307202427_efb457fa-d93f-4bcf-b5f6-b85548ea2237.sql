-- Script version history table
CREATE TABLE public.script_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  version_number integer NOT NULL DEFAULT 1,
  script text NOT NULL,
  change_reason text, -- e.g. "rejection_revision", "initial", "manual_edit"
  rejection_comment text, -- the exec's comment that triggered this revision
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.script_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view script versions in their org"
ON public.script_versions FOR SELECT
TO authenticated
USING (org_id = get_user_org_id(auth.uid()));

CREATE POLICY "Users can insert script versions in their org"
ON public.script_versions FOR INSERT
TO authenticated
WITH CHECK (org_id = get_user_org_id(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_script_versions_campaign ON public.script_versions(campaign_id, version_number DESC);