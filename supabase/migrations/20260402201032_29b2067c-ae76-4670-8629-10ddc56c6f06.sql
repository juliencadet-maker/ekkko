
-- =============================================
-- SESSION A1 — 15 nouvelles tables + 2 ALTER
-- =============================================

-- 1. TABLE accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  normalized_name text,
  domain text,
  account_domain_group text,
  created_from text DEFAULT 'deal_creation',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid() AND is_active = true));

-- 2. TABLE deal_assets
CREATE TABLE IF NOT EXISTS public.deal_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  parent_asset_id uuid REFERENCES public.deal_assets(id) NULL,
  version_number int DEFAULT 1,
  asset_type text NOT NULL,
  asset_purpose text NOT NULL,
  asset_status text DEFAULT 'valid',
  asset_hash text NULL,
  file_url text,
  tracked_links jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_assets_type_check CHECK (asset_type IN ('video','document','link')),
  CONSTRAINT deal_assets_purpose_check CHECK (asset_purpose IN ('intro','pricing','technical','legal','closing','followup'))
);
ALTER TABLE public.deal_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access deal_assets" ON public.deal_assets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_assets.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 3. TABLE asset_deliveries
CREATE TABLE IF NOT EXISTS public.asset_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.deal_assets(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  delivery_token text UNIQUE NOT NULL,
  sent_at timestamptz,
  intended_contact_id uuid NULL,
  share_mode text DEFAULT 'direct',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access asset_deliveries" ON public.asset_deliveries
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = asset_deliveries.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 4. TABLE asset_page_events
CREATE TABLE IF NOT EXISTS public.asset_page_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.deal_assets(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  viewer_id uuid REFERENCES public.viewers(id) NULL,
  identity_cluster_id uuid NULL,
  event_hash text UNIQUE,
  page_number int,
  time_spent_seconds int DEFAULT 0,
  max_scroll_pct int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_page_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access asset_page_events" ON public.asset_page_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = asset_page_events.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 5. TABLE deal_contact_roles
CREATE TABLE IF NOT EXISTS public.deal_contact_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  identity_cluster_id uuid NULL,
  viewer_id uuid REFERENCES public.viewers(id) NULL,
  role text DEFAULT 'unknown',
  layer text NULL,
  confidence float DEFAULT 0.5,
  source text DEFAULT 'inferred',
  insight_reasons jsonb DEFAULT '[]'::jsonb,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dcr_role_check CHECK (role IN ('sponsor','influencer','blocker','unknown')),
  CONSTRAINT dcr_layer_check CHECK (layer IN ('executive','financial','legal','procurement','technical','operational')),
  CONSTRAINT dcr_source_check CHECK (source IN ('observed','inferred','declared'))
);
ALTER TABLE public.deal_contact_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access deal_contact_roles" ON public.deal_contact_roles
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_contact_roles.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 6. TABLE agent_context
CREATE TABLE IF NOT EXISTS public.agent_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE NOT NULL,
  stage text,
  crm_stage text,
  motion_type text,
  decision_structure text,
  decision_window date NULL,
  committee_size_declared int NULL,
  key_contacts jsonb DEFAULT '[]'::jsonb,
  incumbent_present bool DEFAULT false,
  incumbent_type text DEFAULT 'unknown',
  competitive_situation text DEFAULT 'greenfield',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ac_incumbent_check CHECK (incumbent_type IN ('internal_tool','competitor_named','unknown')),
  CONSTRAINT ac_competitive_check CHECK (competitive_situation IN ('greenfield','replacement','competitive_run'))
);
ALTER TABLE public.agent_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access agent_context" ON public.agent_context
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = agent_context.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 7. TABLE deal_rooms
CREATE TABLE IF NOT EXISTS public.deal_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE NOT NULL,
  slug text UNIQUE,
  is_public bool DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deal_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access deal_rooms" ON public.deal_rooms
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_rooms.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 8. TABLE timeline_events
CREATE TABLE IF NOT EXISTS public.timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  event_layer text DEFAULT 'fact',
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  identity_cluster_id uuid NULL,
  viewer_id uuid REFERENCES public.viewers(id) NULL,
  asset_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT te_layer_check CHECK (event_layer IN ('fact','inference','declared'))
);
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access timeline_events" ON public.timeline_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = timeline_events.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 9. TABLE deal_triggers
CREATE TABLE IF NOT EXISTS public.deal_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  trigger_type text NOT NULL,
  priority_score float DEFAULT 0,
  owner_type text NOT NULL DEFAULT 'ae',
  message_what text,
  message_why text,
  message_action text,
  delivered_at timestamptz NULL,
  acted_on_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dt_trigger_check CHECK (trigger_type IN ('signal','time','event')),
  CONSTRAINT dt_owner_check CHECK (owner_type IN ('ae','manager','exec','admin'))
);
ALTER TABLE public.deal_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access deal_triggers" ON public.deal_triggers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_triggers.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 10. TABLE execution_actions
CREATE TABLE IF NOT EXISTS public.execution_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id uuid REFERENCES public.deal_triggers(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL,
  execution_token text UNIQUE NOT NULL,
  guardrail_status text DEFAULT 'safe',
  executed_at timestamptz NULL,
  executed_from text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ea_guardrail_check CHECK (guardrail_status IN ('safe','warning','blocked'))
);
ALTER TABLE public.execution_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access execution_actions" ON public.execution_actions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.deal_triggers dt
    JOIN public.campaigns c ON c.id = dt.campaign_id
    WHERE dt.id = execution_actions.trigger_id AND c.org_id = get_user_org_id(auth.uid())
  ));

