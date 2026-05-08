
-- ================================================================
-- Phase 1c-2 — Schema + Guardrail V0 + Storage V1.5
-- ================================================================

-- 1. system_config table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role only on system_config" ON public.system_config;
CREATE POLICY "service_role only on system_config"
  ON public.system_config FOR ALL TO service_role
  USING (true) WITH CHECK (true);

COMMENT ON TABLE public.system_config IS
  'Configuration système non-secrète. Ne contient JAMAIS de secrets en clair (tokens stockés sous forme de hash SHA-256). Lecture/écriture réservée au service_role.';

-- Bootstrap V0 writer token hash (real SHA-256 of generated token)
INSERT INTO public.system_config (key, value, description)
VALUES (
  'v0_writer_token_hash',
  '16013e338ea8eae4494f6b8c08a1406e61e46b4ba7b84eb6a5bd197a6daba29f',
  'SHA-256 hash of V0_WRITER_TOKEN env var. Phase 1c-2.'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

-- 2. RPC merged v0_update_script_oral ----------------------------------
CREATE OR REPLACE FUNCTION public.v0_update_script_oral(
  p_token TEXT,
  p_campaign_id UUID,
  p_script_oral TEXT,
  p_generated_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, extensions
AS $$
DECLARE
  v_expected_hash TEXT;
  v_provided_hash TEXT;
BEGIN
  v_provided_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT value INTO v_expected_hash
  FROM public.system_config
  WHERE key = 'v0_writer_token_hash';

  IF v_expected_hash IS NULL OR v_provided_hash != v_expected_hash THEN
    RAISE EXCEPTION 'V0_WRITER_CONTEXT_ERROR: invalid or unconfigured token';
  END IF;

  -- LOCAL flag — survives only inside the current transaction.
  PERFORM set_config('app.is_v0_writer', 'true', true);

  UPDATE public.campaigns
     SET script_oral = p_script_oral,
         script_oral_generated_at = p_generated_at,
         updated_at = now()
   WHERE id = p_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.v0_update_script_oral(TEXT, UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.v0_update_script_oral(TEXT, UUID, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.v0_update_script_oral IS
  'Phase 1c-2 — Single legitimate write path for campaigns.script_oral. Validates V0 token + sets transaction-local flag + UPDATE atomically. Pattern for future V0-protected writes: v0_<verb>_<table>.';

-- 3. Trigger protect_v0_script_oral on campaigns -------------------------
CREATE OR REPLACE FUNCTION public.protect_v0_script_oral()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.script_oral IS DISTINCT FROM NEW.script_oral THEN
    IF current_setting('app.is_v0_writer', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'PROTECTION_V0: campaigns.script_oral can only be modified via v0_update_script_oral RPC.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_v0_script_oral ON public.campaigns;
CREATE TRIGGER trg_protect_v0_script_oral
  BEFORE UPDATE OF script_oral ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_v0_script_oral();

-- 4. Reinforced comment on script_versions (Option α) -------------------
COMMENT ON TABLE public.script_versions IS
  'Historique audit V0 — éditions manuelles de scripts par AE depuis CampaignDetail.tsx. ⚠️ V0 ONLY : aucune edge function V1.5 (transform-script-to-speech-v1, generate-deal-room-audio, deal-room-publish, etc.) ne doit JAMAIS écrire dans cette table. Pas de garde-fou DB-level (Option α — Phase 1c-2) car INSERT frontend légitime existe. Mitigation : code review strict + test E2E Phase 1d. Convergence : kill direct Phase 2 post-V0.';

-- 5. Storage buckets V1.5 -----------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-room-audio', 'deal-room-audio', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('deal-room-video', 'deal-room-video', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — folder convention: <org_id>/<campaign_id>/<deal_room_id>/<file>
DROP POLICY IF EXISTS "deal_room_audio org read"   ON storage.objects;
DROP POLICY IF EXISTS "deal_room_audio org write"  ON storage.objects;
DROP POLICY IF EXISTS "deal_room_audio org update" ON storage.objects;
DROP POLICY IF EXISTS "deal_room_audio org delete" ON storage.objects;
DROP POLICY IF EXISTS "deal_room_video org read"   ON storage.objects;
DROP POLICY IF EXISTS "deal_room_video org write"  ON storage.objects;
DROP POLICY IF EXISTS "deal_room_video org update" ON storage.objects;
DROP POLICY IF EXISTS "deal_room_video org delete" ON storage.objects;

CREATE POLICY "deal_room_audio org read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-room-audio'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_audio org write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deal-room-audio'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_audio org update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'deal-room-audio'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_audio org delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'deal-room-audio'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_video org read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'deal-room-video'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_video org write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deal-room-video'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_video org update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'deal-room-video'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "deal_room_video org delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'deal-room-video'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid() AND m.is_active = TRUE
        AND (m.org_id)::text = (storage.foldername(name))[1]
    )
  );

-- 6. idempotency_keys default expiry 7 days -----------------------------
ALTER TABLE public.idempotency_keys
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '7 days');

-- 7. updated_at trigger on system_config --------------------------------
DROP TRIGGER IF EXISTS trg_system_config_updated_at ON public.system_config;
CREATE TRIGGER trg_system_config_updated_at
  BEFORE UPDATE ON public.system_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
