-- ============================================================================
-- PHASE 1b — REPLAY IDEMPOTENCE TEST
-- ============================================================================
-- Identique à la migration Phase 1b déjà appliquée.
-- Doit passer sans erreur ni effet de bord.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'identities') THEN
    RAISE EXCEPTION 'Table public.identities introuvable — migration Phase 1b annulée';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    RAISE EXCEPTION 'Table public.campaigns introuvable — migration Phase 1b annulée';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deal_rooms') THEN
    RAISE EXCEPTION 'Table public.deal_rooms introuvable — migration Phase 1b annulée';
  END IF;
END$$;

ALTER TABLE public.identities
  ADD COLUMN IF NOT EXISTS audio_source_path TEXT;

COMMENT ON COLUMN public.identities.audio_source_path IS
'Storage path relative to bucket identity_assets. Dedicated voice source for Voxtral TTS. Distinct from reference_video_path (legacy mixed audio/video). Population in Phase 1c via refactored upload-reference-audio function. Format expected: audio/wav, audio/mp3, audio/m4a, audio/webm.';

CREATE INDEX IF NOT EXISTS idx_identities_audio_source_path
  ON public.identities(audio_source_path)
  WHERE audio_source_path IS NOT NULL;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS company_display_name TEXT;

COMMENT ON COLUMN public.campaigns.company_display_name IS
'Display name of the prospect company (used for greeting "Bonjour l''équipe {company_display_name}" and UI display). Distinct from name (deal name). Fallback logic NOT wired in Phase 1b — to be implemented in Phase 1e (NewCampaign simplifié + greeting universel).';

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS audio_status TEXT DEFAULT 'none';

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'none';

UPDATE public.deal_rooms SET audio_status = 'none' WHERE audio_status IS NULL;
UPDATE public.deal_rooms SET video_status = 'none' WHERE video_status IS NULL;

ALTER TABLE public.deal_rooms ALTER COLUMN audio_status SET NOT NULL;
ALTER TABLE public.deal_rooms ALTER COLUMN video_status SET NOT NULL;

ALTER TABLE public.deal_rooms DROP CONSTRAINT IF EXISTS deal_rooms_audio_status_check;
ALTER TABLE public.deal_rooms ADD CONSTRAINT deal_rooms_audio_status_check
  CHECK (audio_status IN ('none', 'generating', 'ready', 'failed'));

ALTER TABLE public.deal_rooms DROP CONSTRAINT IF EXISTS deal_rooms_video_status_check;
ALTER TABLE public.deal_rooms ADD CONSTRAINT deal_rooms_video_status_check
  CHECK (video_status IN ('none', 'generating', 'ready', 'failed'));

COMMENT ON COLUMN public.deal_rooms.audio_status IS
'État de génération audio Voxtral pour la Deal Room. Valeurs autorisées : none | generating | ready | failed. Non câblé en Phase 1b — câblage Phase 1c via generate-deal-room-audio.';

COMMENT ON COLUMN public.deal_rooms.video_status IS
'État de génération vidéo Tavus pour la Deal Room. Valeurs autorisées : none | generating | ready | failed. Non câblé en Phase 1b — câblage Phase 1c via check-video-ready.';