
-- Add parent_campaign_id for hierarchical campaigns
ALTER TABLE public.campaigns 
ADD COLUMN parent_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE;

-- Index for fast lookups
CREATE INDEX idx_campaigns_parent_id ON public.campaigns(parent_campaign_id) WHERE parent_campaign_id IS NOT NULL;
