
-- ============================================================
-- Sprint 1: Core tables for Deal Intelligence infrastructure
-- ============================================================

-- 1. video_events — granular event tracking (all 15+ event types)
CREATE TABLE public.video_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  viewer_hash text NOT NULL,
  session_id text,
  event_type text NOT NULL, -- video_opened, video_started, watch_progress, video_paused, video_resumed, video_seeked, segment_replayed, video_completed, video_dropped, speed_changed, fullscreen_toggled, tab_visibility_changed, cta_clicked, page_landed, page_shared, reaction_added, comment_submitted, page_exit
  event_data jsonb DEFAULT '{}'::jsonb, -- flexible payload per event type
  viewer_email text,
  viewer_name text,
  viewer_domain text, -- extracted from email
  device_type text, -- desktop, mobile, tablet
  user_agent text,
  ip_country text,
  referrer text,
  referred_by_hash text,
  position_sec numeric, -- position in video when event occurred
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_events_video ON public.video_events(video_id);
CREATE INDEX idx_video_events_campaign ON public.video_events(campaign_id);
CREATE INDEX idx_video_events_viewer ON public.video_events(viewer_hash);
CREATE INDEX idx_video_events_type ON public.video_events(event_type);
CREATE INDEX idx_video_events_created ON public.video_events(created_at);

ALTER TABLE public.video_events ENABLE ROW LEVEL SECURITY;

-- Public insert (anonymous viewers from landing page)
CREATE POLICY "Anyone can insert video events for active videos"
  ON public.video_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.videos WHERE videos.id = video_events.video_id AND videos.is_active = true
  ));

-- Org users can read events for their videos
CREATE POLICY "Org users can view video events"
  ON public.video_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.videos WHERE videos.id = video_events.video_id AND videos.org_id = get_user_org_id(auth.uid())
  ));

-- 2. viewers — enriched viewer profiles per campaign
CREATE TABLE public.viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  viewer_hash text NOT NULL,
  fingerprint text,
  email text,
  name text,
  title text,
  company text,
  domain text,
  is_known boolean DEFAULT false,
  via_viewer_id uuid REFERENCES public.viewers(id),
  contact_score integer,
  sponsor_score integer,
  influence_score integer,
  blocker_score integer,
  share_count integer DEFAULT 0,
  viewers_generated integer DEFAULT 0,
  total_watch_depth integer DEFAULT 0,
  replay_count integer DEFAULT 0,
  cta_clicked boolean DEFAULT false,
  last_event_at timestamptz,
  first_seen_at timestamptz DEFAULT now(),
  status text DEFAULT 'unknown', -- sponsor_actif, neutre, bloqueur_potentiel, nouveau, inconnu
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, viewer_hash)
);

CREATE INDEX idx_viewers_campaign ON public.viewers(campaign_id);
CREATE INDEX idx_viewers_domain ON public.viewers(domain);

ALTER TABLE public.viewers ENABLE ROW LEVEL SECURITY;

-- Upsert from edge functions (public insert for anonymous tracking)
CREATE POLICY "Anyone can insert viewers for active campaigns"
  ON public.viewers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update viewers"
  ON public.viewers FOR UPDATE
  USING (true);

-- Org users can read
CREATE POLICY "Org users can view viewers"
  ON public.viewers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns WHERE campaigns.id = viewers.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

-- 3. deal_scores — daily deal snapshots
CREATE TABLE public.deal_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  scored_at timestamptz NOT NULL DEFAULT now(),
  des integer DEFAULT 0, -- Deal Engagement Score
  viewer_count integer DEFAULT 0,
  sponsor_count integer DEFAULT 0,
  blocker_count integer DEFAULT 0,
  avg_watch_depth numeric DEFAULT 0,
  breadth numeric DEFAULT 0, -- % of estimated committee covered
  event_velocity numeric DEFAULT 0, -- qualified events per 7-day window
  engagement_half_life numeric, -- days to lose 50% DES
  multi_threading_score integer DEFAULT 0, -- distinct departments engaged
  momentum text DEFAULT 'stable', -- accelerating, stable, decelerating, stalled
  cold_start_regime text DEFAULT 'cold_global', -- cold_global, cold_account, warm_account, mature
  alerts jsonb DEFAULT '[]'::jsonb,
  recommended_action jsonb,
  stage_signal_gap numeric,
  graph_centralization numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_deal_scores_campaign ON public.deal_scores(campaign_id);
CREATE INDEX idx_deal_scores_scored ON public.deal_scores(scored_at);

ALTER TABLE public.deal_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can view deal scores"
  ON public.deal_scores FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_scores.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "System can insert deal scores"
  ON public.deal_scores FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update deal scores"
  ON public.deal_scores FOR UPDATE
  USING (true);

-- 4. deal_outcomes — 14 outcome labels for calibration
CREATE TABLE public.deal_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL UNIQUE,
  outcome text NOT NULL, -- won_champion_led, won_multi_threaded, won_exec_sponsored, won_inbound_pull, lost_no_champion, lost_single_threaded, lost_to_competitor, lost_to_internal_build, lost_budget, lost_timing, no_decision, champion_left, procurement_block, executive_veto, technical_disqualification, legal_security_block, ghost_deal, sponsor_promoted
  outcome_at timestamptz DEFAULT now(),
  final_des integer,
  final_patterns jsonb DEFAULT '{}'::jsonb,
  calibration_weight numeric DEFAULT 1.0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can manage deal outcomes"
  ON public.deal_outcomes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_outcomes.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

-- 5. recommendation_outcomes — feedback loop
CREATE TABLE public.recommendation_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  recommended_action text NOT NULL,
  action_taken text,
  taken_at timestamptz,
  outcome_7d text,
  outcome_30d text,
  confidence_at_rec numeric,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendation_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can manage recommendation outcomes"
  ON public.recommendation_outcomes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.campaigns WHERE campaigns.id = recommendation_outcomes.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

-- 6. agent_conversations — store Ekko Agent conversations
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb DEFAULT '{}'::jsonb,
  feedback text, -- confirmed, invalidated, no_action
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own agent conversations"
  ON public.agent_conversations FOR ALL
  USING (user_id = auth.uid());

-- 7. viewer_relationships — inferred relationships between viewers
CREATE TABLE public.viewer_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_viewer_id uuid REFERENCES public.viewers(id) ON DELETE CASCADE NOT NULL,
  target_viewer_id uuid REFERENCES public.viewers(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  relationship_type text DEFAULT 'forwarded', -- forwarded, co_viewed, same_org
  forward_probability numeric,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.viewer_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can view viewer relationships"
  ON public.viewer_relationships FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.campaigns WHERE campaigns.id = viewer_relationships.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())
  ));

CREATE POLICY "System can manage viewer relationships"
  ON public.viewer_relationships FOR INSERT
  WITH CHECK (true);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.deal_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.viewers;
