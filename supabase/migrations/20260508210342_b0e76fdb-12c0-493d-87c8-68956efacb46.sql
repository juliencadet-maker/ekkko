-- ============ deal_assets enrichissement ============
ALTER TABLE public.deal_assets
  ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS block_group TEXT,
  ADD COLUMN IF NOT EXISTS block_title TEXT,
  ADD COLUMN IF NOT EXISTS block_description TEXT;

CREATE INDEX IF NOT EXISTS idx_deal_assets_campaign_order
  ON public.deal_assets (campaign_id, display_order)
  WHERE deleted_at IS NULL;

-- Backfill ordre : intro=0, autres stable par created_at
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY campaign_id
           ORDER BY CASE WHEN asset_purpose='intro' THEN 0 ELSE 1 END, created_at
         ) - 1 AS new_order
  FROM public.deal_assets WHERE deleted_at IS NULL
)
UPDATE public.deal_assets da
SET display_order = ordered.new_order,
    block_group = COALESCE(block_group,
      CASE WHEN da.asset_purpose='intro' THEN 'hero_video' ELSE 'other' END)
FROM ordered WHERE da.id = ordered.id;

-- ============ prospect_room_questions ============
CREATE TABLE public.prospect_room_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  org_id UUID NOT NULL,
  asset_in_focus_id UUID,
  viewer_id UUID,
  prospect_email TEXT,
  prospect_display_name TEXT,
  question TEXT NOT NULL,
  generated_answer TEXT,
  ae_status TEXT NOT NULL DEFAULT 'new',
  ae_notes TEXT,
  ae_video_response_asset_id UUID,
  reviewed_by_user_id UUID,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prq_campaign_status
  ON public.prospect_room_questions (campaign_id, ae_status, captured_at DESC);
CREATE INDEX idx_prq_org_inbox
  ON public.prospect_room_questions (org_id, ae_status, captured_at DESC);

ALTER TABLE public.prospect_room_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read prq"
  ON public.prospect_room_questions
  FOR SELECT TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Org members update prq"
  ON public.prospect_room_questions
  FOR UPDATE TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));
-- INSERT volontairement non couvert : service_role only via edge fn prospect-room-ai

CREATE OR REPLACE FUNCTION public.validate_prq()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(NEW.question) > 1000 THEN
    RAISE EXCEPTION 'PRQ_QUESTION_TOO_LONG';
  END IF;
  IF NEW.ae_status NOT IN ('new','reviewed','actioned','dismissed') THEN
    RAISE EXCEPTION 'PRQ_INVALID_STATUS';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_prq_validate
  BEFORE INSERT OR UPDATE ON public.prospect_room_questions
  FOR EACH ROW EXECUTE FUNCTION public.validate_prq();

-- ============ Trigger V0 → deal_assets (drift fix) ============
CREATE OR REPLACE FUNCTION public.sync_v0_video_to_deal_assets()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
BEGIN
  IF NOT (NEW.is_active = TRUE
          AND NEW.video_status = 'ready'
          AND NEW.video_storage_path IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = NEW.is_active
     AND OLD.video_status = NEW.video_status
     AND OLD.video_storage_path IS NOT DISTINCT FROM NEW.video_storage_path THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
    FROM public.deal_assets
   WHERE campaign_id = NEW.campaign_id
     AND asset_purpose = 'intro'
     AND deleted_at IS NULL
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.deal_assets
       SET file_url = NEW.video_storage_path,
           block_group = COALESCE(block_group, 'hero_video')
     WHERE id = v_existing;
  ELSE
    INSERT INTO public.deal_assets
      (campaign_id, asset_type, asset_purpose, file_url, asset_status,
       version_number, display_order, block_group)
    VALUES
      (NEW.campaign_id, 'video', 'intro', NEW.video_storage_path,
       'active', NEW.version_number, 0, 'hero_video');
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_v0
  AFTER INSERT OR UPDATE ON public.deal_room_version
  FOR EACH ROW EXECUTE FUNCTION public.sync_v0_video_to_deal_assets();

-- ============ orgs.brand_settings (GC-26) ============
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS brand_settings JSONB NOT NULL DEFAULT '{}'::jsonb;