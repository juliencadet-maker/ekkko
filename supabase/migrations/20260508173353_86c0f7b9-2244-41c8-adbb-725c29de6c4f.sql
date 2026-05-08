-- =====================================================
-- PHASE 1c-1c — Asset tracked links + communication log + agent compose
-- Tranchages : Q1 (sha256 hex 64) / Q2 (INDEX simple partiel) /
--              Q3 (link_token UNIQUE + UNIQUE partial (deal_asset_id, target_url)) /
--              Q4 (sortant uniquement) / Q5 (persistante, RLS org+user)
-- D51 : email_hash_global colonne archi pure, NULL par défaut
-- D59 : COMMENT only sur deal_assets.tracked_links (deprecated)
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1. asset_tracked_links
-- ─────────────────────────────────────────────────────
CREATE TABLE public.asset_tracked_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_asset_id   uuid NOT NULL,
  campaign_id     uuid NOT NULL,
  org_id          uuid NOT NULL,
  link_token      text NOT NULL,
  link_label      text,
  target_url      text NOT NULL,
  click_count     integer NOT NULL DEFAULT 0,
  last_clicked_at timestamptz,
  archived_at     timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid,
  CONSTRAINT asset_tracked_links_link_token_key UNIQUE (link_token),
  CONSTRAINT asset_tracked_links_target_url_chk CHECK (length(target_url) > 0 AND length(target_url) <= 2048),
  CONSTRAINT asset_tracked_links_link_token_chk CHECK (length(link_token) BETWEEN 8 AND 128)
);

CREATE UNIQUE INDEX asset_tracked_links_asset_url_active_uq
  ON public.asset_tracked_links (deal_asset_id, target_url)
  WHERE archived_at IS NULL;

CREATE INDEX asset_tracked_links_campaign_idx ON public.asset_tracked_links (campaign_id);
CREATE INDEX asset_tracked_links_org_idx      ON public.asset_tracked_links (org_id);
CREATE INDEX asset_tracked_links_asset_idx    ON public.asset_tracked_links (deal_asset_id);

ALTER TABLE public.asset_tracked_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can access asset_tracked_links"
ON public.asset_tracked_links
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = asset_tracked_links.campaign_id
    AND c.org_id = public.get_user_org_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = asset_tracked_links.campaign_id
    AND c.org_id = public.get_user_org_id(auth.uid())
));

CREATE TRIGGER trg_atl_updated_at
BEFORE UPDATE ON public.asset_tracked_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.asset_tracked_links IS
  'Liens trackés par asset (Phase 1c-1c). Remplace deal_assets.tracked_links JSONB. UNIQUE (deal_asset_id, target_url) WHERE archived_at IS NULL.';

-- ─────────────────────────────────────────────────────
-- 2. deal_communication_log (sortant uniquement, Q4)
-- ─────────────────────────────────────────────────────
CREATE TABLE public.deal_communication_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   uuid NOT NULL,
  org_id        uuid NOT NULL,
  channel       text NOT NULL,
  source        text NOT NULL,
  direction     text NOT NULL DEFAULT 'outbound',
  subject       text,
  body_preview  text,
  recipient_email text,
  recipient_handle text,
  sent_by_user_id uuid,
  external_ref  text,
  status        text NOT NULL DEFAULT 'sent',
  error_message text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at       timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dcl_channel_chk   CHECK (channel IN ('email','slack','teams','whatsapp','extension','other')),
  CONSTRAINT dcl_direction_chk CHECK (direction = 'outbound'),
  CONSTRAINT dcl_status_chk    CHECK (status IN ('queued','sent','delivered','failed','bounced'))
);

CREATE INDEX dcl_campaign_idx ON public.deal_communication_log (campaign_id, sent_at DESC);
CREATE INDEX dcl_org_idx      ON public.deal_communication_log (org_id);
CREATE INDEX dcl_channel_idx  ON public.deal_communication_log (channel);

ALTER TABLE public.deal_communication_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can access deal_communication_log"
ON public.deal_communication_log
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = deal_communication_log.campaign_id
    AND c.org_id = public.get_user_org_id(auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns c
  WHERE c.id = deal_communication_log.campaign_id
    AND c.org_id = public.get_user_org_id(auth.uid())
));

CREATE TRIGGER trg_dcl_updated_at
BEFORE UPDATE ON public.deal_communication_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.deal_communication_log IS
  'Journal des communications SORTANTES uniquement (Phase 1c-1c, Q4). Sources : edge functions push (notify-approval, deal-trigger-notify, slack-helper, send-share-invite) + extension Chrome. Comms entrantes (replies email, Slack/Teams) restent dans timeline_events / deal_signals.';

