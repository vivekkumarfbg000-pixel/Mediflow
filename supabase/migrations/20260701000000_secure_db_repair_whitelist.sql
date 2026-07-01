-- Migration: Secure Database Healer Whitelist Validation
-- Drops the old open-ended function and re-creates it with strict input whitelisting,
-- allowing execution privileges to be safely re-granted to authenticated users.

DROP FUNCTION IF EXISTS public.execute_autonomous_db_repair(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.execute_autonomous_db_repair(p_table TEXT, p_column TEXT, p_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_clean_type TEXT;
    v_is_whitelisted BOOLEAN := FALSE;
BEGIN
    -- Normalize the column type for comparison by removing whitespace, quotes, and converting to lowercase
    v_clean_type := lower(replace(replace(replace(p_type, ' ', ''), '''', ''), '"', ''));

    -- Whitelist validation to prevent arbitrary SQL/DDL injections
    IF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'vitals' AND v_clean_type = 'jsonb') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'token_number' AND v_clean_type = 'text') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'patient_registry' AND lower(p_column) = 'queue_status' AND (v_clean_type = 'textdefaultawaiting_vitals' OR v_clean_type = 'textdefaultawaiting_vitals::text')) THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'whatsapp_sessions' AND lower(p_column) = 'auto_healed_flag' AND v_clean_type = 'booleandefaulttrue') THEN
        v_is_whitelisted := TRUE;
    ELSIF (lower(p_table) = 'system_health_telemetry' AND lower(p_column) = 'updated_at' AND (v_clean_type = 'timestamptzdefaultnow()' OR v_clean_type = 'timestamptzdefaultcurrent_timestamp')) THEN
        v_is_whitelisted := TRUE;
    END IF;

    IF NOT v_is_whitelisted THEN
        RAISE EXCEPTION 'Security Threat Blocked: Unauthorized database repair parameters: table=%, column=%, type=%. Parameters do not match safe schema manifest whitelists.', p_table, p_column, p_type;
    END IF;

    -- Verify the table exists in public schema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = p_table AND table_schema = 'public') THEN
        -- Add the missing column if it does not exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = p_table AND column_name = p_column) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', p_table, p_column, p_type);
            RETURN TRUE;
        END IF;
    END IF;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revoke from public, but grant execute permission back to authenticated users safely now that the function is whitelisted
REVOKE EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.execute_autonomous_db_repair(TEXT, TEXT, TEXT) IS
    'Hardened autonomous database repair helper. Whitelist-protected to prevent SQL/DDL injection. Safely executable by authenticated users.';
