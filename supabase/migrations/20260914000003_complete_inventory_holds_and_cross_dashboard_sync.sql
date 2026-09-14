-- ==============================================================================
-- Migration: 20260914000003_complete_inventory_holds_and_cross_dashboard_sync.sql
-- Description: Enterprise-Grade 360° Realtime Sync Parity for Inventory Holds:
--              1. Idempotently add missing columns on public.inventory_holds
--              2. Ensure REPLICA IDENTITY FULL
--              3. Ensure publication in supabase_realtime
--              4. Ensure permissive RLS read/write policies for public roles
-- ==============================================================================

-- 1. Ensure columns exist on public.inventory_holds
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventory_holds'
  ) THEN
    ALTER TABLE public.inventory_holds 
      ADD COLUMN IF NOT EXISTS encounter_id UUID,
      ADD COLUMN IF NOT EXISTS patient_id UUID,
      ADD COLUMN IF NOT EXISTS pharmacy_entity_id UUID,
      ADD COLUMN IF NOT EXISTS medicine_name TEXT,
      ADD COLUMN IF NOT EXISTS dosage TEXT,
      ADD COLUMN IF NOT EXISTS batch_number TEXT,
      ADD COLUMN IF NOT EXISTS expiry_date DATE,
      ADD COLUMN IF NOT EXISTS hold_status TEXT DEFAULT 'held',
      ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'tablets',
      ADD COLUMN IF NOT EXISTS dispensed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
    RAISE NOTICE 'Aligned columns on public.inventory_holds';
  END IF;
END $$;

-- 2. Enforce REPLICA IDENTITY FULL
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventory_holds'
  ) THEN
    ALTER TABLE public.inventory_holds REPLICA IDENTITY FULL;
    RAISE NOTICE 'Enforced REPLICA IDENTITY FULL on public.inventory_holds';
  END IF;
END $$;

-- 3. Idempotently register inventory_holds in supabase_realtime publication
DO $$
DECLARE
  pub_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
  IF NOT pub_exists THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventory_holds'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'inventory_holds'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_holds;
      RAISE NOTICE 'Added public.inventory_holds to supabase_realtime publication';
    END IF;
  END IF;
END $$;

-- 4. Ensure permissive RLS read/write policies for inventory_holds
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'inventory_holds'
  ) THEN
    ALTER TABLE public.inventory_holds ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow public read on inventory_holds" ON public.inventory_holds;
    CREATE POLICY "Allow public read on inventory_holds" ON public.inventory_holds
      FOR SELECT TO public USING (true);

    DROP POLICY IF EXISTS "Allow public write on inventory_holds" ON public.inventory_holds;
    CREATE POLICY "Allow public write on inventory_holds" ON public.inventory_holds
      FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END $$;