-- ─────────────────────────────────────────────────────
-- 3. agent_compose_sessions (persistant, Q5)
-- ─────────────────────────────────────────────────────
CREATE TABLE public.agent_compose_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL,
  org_id          uuid NOT NULL,
  user_id         uuid NOT NULL,
  session_type    text NOT NULL DEFAULT 'compose',
  prompt          text,
  response        text,
  model           text,
  llm_cost_cents  integer,
  tokens_in       integer,
  tokens_out      integer,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status          text NOT NULL DEFAULT 'completed',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acs_session_type_chk CHECK (session_type IN ('compose','replay','review','draft')),
  CONSTRAINT acs_status_chk CHECK (status IN ('pending','completed','failed','archived'))
);

CREATE INDEX acs_campaign_idx ON public.agent_compose_sessions (campaign_id, created_at DESC);
CREATE INDEX acs_user_idx     ON public.agent_compose_sessions (user_id);
CREATE INDEX acs_org_idx      ON public.agent_compose_sessions (org_id);

ALTER TABLE public.agent_compose_sessions ENABLE ROW LEVEL SECURITY;

-- RLS : org members ET (user_id = auth.uid() OU manager+) — simple : org members en read, owner/manager en write
CREATE POLICY "Org members can read agent_compose_sessions"
ON public.agent_compose_sessions
FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id(auth.uid()));

CREATE POLICY "Users can create their own compose sessions"
ON public.agent_compose_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND org_id = public.get_user_org_id(auth.uid())
);

CREATE POLICY "Users can update their own compose sessions"
ON public.agent_compose_sessions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_acs_updated_at
BEFORE UPDATE ON public.agent_compose_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.agent_compose_sessions IS
  'Historique persistant des sessions de composition assistées (Phase 1c-1c, Q5). Donnée métier (replay, audit, coût LLM). Cleanup = Phase Mega-features (1 an + archivage).';

-- ─────────────────────────────────────────────────────
-- 4. viewers.email_hash_global (D51 archi pure)
-- ─────────────────────────────────────────────────────
ALTER TABLE public.viewers
  ADD COLUMN email_hash_global text;

CREATE INDEX viewers_email_hash_global_idx
  ON public.viewers (email_hash_global)
  WHERE email_hash_global IS NOT NULL;

COMMENT ON COLUMN public.viewers.email_hash_global IS
  'SHA256 hex (64 chars) de lower(trim(email)) pour identité cross-deal (D51, Phase 1c-1c). NULL en V1.5 (archi pure, aucun backfill). Calcul applicatif uniquement.';

-- ─────────────────────────────────────────────────────
-- 5. DEPRECATED comment sur deal_assets.tracked_links (D59 pattern)
-- ─────────────────────────────────────────────────────
COMMENT ON COLUMN public.deal_assets.tracked_links IS
  'DEPRECATED — use asset_tracked_links (Phase 1c-1c). Conservé en lecture seule pour rétro-compatibilité.';

-- ─────────────────────────────────────────────────────
-- 6. Validation (RAISE NOTICE)
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_atl_legacy_to_migrate integer;
  v_viewers_with_email    integer;
  v_viewers_hash_backfill integer;
BEGIN
  SELECT COUNT(*) INTO v_atl_legacy_to_migrate
  FROM public.deal_assets
  WHERE tracked_links IS NOT NULL
    AND tracked_links::text NOT IN ('{}','null')
    AND jsonb_typeof(tracked_links) = 'object'
    AND tracked_links <> '{}'::jsonb;

  SELECT COUNT(*) INTO v_viewers_with_email FROM public.viewers WHERE email IS NOT NULL;
  SELECT COUNT(*) INTO v_viewers_hash_backfill FROM public.viewers WHERE email_hash_global IS NOT NULL;

  RAISE NOTICE '[Phase 1c-1c] tracked_links legacy à migrer : % (attendu 0)', v_atl_legacy_to_migrate;
  RAISE NOTICE '[Phase 1c-1c] viewers avec email : % | viewers email_hash_global non NULL : % (attendu 0, D51)',
    v_viewers_with_email, v_viewers_hash_backfill;

  IF v_atl_legacy_to_migrate <> 0 THEN
    RAISE WARNING '[Phase 1c-1c] tracked_links legacy non vide détecté : % lignes — backfill manuel requis', v_atl_legacy_to_migrate;
  END IF;
  IF v_viewers_hash_backfill <> 0 THEN
    RAISE WARNING '[Phase 1c-1c] email_hash_global déjà rempli (% lignes) — D51 viole', v_viewers_hash_backfill;
  END IF;
END $$;