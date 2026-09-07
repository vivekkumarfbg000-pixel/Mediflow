-- ==============================================================================
-- Migration: 20260908000001_realtime_inventory_and_reagents.sql
-- Description: Enforce REPLICA IDENTITY FULL on pharmacy_inventory and reagent_inventory
--              and idempotently add them to the 'supabase_realtime' publication
--              for complete 360-degree real-time inventory and supply mesh sync.
-- ==============================================================================

-- 1. Enforce REPLICA IDENTITY FULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'pharmacy_inventory'
  ) THEN
    ALTER TABLE public.pharmacy_inventory REPLICA IDENTITY FULL;
    RAISE NOTICE 'Set REPLICA IDENTITY FULL on public.pharmacy_inventory';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'reagent_inventory'
  ) THEN
    ALTER TABLE public.reagent_inventory REPLICA IDENTITY FULL;
    RAISE NOTICE 'Set REPLICA IDENTITY FULL on public.reagent_inventory';
  END IF;
END $$;

-- 2. Idempotently add both tables to supabase_realtime publication
DO $$
DECLARE
  pub_exists boolean;
  t text;
  target_tables text[] := ARRAY['pharmacy_inventory', 'reagent_inventory'];
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  
  IF pub_exists THEN
    FOREACH t IN ARRAY target_tables LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM pg_publication_tables 
          WHERE pubname = 'supabase_realtime' 
            AND schemaname = 'public' 
            AND tablename = t
        ) THEN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
          RAISE NOTICE 'Added public.% to publication supabase_realtime', t;
        ELSE
          RAISE NOTICE 'public.% is already registered in supabase_realtime', t;
        END IF;
      END IF;
    END LOOP;
  ELSE
    RAISE WARNING 'Publication supabase_realtime does not exist yet. Please enable Supabase Realtime in dashboard.';
  END IF;
END $$;
