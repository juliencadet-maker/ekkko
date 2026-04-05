
ALTER TABLE execution_actions
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id),
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_ae_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS acted_on_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS guardrail_reason TEXT,
  ADD COLUMN IF NOT EXISTS asset_id UUID,
  ADD COLUMN IF NOT EXISTS executed_by TEXT;

ALTER TABLE agent_context
  ADD COLUMN IF NOT EXISTS next_meeting_at TIMESTAMPTZ;

COMMENT ON COLUMN execution_actions.asset_id IS 'Asset concerné par l''action — utilisé par G5 pour bloquer uniquement cet asset';
COMMENT ON COLUMN execution_actions.executed_by IS 'Acteur : ae | agent | system. V1.5 = ae uniquement.';
COMMENT ON COLUMN execution_actions.executed_from IS 'Surface : app | extension | email | slack | mobile';
COMMENT ON COLUMN execution_actions.contact_email IS 'Email du contact cible (prospect). Distinct de token_ae_email (AE owner).';
