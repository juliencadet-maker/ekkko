
-- ============================================================
-- 1. deal_rooms : 1:N par deal + scope + gate_mode + audit trail
-- ============================================================
ALTER TABLE public.deal_rooms
  DROP CONSTRAINT IF EXISTS deal_rooms_campaign_id_key,
  DROP CONSTRAINT IF EXISTS deal_rooms_campaign_id_unique;

ALTER TABLE public.deal_rooms
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS gate_mode text NOT NULL DEFAULT 'public_no_gate',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS cloned_from_deal_room_id uuid REFERENCES public.deal_rooms(id) ON DELETE SET NULL;

ALTER TABLE public.deal_rooms
  ADD CONSTRAINT chk_deal_rooms_scope CHECK (scope IN ('main','alt','phase','cloned_template','quick_share','archived','executive_loop')),
  ADD CONSTRAINT chk_deal_rooms_gate_mode CHECK (gate_mode IN ('public_no_gate','email_capture','personalized','private_2fa','nda_required')),
  ADD CONSTRAINT chk_deal_rooms_is_primary_only_main CHECK (is_primary = false OR scope = 'main'),
  ADD CONSTRAINT chk_deal_rooms_archived_reason CHECK (archived_reason IS NULL OR archived_reason IN ('won','lost','snoozed','other'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_rooms_primary_per_campaign
  ON public.deal_rooms (campaign_id) WHERE is_primary = true;

-- Drop denormalized cache (table empty, SoT = deal_room_version)
ALTER TABLE public.deal_rooms
  DROP COLUMN IF EXISTS audio_status,
  DROP COLUMN IF EXISTS video_status;

-- ============================================================
-- 2. deal_room_version : layout + voice source
-- ============================================================
ALTER TABLE public.deal_room_version
  ADD COLUMN IF NOT EXISTS layout_mode text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS hero_audio_voice_source text NOT NULL DEFAULT 'generic_b2b_fr';

ALTER TABLE public.deal_room_version
  ADD CONSTRAINT chk_drv_layout CHECK (layout_mode IN ('full','quick_share')),
  ADD CONSTRAINT chk_drv_voice_source CHECK (hero_audio_voice_source IN ('generic_b2b_fr','user_voice','avatar_voice','co_speaker_voice','generic_b2b_en'));

-- ============================================================
-- 3. campaigns : complexity / dimensions / deal_stage
-- ============================================================
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS complexity_level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deal_stage text NOT NULL DEFAULT 'qualifying';

ALTER TABLE public.campaigns
  ADD CONSTRAINT chk_campaigns_complexity_level CHECK (complexity_level BETWEEN 1 AND 3),
  ADD CONSTRAINT chk_campaigns_deal_stage CHECK (deal_stage IN ('qualifying','discovering','demoing','proposing','negotiating','closing','won','lost'));

-- ============================================================
-- 4. deal_contact_roles : RENAME confidence → source_confidence
-- ============================================================
ALTER TABLE public.deal_contact_roles RENAME COLUMN confidence TO source_confidence;

-- ============================================================
-- 5. profiles : ae_onboarding_state + milestones
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ae_onboarding_state text NOT NULL DEFAULT 'bare',
  ADD COLUMN IF NOT EXISTS ae_first_deal_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS ae_first_deal_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS ae_activated_at timestamptz;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_ae_onboarding_state CHECK (ae_onboarding_state IN ('bare','tier_1_voice_captured','tier_2_avatar_created','tier_3_growth_loop_active'));

-- ============================================================
-- 6. effective_deal_layout SQL function
-- ============================================================
CREATE OR REPLACE FUNCTION public.effective_deal_layout(p_campaign_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.deal_room_version drv
      JOIN public.deal_rooms dr ON dr.id = drv.deal_room_id
      WHERE dr.campaign_id = p_campaign_id
        AND dr.is_primary = true
        AND drv.is_active = true
        AND drv.layout_mode = 'quick_share'
    ) THEN 'quick_share'
    WHEN EXISTS (
      SELECT 1 FROM public.deal_rooms
      WHERE campaign_id = p_campaign_id
        AND is_primary = true
        AND scope = 'quick_share'
    ) THEN 'quick_share'
    WHEN EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE id = p_campaign_id
        AND deal_experience_mode IN ('push_only','simple','pull_only')
    ) THEN 'quick_share'
    ELSE 'full'
  END;
$$;

-- ============================================================
-- 7. agent_conversations : drop messages jsonb + ajout colonnes
-- ============================================================
ALTER TABLE public.agent_conversations
  DROP COLUMN IF EXISTS messages;

ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'cockpit',
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- (metadata column déjà existante via context_snapshot? Non, on ajoute metadata distinct)
ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.agent_conversations
  ADD CONSTRAINT chk_ac_surface CHECK (surface IN ('cockpit','deal_compose','prospect_drawer','extension','inbox','slack')),
  ADD CONSTRAINT chk_ac_status CHECK (status IN ('active','archived','closed'));

-- ============================================================
-- 8. agent_messages NEW
-- ============================================================
CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text,
  tool_calls jsonb,
  tool_results jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  surface text NOT NULL CHECK (surface IN ('cockpit','deal_compose','prospect_drawer','extension','inbox','slack')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_messages_conv ON public.agent_messages (conversation_id, created_at);
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their agent_messages"
  ON public.agent_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.agent_conversations ac WHERE ac.id = agent_messages.conversation_id AND ac.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.agent_conversations ac WHERE ac.id = agent_messages.conversation_id AND ac.user_id = auth.uid()));

