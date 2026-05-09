ALTER TABLE public.agent_conversations
  ALTER COLUMN campaign_id DROP NOT NULL;

ALTER TABLE public.agent_conversations
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'deal'
    CHECK (scope IN ('deal','portfolio'));

CREATE INDEX IF NOT EXISTS idx_agent_conversations_user_scope
  ON public.agent_conversations(user_id, scope)
  WHERE status = 'active';