-- R0 — Backfill deal_assets depuis videos legacy + uniformisation asset_status

-- 1. Backfill : 1 deal_asset par video active sans row existante pour le même campaign
INSERT INTO public.deal_assets (campaign_id, asset_type, asset_purpose, file_url, asset_status, version_number, created_at)
SELECT v.campaign_id, 'video', 'intro', v.storage_path, 'active', 1, v.created_at
FROM public.videos v
WHERE v.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.deal_assets da
    WHERE da.campaign_id = v.campaign_id AND da.deleted_at IS NULL
  );

-- 2. Uniformisation : tout asset_status legacy 'valid' → 'active'
UPDATE public.deal_assets SET asset_status = 'active' WHERE asset_status = 'valid';

-- 3. Default à 'active' (futur)
ALTER TABLE public.deal_assets ALTER COLUMN asset_status SET DEFAULT 'active';

-- 4. Check constraint enum strict
ALTER TABLE public.deal_assets DROP CONSTRAINT IF EXISTS deal_assets_asset_status_check;
ALTER TABLE public.deal_assets ADD CONSTRAINT deal_assets_asset_status_check
  CHECK (asset_status IN ('active', 'archived', 'draft'));