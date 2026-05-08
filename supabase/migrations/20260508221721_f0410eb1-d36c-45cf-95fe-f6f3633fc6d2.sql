CREATE TABLE IF NOT EXISTS public.prospect_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  org_id uuid NOT NULL,
  asset_id uuid NULL,
  block_group text NULL,
  reaction text NOT NULL CHECK (reaction IN ('up','think','spark')),
  viewer_hash text NULL,
  prospect_email text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_reactions_campaign ON public.prospect_reactions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_reactions_asset ON public.prospect_reactions(asset_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_prospect_reactions_dedupe ON public.prospect_reactions(
  campaign_id,
  COALESCE(asset_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(block_group, ''),
  COALESCE(viewer_hash, prospect_email, 'anon'),
  reaction
);

ALTER TABLE public.prospect_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert reactions" ON public.prospect_reactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Org members read reactions" ON public.prospect_reactions
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Public can delete own reaction by viewer" ON public.prospect_reactions
  FOR DELETE TO anon, authenticated
  USING (viewer_hash IS NOT NULL OR prospect_email IS NOT NULL);
