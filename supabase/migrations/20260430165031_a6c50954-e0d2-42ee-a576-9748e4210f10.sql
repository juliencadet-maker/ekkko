-- ============================================================================
-- PHASE 1b — MEDIA FOUNDATIONS
-- ============================================================================
-- Objectif : poser les colonnes média sur 3 tables existantes pour préparer
-- Phase 1c (edge functions media : generate-deal-room-audio, check-video-ready,
-- refacto upload-reference-audio).
--
-- Aucune migration de données. Aucun backfill. Aucun câblage métier en 1b.
--
-- Idempotente : peut être rejouée sans effet de bord.
-- Safe : vérifie l'existence des tables ciblées avant toute modification.
-- ============================================================================

-- ── PRÉAMBULE : vérification d'existence des tables ─────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'identities'
  ) THEN
    RAISE EXCEPTION 'Table public.identities introuvable — migration Phase 1b annulée';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'campaigns'
  ) THEN
    RAISE EXCEPTION 'Table public.campaigns introuvable — migration Phase 1b annulée';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'deal_rooms'
  ) THEN
    RAISE EXCEPTION 'Table public.deal_rooms introuvable — migration Phase 1b annulée';
  END IF;
END$$;

-- ============================================================================
-- MIGRATION 1 : audio_source_path sur identities
-- ============================================================================
-- Voix de référence dédiée pour Voxtral TTS, distincte de reference_video_path
-- (legacy mixed audio/video). Population réelle en Phase 1c via refacto de
-- upload-reference-audio. En 1b : colonne créée, NON remplie, NON câblée côté
-- upload. Lecture dans voxtral-tts ajoutée en priorité du fallback.

ALTER TABLE public.identities
  ADD COLUMN IF NOT EXISTS audio_source_path TEXT;

COMMENT ON COLUMN public.identities.audio_source_path IS
'Storage path relative to bucket identity_assets. Dedicated voice source for Voxtral TTS. Distinct from reference_video_path (legacy mixed audio/video). Population in Phase 1c via refactored upload-reference-audio function. Format expected: audio/wav, audio/mp3, audio/m4a, audio/webm.';

CREATE INDEX IF NOT EXISTS idx_identities_audio_source_path
  ON public.identities(audio_source_path)
  WHERE audio_source_path IS NOT NULL;

-- ============================================================================
-- MIGRATION 2 : company_display_name sur campaigns
-- ============================================================================
-- Nom d'affichage de l'entreprise prospect. Distinct du champ name (qui est
-- le nom du deal). Utilisé pour le greeting "Bonjour l'équipe {company_display_name}"
-- en Phase 1e + UI display. AUCUN BACKFILL : les noms de deals ne sont pas
-- des noms d'entreprise propres.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS company_display_name TEXT;

COMMENT ON COLUMN public.campaigns.company_display_name IS
'Display name of the prospect company (used for greeting "Bonjour l''équipe {company_display_name}" and UI display). Distinct from name (deal name). Fallback logic NOT wired in Phase 1b — to be implemented in Phase 1e (NewCampaign simplifié + greeting universel).';

-- ============================================================================
-- MIGRATION 3 : audio_status + video_status sur deal_rooms
-- ============================================================================
-- États de génération média associés à une Deal Room. 4 valeurs strictes :
-- none | generating | ready | failed.
-- Aucune edge function ne lit/écrit ces colonnes en Phase 1b. Câblage Phase 1c
-- via generate-deal-room-audio et check-video-ready.
--
-- ORDRE STRICT : ADD COLUMN → UPDATE NULL → SET NOT NULL → CHECK CONSTRAINT
-- Justification : sur des bases dans des états divergents (colonnes déjà
-- ajoutées en NULLABLE par une exécution antérieure incomplète), le NOT NULL
-- ne serait pas garanti par un simple ADD COLUMN ... NOT NULL DEFAULT 'none'.

-- Étape 1 : ajout colonnes (NULLABLE par sécurité)
ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS audio_status TEXT DEFAULT 'none';

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS video_status TEXT DEFAULT 'none';

-- Étape 2 : normalisation des valeurs NULL résiduelles
UPDATE public.deal_rooms
  SET audio_status = 'none'
  WHERE audio_status IS NULL;

UPDATE public.deal_rooms
  SET video_status = 'none'
  WHERE video_status IS NULL;

-- Étape 3 : application du NOT NULL après normalisation
ALTER TABLE public.deal_rooms
  ALTER COLUMN audio_status SET NOT NULL;

ALTER TABLE public.deal_rooms
  ALTER COLUMN video_status SET NOT NULL;

-- Étape 4 : CHECK constraints idempotentes
ALTER TABLE public.deal_rooms
  DROP CONSTRAINT IF EXISTS deal_rooms_audio_status_check;
ALTER TABLE public.deal_rooms
  ADD CONSTRAINT deal_rooms_audio_status_check
  CHECK (audio_status IN ('none', 'generating', 'ready', 'failed'));

ALTER TABLE public.deal_rooms
  DROP CONSTRAINT IF EXISTS deal_rooms_video_status_check;
ALTER TABLE public.deal_rooms
  ADD CONSTRAINT deal_rooms_video_status_check
  CHECK (video_status IN ('none', 'generating', 'ready', 'failed'));

COMMENT ON COLUMN public.deal_rooms.audio_status IS
'État de génération audio Voxtral pour la Deal Room. Valeurs autorisées : none | generating | ready | failed. Non câblé en Phase 1b — câblage Phase 1c via generate-deal-room-audio.';

COMMENT ON COLUMN public.deal_rooms.video_status IS
'État de génération vidéo Tavus pour la Deal Room. Valeurs autorisées : none | generating | ready | failed. Non câblé en Phase 1b — câblage Phase 1c via check-video-ready.';