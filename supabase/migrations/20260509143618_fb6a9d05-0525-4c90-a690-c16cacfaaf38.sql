-- Phase 4-fix — Procedure note for rotating cron_secret WITHOUT writing
-- the actual value into a committed migration ever again.
--
-- Manual rotation procedure (Ju runs this off-repo when needed):
--   1. Generate a new 64-hex value locally (PowerShell / openssl).
--   2. Update Edge env: CRON_SECRET = <new value>.
--   3. Run in Supabase SQL Editor (NOT a committed migration):
--        UPDATE public.system_config
--           SET value = '<new_64_hex>', updated_at = now()
--         WHERE key = 'cron_secret';
--
-- The previous migration 20260509141005_*.sql committed an in-clear secret;
-- we cannot rewrite git history without breaking remote checkpoints, so the
-- rotation procedure above is the accepted forward path.

DO $$
BEGIN
  RAISE NOTICE 'cron_secret rotation procedure documented (see migration comment).';
END $$;