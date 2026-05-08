-- =========================================================================
-- Phase 1c-1a — Bibliothèque assets org-level
-- =========================================================================

-- 0. Préambule défensif
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='deal_assets') THEN
    RAISE EXCEPTION 'Pré-requis manquant : table public.deal_assets absente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='campaigns') THEN
    RAISE EXCEPTION 'Pré-requis manquant : table public.campaigns absente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_user_org_id') THEN
    RAISE EXCEPTION 'Pré-requis manquant : fonction public.get_user_org_id absente';
  END IF;
END $$;

-- 1. CREATE TABLE public.assets
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('presentation','demo','case_study','whitepaper','video','other')),
  purpose TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  last_used_at TIMESTAMPTZ,
  last_used_for_company TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_via TEXT NOT NULL DEFAULT 'web' CHECK (created_via IN ('web','extension','agent_compositeur','legacy_migration')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

COMMENT ON TABLE public.assets IS 'Bibliothèque assets org-level (Phase 1c-1a). Sources de référence réutilisables, distinctes des deal_assets (instances par deal).';
COMMENT ON COLUMN public.assets.storage_path IS 'Path Supabase Storage relatif (ex: org_id/asset_id.pdf), pas une URL';
COMMENT ON COLUMN public.assets.created_via IS 'Origine de création : web (UI manuel), extension (Chrome), agent_compositeur (LLM), legacy_migration (backfill 1c-1a)';
COMMENT ON COLUMN public.assets.archived_at IS 'Soft-archive applicatif. Distinct de deal_assets.deleted_at (qui concerne les instances par deal)';

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_assets_org_id ON public.assets(org_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner_id ON public.assets(owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_owner_last_used ON public.assets(owner_id, last_used_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_assets_tags_gin ON public.assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_assets_search_fts ON public.assets USING GIN(
  to_tsvector('french', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(purpose,''))
);

-- 3. RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view assets in their org" ON public.assets;
CREATE POLICY "Users can view assets in their org"
  ON public.assets FOR SELECT TO authenticated
  USING (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Users can insert assets in their org" ON public.assets;
CREATE POLICY "Users can insert assets in their org"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (org_id = get_user_org_id(auth.uid()));

DROP POLICY IF EXISTS "Owners can update their assets" ON public.assets;
CREATE POLICY "Owners can update their assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() AND org_id = get_user_org_id(auth.uid()))
  WITH CHECK (owner_id = auth.uid() AND org_id = get_user_org_id(auth.uid()));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_assets_updated_at ON public.assets;
CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ALTER deal_assets : colonne pivot
ALTER TABLE public.deal_assets
  ADD COLUMN IF NOT EXISTS asset_library_id UUID REFERENCES public.assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deal_assets_library_id
  ON public.deal_assets(asset_library_id)
  WHERE asset_library_id IS NOT NULL;

-- 5. Backfill idempotent
DO $$
DECLARE
  v_da_record RECORD;
  v_org_id UUID;
  v_owner_id UUID;
  v_storage_path TEXT;
  v_asset_type TEXT;
  v_lower TEXT;
  v_new_asset_id UUID;
  v_migrated INT := 0;
  v_skipped INT := 0;
  v_storage_public INT := 0;
  v_storage_signed INT := 0;
  v_storage_relative INT := 0;
  v_unclear_storage INT := 0;
  v_other_type INT := 0;
BEGIN
  FOR v_da_record IN
    SELECT da.*, c.org_id AS c_org_id, c.created_by_user_id AS c_owner_id
    FROM public.deal_assets da
    JOIN public.campaigns c ON c.id = da.campaign_id
    WHERE da.asset_library_id IS NULL
      AND da.deleted_at IS NULL
  LOOP
    v_org_id := v_da_record.c_org_id;
    v_owner_id := v_da_record.c_owner_id;

    IF v_org_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- storage_path extraction
    IF v_da_record.file_url IS NULL OR v_da_record.file_url = '' THEN
      v_storage_path := 'legacy/' || v_da_record.id::text;
      v_unclear_storage := v_unclear_storage + 1;
      RAISE NOTICE '[backfill] file_url null/empty deal_asset_id=%', v_da_record.id;
    ELSIF v_da_record.file_url LIKE '%/storage/v1/object/public/%' THEN
      v_storage_path := regexp_replace(v_da_record.file_url, '^.*/storage/v1/object/public/[^/]+/', '');
      v_storage_public := v_storage_public + 1;
    ELSIF v_da_record.file_url LIKE '%/storage/v1/object/sign/%' THEN
      v_storage_path := regexp_replace(regexp_replace(v_da_record.file_url, '^.*/storage/v1/object/sign/[^/]+/', ''), '\?.*$', '');
      v_storage_signed := v_storage_signed + 1;
    ELSIF v_da_record.file_url NOT LIKE 'http%' AND v_da_record.file_url NOT LIKE '//%' THEN
      v_storage_path := v_da_record.file_url;
      v_storage_relative := v_storage_relative + 1;
    ELSE
      v_storage_path := v_da_record.file_url;
      v_unclear_storage := v_unclear_storage + 1;
      RAISE NOTICE '[backfill] file_url pattern unclear deal_asset_id=% url=%', v_da_record.id, v_da_record.file_url;
    END IF;

    -- asset_type mapping fallback
    v_lower := lower(coalesce(v_da_record.asset_type, ''));
    IF v_lower IN ('presentation','demo','case_study','whitepaper','video','other') THEN
      v_asset_type := v_lower;
    ELSIF v_lower LIKE '%present%' THEN v_asset_type := 'presentation';
    ELSIF v_lower LIKE '%demo%' THEN v_asset_type := 'demo';
    ELSIF v_lower LIKE '%case%' OR v_lower LIKE '%client%' THEN v_asset_type := 'case_study';
    ELSIF v_lower LIKE '%whitepaper%' OR v_lower LIKE '%paper%' THEN v_asset_type := 'whitepaper';
    ELSIF v_lower LIKE '%video%' OR v_lower LIKE '%vidéo%' THEN v_asset_type := 'video';
    ELSE
      v_asset_type := 'other';
      v_other_type := v_other_type + 1;
      RAISE NOTICE '[backfill] asset_type fallback to other deal_asset_id=% original=%', v_da_record.id, v_da_record.asset_type;
    END IF;

    -- Insert asset library entry
    INSERT INTO public.assets (
      org_id, owner_id, name, asset_type, purpose, storage_path, created_via, created_at
    ) VALUES (
      v_org_id,
      v_owner_id,
      coalesce(v_da_record.asset_purpose, 'Asset legacy ' || substring(v_da_record.id::text, 1, 8)),
      v_asset_type,
      v_da_record.asset_purpose,
      v_storage_path,
      'legacy_migration',
      v_da_record.created_at
    ) RETURNING id INTO v_new_asset_id;

    UPDATE public.deal_assets SET asset_library_id = v_new_asset_id WHERE id = v_da_record.id;
    v_migrated := v_migrated + 1;
  END LOOP;

  RAISE NOTICE '[backfill] migrated=% skipped_no_org=% storage_public=% storage_signed=% storage_relative=% unclear_storage=% other_type=%',
    v_migrated, v_skipped, v_storage_public, v_storage_signed, v_storage_relative, v_unclear_storage, v_other_type;
END $$;

-- 6. Validation post-migration
DO $$
DECLARE
  v_orphan INT;
BEGIN
  SELECT count(*) INTO v_orphan
  FROM public.deal_assets da
  JOIN public.campaigns c ON c.id = da.campaign_id
  WHERE da.asset_library_id IS NULL
    AND da.deleted_at IS NULL
    AND c.org_id IS NOT NULL;

  IF v_orphan > 0 THEN
    RAISE WARNING '[validation] % deal_assets actifs avec org_id sans asset_library_id', v_orphan;
  ELSE
    RAISE NOTICE '[validation] OK : 0 orphan';
  END IF;
END $$;
