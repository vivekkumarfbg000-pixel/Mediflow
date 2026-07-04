-- Migration: Add secure clinic code validation RPC
-- Creates a security definer function allowing guests (anon) to validate a clinic code
-- without exposing all clinic codes via public table SELECT privileges.

CREATE OR REPLACE FUNCTION public.validate_clinic_code(p_code TEXT)
RETURNS TEXT AS $$
DECLARE
    v_name TEXT;
BEGIN
    SELECT name INTO v_name
    FROM public.pods
    WHERE clinic_code = upper(trim(p_code)) AND is_active = TRUE;
    
    RETURN v_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution privileges to anonymous and authenticated roles
REVOKE EXECUTE ON FUNCTION public.validate_clinic_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_clinic_code(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.validate_clinic_code(TEXT) IS
    'Validates a clinic network invite code anonymously and returns the clinic name if valid.';