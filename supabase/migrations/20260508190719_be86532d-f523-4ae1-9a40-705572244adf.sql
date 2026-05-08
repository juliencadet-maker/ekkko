-- Phase 1c-3 — orgs.feature_flags + helper

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_orgs_feature_flags
  ON public.orgs USING GIN(feature_flags);

COMMENT ON COLUMN public.orgs.feature_flags IS
  'Feature flags par org. JSONB de booléens. Flags V1.5 attendus : { "deal_room_v15": bool, "agent_compose_autonomous": bool, "extension_capture_mode": bool }. Activation manuelle par admin pour pilotes contrôlés.';

CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_org_id UUID,
  p_flag_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (feature_flags->>p_flag_name)::boolean
       FROM public.orgs
       WHERE id = p_org_id),
    false
  );
$$;

COMMENT ON FUNCTION public.is_feature_enabled(UUID, TEXT) IS
  'Helper. Retourne false si org n''existe pas ou si flag absent. Usage côté edge functions et frontend.';