-- Migration: Auto-set pod_id on patient_registry insert using get_user_pod()
-- This ensures RLS policy compliance without requiring frontend changes

DROP TRIGGER IF EXISTS trg_patient_registry_set_pod_id ON public.patient_registry;

CREATE OR REPLACE FUNCTION public.fn_set_patient_pod_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Set pod_id from JWT claims if not explicitly provided
    IF NEW.pod_id IS NULL THEN
        NEW.pod_id := public.get_user_pod();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER trg_patient_registry_set_pod_id
    BEFORE INSERT ON public.patient_registry
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_patient_pod_id();

-- Also ensure the default is set correctly as fallback
ALTER TABLE public.patient_registry ALTER COLUMN pod_id SET DEFAULT public.get_user_pod();