-- Phase 0 : Ajout events produit à l'enum audit_event_type
-- Idempotent : IF NOT EXISTS dans DO $$ block

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'audit_event_type'
    AND e.enumlabel = 'link_generated'
  ) THEN
    ALTER TYPE public.audit_event_type ADD VALUE 'link_generated';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'audit_event_type'
    AND e.enumlabel = 'extension_opened'
  ) THEN
    ALTER TYPE public.audit_event_type ADD VALUE 'extension_opened';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'audit_event_type'
    AND e.enumlabel = 'landing_opened'
  ) THEN
    ALTER TYPE public.audit_event_type ADD VALUE 'landing_opened';
  END IF;
END$$;