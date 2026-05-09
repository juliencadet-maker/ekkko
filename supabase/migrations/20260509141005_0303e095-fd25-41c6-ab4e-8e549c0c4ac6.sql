-- ============================================================
-- Phase 4 (1d.5h) — Pending actions foundation + notif realtime
-- Idempotent, safe to re-run.
-- ============================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- 2. pending_external_actions: add org_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='pending_external_actions' AND column_name='org_id'
  ) THEN
    ALTER TABLE public.pending_external_actions ADD COLUMN org_id uuid;
  END IF;
END $$;

-- Backfill org_id from campaigns
UPDATE public.pending_external_actions p
   SET org_id = c.org_id
  FROM public.campaigns c
 WHERE p.campaign_id = c.id
   AND p.org_id IS NULL;

-- Force NOT NULL once backfill is done (only if no remaining NULLs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pending_external_actions WHERE org_id IS NULL) THEN
    ALTER TABLE public.pending_external_actions ALTER COLUMN org_id SET NOT NULL;
  END IF;
END $$;

-- Index for org-scoped lookups
CREATE INDEX IF NOT EXISTS idx_pea_org_status
  ON public.pending_external_actions (org_id, status, created_at DESC);

-- Partial unique index: at most one LIVE pending action per (user, campaign, action_type)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pea_live_pending
  ON public.pending_external_actions (user_id, campaign_id, action_type)
  WHERE status = 'pending';

-- RLS policies refresh: user_id == auth.uid AND org_id == get_user_org_id(auth.uid)
DROP POLICY IF EXISTS "Users manage own pending_external_actions" ON public.pending_external_actions;
CREATE POLICY "Users read own pending_external_actions"
  ON public.pending_external_actions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND org_id = public.get_user_org_id(auth.uid()));
CREATE POLICY "Users update own pending_external_actions"
  ON public.pending_external_actions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND org_id = public.get_user_org_id(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND org_id = public.get_user_org_id(auth.uid()));
-- INSERT/DELETE only via edge functions (service role).

-- 3. agent_notification_queue : ALTER PUBLICATION (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public'
       AND tablename='agent_notification_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_notification_queue';
  END IF;
END $$;
ALTER TABLE public.agent_notification_queue REPLICA IDENTITY FULL;

-- Same for pending_external_actions (so AgentPage can react to status changes live)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime'
       AND schemaname='public'
       AND tablename='pending_external_actions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_external_actions';
  END IF;
END $$;
ALTER TABLE public.pending_external_actions REPLICA IDENTITY FULL;

-- 4. system_config : insert cron_secret (idempotent)
INSERT INTO public.system_config (key, value, description)
VALUES (
  'cron_secret',
  '084e85e16efd539f2ce45d8c46e84f7e6b9cb5e9b3f9246defe83f55ed1c0335',
  'Shared bearer token for pg_cron → edge function calls. Mirrored in CRON_SECRET env.'
)
ON CONFLICT (key) DO NOTHING;

-- 5. pg_cron job — every 5 min, expire stale pending actions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'pending_actions_expire_5min') THEN
    PERFORM cron.unschedule('pending_actions_expire_5min');
  END IF;

  PERFORM cron.schedule(
    'pending_actions_expire_5min',
    '*/5 * * * *',
    $cron$
    SELECT extensions.http_post(
      url := 'https://kqpbsznldzrklnnbqtwq.supabase.co/functions/v1/pending-action-expire-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM public.system_config WHERE key = 'cron_secret')
      ),
      body := '{}'::jsonb
    );
    $cron$
  );
END $$;