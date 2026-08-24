-- =============================================================================
-- STEP 39: Atomic OPD Token Number Generation (20260824000004)
-- Scoped per pod_id and per virtual_date to guarantee strictly sequential tokens (T-01, T-02...)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_next_token_number(
    p_virtual_date TEXT,
    p_pod_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
    v_token_number TEXT;
BEGIN
    -- Count total existing appointments for this specific date and pod
    SELECT COUNT(*)
    INTO v_count
    FROM public.appointments
    WHERE (virtual_date = p_virtual_date OR appointment_time::text LIKE (p_virtual_date || '%'))
      AND pod_id = p_pod_id;

    -- Formulate next sequential token
    v_token_number := 'T-' || LPAD((COALESCE(v_count, 0) + 1)::TEXT, 2, '0');

    RETURN v_token_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_next_token_number(TEXT, UUID) TO authenticated, service_role, anon;