-- ============================================================
-- 9. agent_memory_l1 NEW
-- ============================================================
CREATE TABLE public.agent_memory_l1 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  deal_room_id uuid,
  kind text NOT NULL CHECK (kind IN ('declarative_signal','llm_summary','ae_input','derived','tool_output')),
  content jsonb NOT NULL,
  source text NOT NULL CHECK (source IN ('llm_summary','ae_input','derived','tool_observation')),
  confidence numeric NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  importance smallint NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aml1_user ON public.agent_memory_l1 (user_id, importance DESC, created_at DESC);
CREATE INDEX idx_aml1_campaign ON public.agent_memory_l1 (campaign_id) WHERE campaign_id IS NOT NULL;
ALTER TABLE public.agent_memory_l1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their agent_memory_l1"
  ON public.agent_memory_l1 FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 10. agent_compose_sessions → agent_voice_compose_sessions
-- ============================================================
ALTER TABLE public.agent_compose_sessions RENAME TO agent_voice_compose_sessions;

-- ============================================================
-- 11. agent_notification_queue NEW
-- ============================================================
CREATE TABLE public.agent_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid NOT NULL,
  campaign_id uuid,
  deal_room_id uuid,
  kind text NOT NULL CHECK (kind IN ('agent_recommendation','coaching_nudge','external_action_pending','system_failure')),
  title text NOT NULL,
  body text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_channels jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','dismissed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX idx_anq_user_status ON public.agent_notification_queue (user_id, status, created_at DESC);
ALTER TABLE public.agent_notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their notif queue"
  ON public.agent_notification_queue FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users update their notif queue"
  ON public.agent_notification_queue FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Authenticated insert notif queue in own org"
  ON public.agent_notification_queue FOR INSERT TO authenticated
  WITH CHECK (org_id = public.get_user_org_id(auth.uid()));

