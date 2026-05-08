-- Phase 1c-2 R1-R3 schema additions

-- R2: idempotence partial UNIQUE on canonical asset_tracked_links
CREATE UNIQUE INDEX IF NOT EXISTS asset_tracked_links_dedup_idx
  ON public.asset_tracked_links (deal_asset_id, target_url)
  WHERE archived_at IS NULL;

-- R3: stats columns
ALTER TABLE public.asset_tracked_links
  ADD COLUMN IF NOT EXISTS first_clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unique_viewer_count INTEGER NOT NULL DEFAULT 0;

-- R3: link_token on asset_page_events to compute unique_viewer_count
ALTER TABLE public.asset_page_events
  ADD COLUMN IF NOT EXISTS link_token TEXT;

CREATE INDEX IF NOT EXISTS asset_page_events_link_token_idx
  ON public.asset_page_events (link_token)
  WHERE link_token IS NOT NULL;