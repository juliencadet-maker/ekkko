
-- 1d.5h-bis-NUKE — Commit 1 — DB foundation (T2 + T3)
-- 10 nouvelles tables + ALTER taxonomie D106
-- Idempotent. RLS strict intra-org. Aucune logique nouvelle activée.

-- =====================================================================
-- T2 — 10 NOUVELLES TABLES
-- =====================================================================

-- 1. best_actions_catalog
CREATE TABLE IF NOT EXISTS public.best_actions_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  pattern_code TEXT NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('standard','rsc_powermap','meta_pattern')),
  action_family TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_role TEXT,
  owner TEXT CHECK (owner IN ('ae','manager','cro','ceo','cto','cfo','president_region','comex_member')),
  effort_level TEXT CHECK (effort_level IN ('low','medium','high')),
  urgency TEXT CHECK (urgency IN ('low','medium','high','critical')),
  action_impact_level TEXT CHECK (action_impact_level IN ('low','medium','strategic')),
  reversibility TEXT CHECK (reversibility IN ('easy','moderate','hard')),
  lifecycle_stage TEXT,
  rationale_fact_based TEXT,
  required_inputs JSONB,
  contraindications JSONB,
  generated_asset_type TEXT,
  expected_outcome TEXT,
  expected_signal_windows JSONB,
  cooldown_days INTEGER,
  fallback_action_if_failed TEXT,
  differentiation_score FLOAT,
  grip_score FLOAT,
  required_tier TEXT CHECK (required_tier IN ('starter','pro','enterprise')),
  required_executive_role TEXT,
  current_stage TEXT NOT NULL DEFAULT 'proposed' CHECK (current_stage IN ('proposed','experimental','validated','core_pattern')),
  proposed_by_ae_id UUID,
  total_matches INTEGER DEFAULT 0,
  positive_outcomes INTEGER DEFAULT 0,
  negative_outcomes INTEGER DEFAULT 0,
  acceptance_rate FLOAT,
  bypass_confidence_threshold BOOLEAN DEFAULT FALSE,
  triggers_when TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  origin TEXT DEFAULT 'seeded' CHECK (origin IN ('seeded','community_v2')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, pattern_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.best_actions_catalog TO authenticated;
GRANT ALL ON public.best_actions_catalog TO service_role;
ALTER TABLE public.best_actions_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "best_actions_org_isolated" ON public.best_actions_catalog;
CREATE POLICY "best_actions_org_isolated" ON public.best_actions_catalog
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 2. best_action_proposals
CREATE TABLE IF NOT EXISTS public.best_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  proposed_by_ae_id UUID NOT NULL,
  pattern_draft JSONB NOT NULL,
  rationale TEXT,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.best_action_proposals TO authenticated;
GRANT ALL ON public.best_action_proposals TO service_role;
ALTER TABLE public.best_action_proposals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "proposals_org_isolated" ON public.best_action_proposals;
CREATE POLICY "proposals_org_isolated" ON public.best_action_proposals
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 3. pattern_matches  (deal_id pointe vers campaigns(id) — legacy DB)
CREATE TABLE IF NOT EXISTS public.pattern_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  pattern_code TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_source TEXT NOT NULL,
  contraindications_checked JSONB,
  expected_window JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','surfaced','accepted','rejected','executed','expired')),
  ae_user_id UUID,
  surfaced_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  pending_external_action_id UUID,
  meta_pattern_fallback BOOLEAN DEFAULT FALSE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pattern_matches TO authenticated;
GRANT ALL ON public.pattern_matches TO service_role;
ALTER TABLE public.pattern_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "matches_org_isolated" ON public.pattern_matches;
CREATE POLICY "matches_org_isolated" ON public.pattern_matches
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 4. action_outcomes
CREATE TABLE IF NOT EXISTS public.action_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_match_id UUID REFERENCES public.pattern_matches(id) ON DELETE SET NULL,
  pattern_code TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  outcome TEXT CHECK (outcome IN ('positive','neutral','negative','mixed','pending','no_outcome')),
  evidence_signals JSONB,
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  measurement_window_days INTEGER DEFAULT 7
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_outcomes TO authenticated;
GRANT ALL ON public.action_outcomes TO service_role;
ALTER TABLE public.action_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outcomes_org_isolated" ON public.action_outcomes;
CREATE POLICY "outcomes_org_isolated" ON public.action_outcomes
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 5. external_news_events
CREATE TABLE IF NOT EXISTS public.external_news_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ae_declared','rss','crunchbase','google_news','linkedin_public','press_release')),
  observed_at TIMESTAMPTZ NOT NULL,
  classified_relevance TEXT CHECK (classified_relevance IN ('high','medium','low','unrelated')),
  time_sensitivity TEXT CHECK (time_sensitivity IN ('urgent','standard','monitor')),
  confidence FLOAT,
  truth_layer TEXT NOT NULL DEFAULT 'fact' CHECK (truth_layer IN ('fact','inference','declared')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_news_events TO authenticated;
GRANT ALL ON public.external_news_events TO service_role;
ALTER TABLE public.external_news_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "news_events_org_isolated" ON public.external_news_events;
CREATE POLICY "news_events_org_isolated" ON public.external_news_events
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 6. external_people_changes
CREATE TABLE IF NOT EXISTS public.external_people_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  person_name TEXT,
  person_role_new TEXT,
  person_role_old TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('new_hire','role_change','departure','promotion')),
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  classified_relevance TEXT CHECK (classified_relevance IN ('high','medium','low','unrelated')),
  classified_impact TEXT CHECK (classified_impact IN ('blocker','accelerator','neutral','unknown')),
  confidence FLOAT,
  truth_layer TEXT NOT NULL DEFAULT 'fact',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_people_changes TO authenticated;
GRANT ALL ON public.external_people_changes TO service_role;
ALTER TABLE public.external_people_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "people_changes_org_isolated" ON public.external_people_changes;
CREATE POLICY "people_changes_org_isolated" ON public.external_people_changes
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 7. compound_signals
CREATE TABLE IF NOT EXISTS public.compound_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  compound_type TEXT NOT NULL CHECK (compound_type IN ('buying_intent','hot_stakeholder','deal_slipping','competitive_review')),
  atomic_signals_refs JSONB NOT NULL,
  confidence FLOAT NOT NULL,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compound_signals TO authenticated;
GRANT ALL ON public.compound_signals TO service_role;
ALTER TABLE public.compound_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compound_org_isolated" ON public.compound_signals;
CREATE POLICY "compound_org_isolated" ON public.compound_signals
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 8. account_storyline
CREATE TABLE IF NOT EXISTS public.account_storyline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  storyline_narrative TEXT,
  key_milestones JSONB,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_storyline TO authenticated;
GRANT ALL ON public.account_storyline TO service_role;
ALTER TABLE public.account_storyline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account_storyline_org_isolated" ON public.account_storyline;
CREATE POLICY "account_storyline_org_isolated" ON public.account_storyline
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 9. deal_storyline
CREATE TABLE IF NOT EXISTS public.deal_storyline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  storyline_narrative TEXT,
  key_milestones JSONB,
  storyline_for_vp TEXT,
  storyline_for_exec TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deal_storyline TO authenticated;
GRANT ALL ON public.deal_storyline TO service_role;
ALTER TABLE public.deal_storyline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deal_storyline_org_isolated" ON public.deal_storyline;
CREATE POLICY "deal_storyline_org_isolated" ON public.deal_storyline
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- 10. account_ecosystem_map (RSC PowerMap)
CREATE TABLE IF NOT EXISTS public.account_ecosystem_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  viewer_hash TEXT NOT NULL,
  email_domain TEXT NOT NULL,
  domain_category TEXT NOT NULL CHECK (domain_category IN (
    'prospect_internal','consulting_firm','investment_fund','partner_strategic',
    'board_member','ekko_client_other','competitor','recruiter','unknown_external'
  )),
  inferred_role TEXT,
  inferred_supporter_score FLOAT CHECK (inferred_supporter_score BETWEEN -1 AND 1),
  inferred_blocker_score FLOAT CHECK (inferred_blocker_score BETWEEN 0 AND 1),
  engagement_score FLOAT,
  silent_witness BOOLEAN DEFAULT FALSE,
  state TEXT NOT NULL DEFAULT 'detected_unverified' CHECK (state IN (
    'detected_unverified','confirmed','dismissed','stale_unverified'
  )),
  ae_confirmation TEXT CHECK (ae_confirmation IN ('not_asked','confirmed','denied','unsure')),
  first_appearance_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  truth_layer TEXT NOT NULL DEFAULT 'inference',
  inference_confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_ecosystem_map TO authenticated;
GRANT ALL ON public.account_ecosystem_map TO service_role;
ALTER TABLE public.account_ecosystem_map ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ecosystem_org_isolated" ON public.account_ecosystem_map;
CREATE POLICY "ecosystem_org_isolated" ON public.account_ecosystem_map
  FOR ALL TO authenticated
  USING (org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- Indexes performance
CREATE INDEX IF NOT EXISTS idx_pattern_matches_deal_status ON public.pattern_matches(deal_id, status);
CREATE INDEX IF NOT EXISTS idx_pattern_matches_org_triggered ON public.pattern_matches(org_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_outcomes_pattern ON public.action_outcomes(pattern_code, outcome);
CREATE INDEX IF NOT EXISTS idx_action_outcomes_org ON public.action_outcomes(org_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_ecosystem_account_state ON public.account_ecosystem_map(account_id, state);
CREATE INDEX IF NOT EXISTS idx_ecosystem_org ON public.account_ecosystem_map(org_id);
CREATE INDEX IF NOT EXISTS idx_external_news_account_relevance ON public.external_news_events(account_id, classified_relevance);
CREATE INDEX IF NOT EXISTS idx_external_people_account ON public.external_people_changes(account_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_compound_signals_deal ON public.compound_signals(deal_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_best_actions_org_status ON public.best_actions_catalog(org_id, status, current_stage);
CREATE INDEX IF NOT EXISTS idx_deal_storyline_deal ON public.deal_storyline(deal_id);
CREATE INDEX IF NOT EXISTS idx_account_storyline_account ON public.account_storyline(account_id);
CREATE INDEX IF NOT EXISTS idx_proposals_org_status ON public.best_action_proposals(org_id, review_status);

-- =====================================================================
-- T3 — TAXONOMIE D106 (ALTER tables existantes)
-- Nouvelles colonnes NULLABLE, sans default contraignant.
-- Aucune régression sur compute-deal-scores (L1 STABLE).
-- =====================================================================

-- deal_signals : dimension D106 + subtype
ALTER TABLE public.deal_signals ADD COLUMN IF NOT EXISTS dimension_d106 TEXT
  CHECK (dimension_d106 IN ('external_context','competitive_context','compelling_event','deal_ecosystem'));
ALTER TABLE public.deal_signals ADD COLUMN IF NOT EXISTS subtype TEXT;

-- deal_scores : 11 champs dérivés D106 (M31-M40 + arme_coverage + external_context_pressure)
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS action_readiness_score FLOAT;          -- M31
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS execution_gap FLOAT;                   -- M32
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS political_risk_score FLOAT;            -- M33
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS differentiation_gap FLOAT;             -- M34
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS vp_coaching_signal TEXT;               -- M35
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS arme_coverage_score FLOAT;             -- nouveau
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS external_context_pressure TEXT
  CHECK (external_context_pressure IN ('none','low','moderate','high','critical'));
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS silence_qualifier TEXT;                -- M36
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS compelling_event_urgency TEXT;         -- M37
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS storyline_narrative TEXT;              -- M39
ALTER TABLE public.deal_scores ADD COLUMN IF NOT EXISTS action_impact_level TEXT
  CHECK (action_impact_level IN ('low','medium','strategic'));                                  -- M40

-- assets : arme_type D106
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS arme_type TEXT
  CHECK (arme_type IN (
    'video_ae','video_exec','booklet','atelier_roi',
    'point_alignement','message_personnalise','action_recherche','standard_asset'
  ));

-- NOTE D120 : pending_external_actions.proposed_by — DESCOPÉ vers 1d.5i-C
-- (table cible non encore tranchée : execution_actions vs nouvelle table).
