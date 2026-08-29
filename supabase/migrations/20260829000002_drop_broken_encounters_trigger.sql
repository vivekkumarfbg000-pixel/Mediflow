-- ===========================================================================
-- Migration: Drop broken Postgres trigger on encounters table
-- Ticket: encounterService.ts Bug #2 (status='active' bypass workaround)
-- Date: 2026-08-29
--
-- CONTEXT:
--   The `encounters` table has a Postgres trigger that fires AFTER INSERT
--   and attempts to call a deprecated stored procedure, throwing an exception
--   that rolls back the entire transaction. The workaround (inserting with
--   status='active') prevents the trigger from firing but is fragile.
--
-- RESOLUTION:
--   Drop all known candidates for the broken trigger (idempotent IF EXISTS).
--   After deploying this migration, encounterService.ts can be updated to
--   insert with status='completed' directly.
--
-- IDEMPOTENCY: All statements use IF EXISTS — safe to run multiple times.
-- ===========================================================================

-- Drop all known / possible names for the broken trigger
DROP TRIGGER IF EXISTS on_encounter_completed ON encounters;
DROP TRIGGER IF EXISTS trigger_encounter_on_insert ON encounters;
DROP TRIGGER IF EXISTS encounter_status_trigger ON encounters;
DROP TRIGGER IF EXISTS encounter_insert_trigger ON encounters;
DROP TRIGGER IF EXISTS after_encounter_insert ON encounters;
DROP TRIGGER IF EXISTS trg_encounter_completed ON encounters;

-- Verify what triggers remain (log-only, no side effects)
DO $$
DECLARE
  remaining_triggers TEXT;
BEGIN
  SELECT string_agg(trigger_name, ', ' ORDER BY trigger_name)
  INTO remaining_triggers
  FROM information_schema.triggers
  WHERE event_object_table = 'encounters'
    AND trigger_schema = 'public';

  IF remaining_triggers IS NOT NULL THEN
    RAISE NOTICE '[Migration] Remaining triggers on encounters: %', remaining_triggers;
  ELSE
    RAISE NOTICE '[Migration] No triggers remaining on encounters table — clean state confirmed.';
  END IF;
END;
$$;
