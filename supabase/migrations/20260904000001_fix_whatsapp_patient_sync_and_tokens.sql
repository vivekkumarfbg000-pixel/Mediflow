-- =============================================================================
-- Migration: 20260904000001_fix_whatsapp_patient_sync_and_tokens.sql
-- 1. Unify atomic monotonic token allocation across appointments & patient_registry
-- 2. Configure REPLICA IDENTITY FULL and supabase_realtime publication for 360° CDC sync
-- =============================================================================

-- Drop old conflicting signatures
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, DATE);
DROP FUNCTION IF EXISTS public.generate_next_token_number(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_next_token_number(TEXT, UUID);
DROP FUNCTION IF EXISTS public.generate_next_token_number(TEXT);
DROP FUNCTION IF EXISTS public.generate_next_token_number();

-- 1. Primary Implementation: (p_pod_id UUID, p_virtual_date TEXT)
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
    p_pod_id UUID DEFAULT NULL,
    p_virtual_date TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_date TEXT := COALESCE(NULLIF(TRIM(p_virtual_date), ''), TO_CHAR(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD'));
    v_pod UUID := COALESCE(p_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::UUID);
    v_max_token INTEGER := 0;
    v_max_appt INTEGER := 0;
    v_max_pat INTEGER := 0;
    v_next_token TEXT;
BEGIN
    -- 1. Scan appointments for the target date and pod
    SELECT COALESCE(MAX(
        CASE
            WHEN token_number ~* '^#?T-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~* '^#?TK-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~ '^[0-9]+$' THEN token_number::INTEGER
            ELSE 0
        END
    ), 0) INTO v_max_appt
    FROM public.appointments
    WHERE (virtual_date = v_date OR appointment_date = v_date OR TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date)
      AND (pod_id = v_pod OR pod_id IS NULL);

    -- 2. Scan patient_registry for the target date and pod (handles Compounder walk-ins)
    SELECT COALESCE(MAX(
        CASE
            WHEN token_number ~* '^#?T-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~* '^#?TK-?[0-9]+' THEN SUBSTRING(token_number FROM '[0-9]+')::INTEGER
            WHEN token_number ~ '^[0-9]+$' THEN token_number::INTEGER
            ELSE 0
        END
    ), 0) INTO v_max_pat
    FROM public.patient_registry
    WHERE (TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date OR TO_CHAR(registered_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') = v_date)
      AND (pod_id = v_pod OR pod_id IS NULL);

    v_max_token := GREATEST(v_max_appt, v_max_pat);
    v_next_token := 'T-' || LPAD((v_max_token + 1)::TEXT, 2, '0');
    RETURN v_next_token;
EXCEPTION WHEN OTHERS THEN
    RETURN 'T-01';
END;
$$;

-- 2. Overload for (p_virtual_date TEXT, p_pod_id UUID) to guarantee zero RPC failure on argument order
CREATE OR REPLACE FUNCTION public.generate_next_token_number(
    p_virtual_date TEXT,
    p_pod_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN public.generate_next_token_number(p_pod_id, p_virtual_date);
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_token_number(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO anon, authenticated, service_role;

-- =============================================================================
-- 3. Configure REPLICA IDENTITY FULL & Publication for 360° Realtime CDC Sync
-- =============================================================================

DO $$
DECLARE
    tbls TEXT[] := ARRAY[
        'appointments',
        'patient_registry',
        'unified_invoices',
        'financial_ledgers',
        'medicine_bills',
        'lab_requisitions',
        'whatsapp_sessions',
        'vitalsync_pool_settlements',
        'clinic_sops',
        'inventory_holds',
        'pathology_reports',
        'saas_invoices',
        'saas_prescriptions',
        'encounters',
        'chronic_care_cohorts'
    ];
    t TEXT;
BEGIN
    -- Ensure publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY tbls LOOP
        -- Check if table exists in public schema
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Set REPLICA IDENTITY FULL so CDC emits complete row state on UPDATE and DELETE
            EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', t);
            
            -- Add table to supabase_realtime publication if not already added
            IF NOT EXISTS (
                SELECT 1 FROM pg_publication_tables 
                WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
            ) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
            END IF;
        END IF;
    END LOOP;
END;
$$;
