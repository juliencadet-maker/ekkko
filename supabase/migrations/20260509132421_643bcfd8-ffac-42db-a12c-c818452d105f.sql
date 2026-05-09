BEGIN;

-- 1.1 Native audit columns on timeline_events
ALTER TABLE public.timeline_events
  ADD COLUMN IF NOT EXISTS actor_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS logged_via    text NULL,
  ADD COLUMN IF NOT EXISTS org_id        uuid NULL;

-- 1.2 Backfill from event_data._audit (Phase 2 events)
UPDATE public.timeline_events
   SET actor_user_id = COALESCE(actor_user_id, NULLIF(event_data->'_audit'->>'actor_user_id','')::uuid),
       logged_via    = COALESCE(logged_via,    event_data->'_audit'->>'logged_via'),
       org_id        = COALESCE(org_id,        NULLIF(event_data->'_audit'->>'org_id','')::uuid)
 WHERE event_data ? '_audit';

-- 1.3 Cleanup _audit from jsonb after backfill
UPDATE public.timeline_events
   SET event_data = event_data - '_audit'
 WHERE event_data ? '_audit';

-- 1.4 Native indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_timeline_events_actor_user_id
  ON public.timeline_events (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_timeline_events_logged_via
  ON public.timeline_events (logged_via, created_at DESC)
  WHERE logged_via IS NOT NULL;

-- 1.5 UNIQUE constraint on agent_conversations(campaign_id, user_id) — guarded
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'agent_conversations_campaign_user_uniq'
      AND conrelid = 'public.agent_conversations'::regclass
  ) THEN
    ALTER TABLE public.agent_conversations
      ADD CONSTRAINT agent_conversations_campaign_user_uniq
      UNIQUE (campaign_id, user_id);
  END IF;
END $$;

COMMIT;