-- ============================================================
-- 12. agent_notification_preferences NEW
-- ============================================================
CREATE TABLE public.agent_notification_preferences (
  user_id uuid PRIMARY KEY,
  channels jsonb NOT NULL DEFAULT '{"inapp": true, "email": false, "slack": false}'::jsonb,
  per_kind jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours_start time DEFAULT '20:00',
  quiet_hours_end time DEFAULT '08:00',
  timezone text DEFAULT 'Europe/Paris',
  daily_digest boolean DEFAULT true,
  daily_digest_time time DEFAULT '08:00',
  max_per_day smallint DEFAULT 5 CHECK (max_per_day BETWEEN 0 AND 20),
  graceful_silence_until timestamptz,
  ignored_streak smallint DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their notif prefs"
  ON public.agent_notification_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 13. pending_external_actions NEW
-- ============================================================
CREATE TABLE public.pending_external_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  deal_room_id uuid,
  action_type text NOT NULL CHECK (action_type IN (
    'change_voice_source','publish_deal_room','send_external_message',
    'send_exec_email','change_gate_mode','clone_deal_room','archive_deal_room'
  )),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_pea_user_status ON public.pending_external_actions (user_id, status, created_at DESC);
CREATE INDEX idx_pea_campaign ON public.pending_external_actions (campaign_id);
ALTER TABLE public.pending_external_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own pending_external_actions"
  ON public.pending_external_actions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 14. user_voice_sources NEW
-- ============================================================
CREATE TABLE public.user_voice_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  voxtral_voice_clone_id text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  label text,
  locale text NOT NULL DEFAULT 'fr',
  is_active boolean NOT NULL DEFAULT true,
  is_org_shareable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_uvs_user ON public.user_voice_sources (user_id);
CREATE UNIQUE INDEX idx_uvs_active_per_user_locale
  ON public.user_voice_sources (user_id, locale) WHERE is_active = true;

ALTER TABLE public.user_voice_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own voice sources"
  ON public.user_voice_sources FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 15. best_practices_library NEW + seed 5
-- ============================================================
CREATE TABLE public.best_practices_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'discovery','qualification','demoing','objection_handling','proposal',
    'negotiation','closing','follow_up','committee_navigation','post_sale'
  )),
  contextual_block_type text,
  contextual_deal_stage text,
  seed_priority smallint NOT NULL DEFAULT 3 CHECK (seed_priority BETWEEN 1 AND 5),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.best_practices_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read best_practices"
  ON public.best_practices_library FOR SELECT TO authenticated USING (true);

INSERT INTO public.best_practices_library (title, body, category, contextual_deal_stage, seed_priority) VALUES
('Objection prix : ancrer ROI 12 mois',
 'Quand le prospect dit "trop cher", reformule en TCO 12 mois et compare au coût d''inaction. Exemple : "Sur 12 mois, vous investissez X€ pour économiser Y€ en process actuel + Z€ d''opportunités captées. ROI net = X mois." Ne défends jamais le prix nominal seul.',
 'objection_handling','negotiating',5),
('Multi-threading : 3 contacts minimum',
 'Un deal mono-threadé tombe à 30% close rate vs 70% avec 3+ contacts. Identifie : le user (impacté quotidien), le sponsor (budget), l''influenceur (technique/légal). Demande explicitement une intro à chacun avec un prétexte de valeur (demo dédiée, partage doc spécifique).',
 'committee_navigation','discovering',5),
('Follow-up silence 7j : signal-driven',
 'Si silence > 7 jours après proposition envoyée : ne relance pas avec "j''espère que vous allez bien". Apporte un signal nouveau : insight marché, cas client similaire, ou question précise issue de votre dernière conversation. Format court < 5 lignes.',
 'follow_up','proposing',4),
('Executive sponsor : qualification 3 questions',
 'Pour confirmer qu''un contact est sponsor exec : 1) Peut-il signer un PO de votre montant sans approbation ? 2) Est-ce dans son top-3 priorités trimestre ? 3) A-t-il déjà sponsorisé un projet similaire ? Si 0 ou 1 oui = pas exec sponsor, c''est un champion. Adapte stratégie.',
 'committee_navigation','qualifying',5),
('Demo prep : 5 min checklist',
 'Avant chaque demo : 1) Re-lis les 2 derniers échanges email/notes 2) Identifie 3 douleurs spécifiques mentionnées 3) Prépare 2 features qui répondent + 1 feature surprise 4) Anticipe 3 objections probables 5) Définis l''next step concret à proposer. Demo générique = signal de désintérêt après.',
 'demoing','demoing',4);

-- ============================================================
-- 16. power_message_templates NEW + seed 5
-- ============================================================
CREATE TABLE public.power_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_key text UNIQUE NOT NULL,
  label text NOT NULL,
  locale text NOT NULL DEFAULT 'fr',
  duration_target_seconds smallint NOT NULL DEFAULT 45,
  with_co_speaker boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  variables_required text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.power_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read power_message_templates"
  ON public.power_message_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.power_message_templates (variant_key, label, locale, duration_target_seconds, with_co_speaker, body, variables_required) VALUES
