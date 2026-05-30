-- ============================================================
-- Mediflow Production Cleanup — v1.0
-- Drops all testing junk columns from the pods table that were
-- accumulated during development sandbox iterations.
-- This restores the pods table to its correct clean schema.
-- ============================================================

ALTER TABLE public.pods
  DROP COLUMN IF EXISTS dummy_col_1780163528161,
  DROP COLUMN IF EXISTS dummy_col_1780163732102,
  DROP COLUMN IF EXISTS dummy_col_final,
  DROP COLUMN IF EXISTS dummy_col_1780164065359,
  DROP COLUMN IF EXISTS dummy_col_1780165946680,
  DROP COLUMN IF EXISTS drop_col_610083,
  DROP COLUMN IF EXISTS drop_col_214941,
  DROP COLUMN IF EXISTS drop_col_529497,
  DROP COLUMN IF EXISTS drop_col_137212,
  DROP COLUMN IF EXISTS seed_col_670601,
  DROP COLUMN IF EXISTS seed_col_992401,
  DROP COLUMN IF EXISTS count_col_244539,
  DROP COLUMN IF EXISTS count_col_866400,
  DROP COLUMN IF EXISTS trig_col_558032,
  DROP COLUMN IF EXISTS trig_col_576812,
  DROP COLUMN IF EXISTS const_col_328742,
  DROP COLUMN IF EXISTS const_col_396658,
  DROP COLUMN IF EXISTS const_col_387828,
  DROP COLUMN IF EXISTS trg_fix_126150,
  DROP COLUMN IF EXISTS col_165987;

-- Verify: pods table should now have exactly these columns:
-- id, name, location, is_active, created_at, clinic_code

DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'pods' AND table_schema = 'public';

  RAISE NOTICE 'pods table now has % columns (expected: 6)', col_count;
END $$;