-- 11. TABLE deal_permissions
CREATE TABLE IF NOT EXISTS public.deal_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'contributor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id),
  CONSTRAINT dp_role_check CHECK (role IN ('owner','contributor','viewer'))
);
ALTER TABLE public.deal_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access deal_permissions" ON public.deal_permissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE campaigns.id = deal_permissions.campaign_id AND campaigns.org_id = get_user_org_id(auth.uid())));

-- 12. TABLE system_failures
CREATE TABLE IF NOT EXISTS public.system_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL NULL,
  failure_type text NOT NULL,
  severity text DEFAULT 'low',
  message text NOT NULL,
  ui_message text,
  reason text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  CONSTRAINT sf_type_check CHECK (failure_type IN ('tracking','inference','execution','data','bot_filter','inference_error')),
  CONSTRAINT sf_severity_check CHECK (severity IN ('low','medium','high'))
);
ALTER TABLE public.system_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins can view system_failures" ON public.system_failures
  FOR SELECT TO authenticated
  USING (
    campaign_id IS NULL OR EXISTS (
      SELECT 1 FROM public.campaigns c
      JOIN public.org_memberships m ON m.org_id = c.org_id
      WHERE c.id = system_failures.campaign_id
        AND m.user_id = auth.uid()
        AND m.is_active = true
        AND m.role IN ('org_owner','org_admin')
    )
  );
CREATE POLICY "System can insert system_failures" ON public.system_failures
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 13. TABLE committee_layers
CREATE TABLE IF NOT EXISTS public.committee_layers (
  layer text PRIMARY KEY,
  level text NOT NULL,
  expected_weight float NOT NULL,
  typical_titles text[],
  asset_affinity text[]
);
ALTER TABLE public.committee_layers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read committee_layers" ON public.committee_layers
  FOR SELECT USING (true);

INSERT INTO public.committee_layers (layer, level, expected_weight, typical_titles, asset_affinity) VALUES
  ('executive','comex',1.0,ARRAY['CEO','CFO','COO','DG','PDG'],ARRAY['intro','closing']),
  ('financial','codir',0.90,ARRAY['DAF','CFO','Contrôleur'],ARRAY['pricing','legal']),
  ('legal','codir',0.85,ARRAY['Juridique','DPO'],ARRAY['legal','closing']),
  ('procurement','codir',0.80,ARRAY['Achats','Procurement'],ARRAY['pricing','technical']),
  ('technical','coproj',0.75,ARRAY['DSI','CTO','Architecte'],ARRAY['technical']),
  ('operational','coproj',0.55,ARRAY['Chef projet','Manager'],ARRAY['intro','followup'])
ON CONFLICT (layer) DO NOTHING;

-- 14. TABLE churn_signals
CREATE TABLE IF NOT EXISTS public.churn_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  risk_level text NOT NULL,
  signal_type text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  action_taken text NULL,
  resolved_at timestamptz NULL,
  CONSTRAINT cs_risk_check CHECK (risk_level IN ('high','medium','low')),
  CONSTRAINT cs_signal_check CHECK (signal_type IN ('no_assets','false_insights','low_action_rate'))
);
ALTER TABLE public.churn_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org admins can access churn_signals" ON public.churn_signals
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_memberships
    WHERE org_memberships.org_id = churn_signals.org_id
      AND org_memberships.user_id = auth.uid()
      AND org_memberships.is_active = true
      AND org_memberships.role IN ('org_owner','org_admin')
  ));

-- 15. TABLE sales_calibration_profile
CREATE TABLE IF NOT EXISTS public.sales_calibration_profile (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  initial_hypothesis jsonb DEFAULT '{}'::jsonb,
  declared_profile jsonb DEFAULT '{}'::jsonb,
  observed_profile jsonb DEFAULT '{}'::jsonb,
  active_profile text DEFAULT 'declared',
  calibration_confidence float DEFAULT 0.2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sales_calibration_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can access sales_calibration_profile" ON public.sales_calibration_profile
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid() AND is_active = true));

-- 16. AJOUT sur table orgs
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS feature_flags jsonb DEFAULT '{"ff_deal_first_ui":true,"ff_trigger_system":false,"ff_truth_system":false,"ff_deal_room":false,"ff_document_tracking":false,"ff_proof_system":false,"ff_privacy_strict":false}'::jsonb;

-- 17. AJOUT sur table campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deal_status text DEFAULT 'draft';
-- Use a trigger for validation instead of CHECK constraint (immutable requirement)
CREATE OR REPLACE FUNCTION public.validate_deal_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.deal_status IS NOT NULL AND NEW.deal_status NOT IN ('draft','active','observing','snoozed','closed') THEN
    RAISE EXCEPTION 'Invalid deal_status: %', NEW.deal_status;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_deal_status ON public.campaigns;
CREATE TRIGGER trg_validate_deal_status BEFORE INSERT OR UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_deal_status();