('short_fr_solo','Court FR solo','fr',30,false,
 'Bonjour [PROSPECT_FIRSTNAME], [AE_FIRSTNAME] de [AE_ORG]. J''ai préparé en 30 secondes pourquoi je vous contacte aujourd''hui. Trois choses : [SIGNAL_1], [SIGNAL_2], [SIGNAL_3]. Voilà pourquoi je vous le montre maintenant.',
 ARRAY['PROSPECT_FIRSTNAME','AE_FIRSTNAME','AE_ORG','SIGNAL_1','SIGNAL_2','SIGNAL_3']),
('long_fr_solo','Long FR solo deal complexe','fr',60,false,
 'Bonjour [PROSPECT_FIRSTNAME], [AE_FIRSTNAME], [AE_FUNCTION] chez [AE_ORG]. J''ai pris 60 secondes pour vous expliquer pourquoi je vous contacte spécifiquement aujourd''hui. Sur les trois derniers mois j''ai observé [SIGNAL_1] dans votre secteur, [SIGNAL_2] côté [PROSPECT_ORG], et [SIGNAL_3] qui change la donne. Voilà pourquoi je vous le montre maintenant — pas dans six mois.',
 ARRAY['PROSPECT_FIRSTNAME','AE_FIRSTNAME','AE_FUNCTION','AE_ORG','PROSPECT_ORG','SIGNAL_1','SIGNAL_2','SIGNAL_3']),
('short_fr_co_speaker','Court FR avec co-speaker exec','fr',35,true,
 'Bonjour [PROSPECT_FIRSTNAME], [CO_SPEAKER_FIRSTNAME] [CO_SPEAKER_FUNCTION] chez [AE_ORG]. J''ai demandé à [AE_FIRSTNAME] de vous préparer ceci. Trois éléments précis : [SIGNAL_1], [SIGNAL_2], [SIGNAL_3]. Je voulais vous le partager personnellement.',
 ARRAY['PROSPECT_FIRSTNAME','CO_SPEAKER_FIRSTNAME','CO_SPEAKER_FUNCTION','AE_FIRSTNAME','AE_ORG','SIGNAL_1','SIGNAL_2','SIGNAL_3']),
('short_en_solo','Short EN solo','en',30,false,
 'Hi [PROSPECT_FIRSTNAME], [AE_FIRSTNAME] from [AE_ORG]. I prepared 30 seconds on why I''m reaching out today. Three things: [SIGNAL_1], [SIGNAL_2], [SIGNAL_3]. That''s why I''m sharing this now.',
 ARRAY['PROSPECT_FIRSTNAME','AE_FIRSTNAME','AE_ORG','SIGNAL_1','SIGNAL_2','SIGNAL_3']),
('long_fr_tech','Long FR contexte tech DAF/DSI','fr',60,false,
 'Bonjour [PROSPECT_FIRSTNAME], [AE_FIRSTNAME], [AE_FUNCTION] chez [AE_ORG]. Je vous contacte sur un contexte précis : [SIGNAL_1] côté [PROSPECT_ORG], [SIGNAL_2] sur votre stack actuel, et [SIGNAL_3] qui crée une fenêtre opérationnelle. Pas un argumentaire générique — un contexte qui appelle une décision documentée d''ici [DECISION_HORIZON].',
 ARRAY['PROSPECT_FIRSTNAME','AE_FIRSTNAME','AE_FUNCTION','AE_ORG','PROSPECT_ORG','SIGNAL_1','SIGNAL_2','SIGNAL_3','DECISION_HORIZON']);

-- ============================================================
-- 17. timeline_events : deal_room_id + index inference_kind
-- ============================================================
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS deal_room_id uuid;

CREATE INDEX IF NOT EXISTS idx_timeline_events_deal_room
  ON public.timeline_events (deal_room_id, created_at DESC) WHERE deal_room_id IS NOT NULL;

-- btree sur expression text scalaire (equality lookups cross-deal patterns)
CREATE INDEX IF NOT EXISTS idx_timeline_events_inference_kind
  ON public.timeline_events ((event_data->>'inference_kind'))
  WHERE event_data ? 'inference_kind';

-- Backfill deal_room_id depuis primary deal_room (deal_rooms vide → no-op safe)
UPDATE public.timeline_events te
   SET deal_room_id = dr.id
  FROM public.deal_rooms dr
 WHERE te.campaign_id IS NOT NULL
   AND te.campaign_id = dr.campaign_id
   AND dr.is_primary = true
   AND te.deal_room_id IS NULL;
