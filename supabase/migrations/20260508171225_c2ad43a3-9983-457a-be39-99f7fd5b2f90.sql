-- Phase 1c-1b — Surface Deal Room media (idempotente, D59/D60/D61 + R1/R2/R4)

-- 1. deal_room_version (21 colonnes)
CREATE TABLE IF NOT EXISTS public.deal_room_version (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_room_id          uuid NOT NULL,
  campaign_id           uuid NOT NULL,
  org_id                uuid NOT NULL,
  version_number        integer NOT NULL DEFAULT 1,
  is_active             boolean NOT NULL DEFAULT false,
  script_raw_text       text,
  script_naturalized    text,
  audio_status          text NOT NULL DEFAULT 'none',
  audio_storage_path    text,
  audio_duration_ms     integer,
  video_status          text NOT NULL DEFAULT 'none',
  video_storage_path    text,
  video_duration_ms     integer,
  provider_audio        text,
  provider_video        text,
  provider_job_id       text,
  created_by_user_id    uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.deal_room_version IS
  'V1.5 — Versioning du media du Deal Room (script + audio + video). Coexiste avec script_versions (V0, edition pre-rejet) — D61.';

-- 2. CHECK constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_room_version_audio_status_chk') THEN
    ALTER TABLE public.deal_room_version
      ADD CONSTRAINT deal_room_version_audio_status_chk
      CHECK (audio_status IN ('none','pending','processing','ready','error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'deal_room_version_video_status_chk') THEN
    ALTER TABLE public.deal_room_version
      ADD CONSTRAINT deal_room_version_video_status_chk
      CHECK (video_status IN ('none','pending','processing','ready','error'));
  END IF;
END $$;

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_drv_deal_room ON public.deal_room_version(deal_room_id);
CREATE INDEX IF NOT EXISTS idx_drv_campaign  ON public.deal_room_version(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drv_org       ON public.deal_room_version(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drv_active_per_room
  ON public.deal_room_version(deal_room_id) WHERE is_active = true;

-- 4. RLS deal_room_version
ALTER TABLE public.deal_room_version ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can access deal_room_version" ON public.deal_room_version;
CREATE POLICY "Org members can access deal_room_version"
  ON public.deal_room_version
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = deal_room_version.campaign_id
      AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

-- 5. Triggers BEFORE UPDATE (R4 — ordre alphabetique)
CREATE OR REPLACE FUNCTION public.invalidate_audio_on_script_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.script_raw_text IS DISTINCT FROM OLD.script_raw_text THEN
    NEW.audio_status := 'none';
    NEW.audio_storage_path := NULL;
    NEW.audio_duration_ms := NULL;
    NEW.video_status := 'none';
    NEW.video_storage_path := NULL;
    NEW.video_duration_ms := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_drv_updated_at ON public.deal_room_version;
CREATE TRIGGER trg_drv_updated_at
  BEFORE UPDATE ON public.deal_room_version
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_invalidate_audio ON public.deal_room_version;
CREATE TRIGGER trg_invalidate_audio
  BEFORE UPDATE ON public.deal_room_version
  FOR EACH ROW EXECUTE FUNCTION public.invalidate_audio_on_script_change();

-- 6. idempotency_keys (D60)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key            text PRIMARY KEY,
  scope          text NOT NULL,
  org_id         uuid,
  campaign_id    uuid,
  request_hash   text,
  response       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
COMMENT ON TABLE public.idempotency_keys IS
  'Backend-only — acces service_role uniquement. RLS ON sans policy par design (D60). Ne pas exposer a role authenticated.';
CREATE INDEX IF NOT EXISTS idx_idem_expires ON public.idempotency_keys(expires_at);
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- 7. RGPD
ALTER TABLE public.identities ADD COLUMN IF NOT EXISTS cloning_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles   ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;
UPDATE public.identities SET cloning_active = true WHERE cloning_active IS NULL;

-- 8. Cohabitation D59/D61 — COMMENT only
COMMENT ON COLUMN public.campaigns.script_oral IS
  'Legacy V0 (Self-Campaign) — non touche en V1.5. Pipeline existant conserve. D59.';
COMMENT ON TABLE public.script_versions IS
  'V0 — historique iteration de script pre-rejet (Self-Campaign). Coexiste avec deal_room_version (V1.5). D61.';
COMMENT ON COLUMN public.deal_rooms.audio_status IS
  'Cache denormalise de la version active. Source de verite = deal_room_version.audio_status WHERE is_active. D61.';
COMMENT ON COLUMN public.deal_rooms.video_status IS
  'Cache denormalise de la version active. Source de verite = deal_room_version.video_status WHERE is_active. D61.';

-- 9. Validation post-migration (R2)
DO $$
DECLARE
  v_identities_with_cloning_active INTEGER;
  v_profiles_count INTEGER;
  v_profiles_deactivated_null INTEGER;
  v_deal_room_version_count INTEGER;
  v_idempotency_count INTEGER;
BEGIN
  SELECT count(*) INTO v_identities_with_cloning_active FROM public.identities WHERE cloning_active IS NOT NULL;
  SELECT count(*) INTO v_profiles_count FROM public.profiles;
  SELECT count(*) INTO v_profiles_deactivated_null FROM public.profiles WHERE deactivated_at IS NULL;
  SELECT count(*) INTO v_deal_room_version_count FROM public.deal_room_version;
  SELECT count(*) INTO v_idempotency_count FROM public.idempotency_keys;

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Phase 1c-1b validation';
  RAISE NOTICE '  identities avec cloning_active set : % (cible: 11)', v_identities_with_cloning_active;
  RAISE NOTICE '  profiles total                     : % (cible: 2)', v_profiles_count;
  RAISE NOTICE '  profiles avec deactivated_at NULL  : % (cible: 2)', v_profiles_deactivated_null;
  RAISE NOTICE '  deal_room_version count            : % (cible: 0)', v_deal_room_version_count;
  RAISE NOTICE '  idempotency_keys count             : % (cible: 0)', v_idempotency_count;
  RAISE NOTICE '======================================';

  IF v_identities_with_cloning_active < 11 THEN
    RAISE WARNING 'Phase 1c-1b : cloning_active non popule pour 100%% des identities.';
  END IF;
  IF v_profiles_deactivated_null < v_profiles_count THEN
    RAISE WARNING 'Phase 1c-1b : profile(s) avec deactivated_at NOT NULL post-migration. Anormal.';
  END IF;
END $$;