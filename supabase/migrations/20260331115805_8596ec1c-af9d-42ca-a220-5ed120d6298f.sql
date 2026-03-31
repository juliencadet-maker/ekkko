
-- Colonnes ajoutées à deal_scores pour risk indicator, priority et scoring
ALTER TABLE deal_scores
  ADD COLUMN IF NOT EXISTS risk_level TEXT
    CHECK (risk_level IN ('healthy', 'watch', 'critical')),
  ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS days_since_last_signal INTEGER,
  ADD COLUMN IF NOT EXISTS confidence_level TEXT
    CHECK (confidence_level IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS recommended_action_v2 JSONB;

-- Index pour tri rapide par priority
CREATE INDEX IF NOT EXISTS deal_scores_priority_idx
  ON deal_scores(campaign_id, priority_score DESC);

-- Colonnes ajoutées à viewers pour le scoring de contact
ALTER TABLE viewers
  ADD COLUMN IF NOT EXISTS inferred_role TEXT
    CHECK (inferred_role IN ('decision_maker','influencer','champion','blocker','unknown')),
  ADD COLUMN IF NOT EXISTS role_confidence FLOAT,
  ADD COLUMN IF NOT EXISTS last_signal_type TEXT,
  ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ;

-- Nouvelle table : signaux bruts avec couche sémantique
CREATE TABLE IF NOT EXISTS deal_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id),
  signal_type TEXT NOT NULL,
  signal_layer TEXT NOT NULL
    CHECK (signal_layer IN ('event', 'inference', 'recommendation')),
  raw_data JSONB,
  interpretation TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS sur deal_signals
ALTER TABLE deal_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_signals_org_access" ON deal_signals
  FOR ALL USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND is_active = true
  ));

-- Nouvelle table : contradictions détectées
CREATE TABLE IF NOT EXISTS deal_contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  org_id UUID REFERENCES orgs(id),
  contradiction_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  signal_a TEXT,
  signal_b TEXT,
  is_active BOOLEAN DEFAULT true,
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(campaign_id, contradiction_id)
);

-- RLS sur deal_contradictions
ALTER TABLE deal_contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_contradictions_org_access" ON deal_contradictions
  FOR ALL USING (org_id IN (
    SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE INDEX IF NOT EXISTS deal_contradictions_campaign_idx
  ON deal_contradictions(campaign_id, is_active);
