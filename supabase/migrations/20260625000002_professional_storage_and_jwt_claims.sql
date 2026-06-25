DROP POLICY IF EXISTS "prescriptions_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "prescriptions_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "prescriptions_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "lab_reports_update_policy" ON storage.objects;

CREATE POLICY "prescriptions_upload_policy" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'prescriptions' AND (
        (substring(name from '^rx_([^_]+)_') IN (
            SELECT id::text FROM public.patient_registry WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE POLICY "prescriptions_select_policy" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'prescriptions' AND (
        (substring(name from '^rx_([^_]+)_') IN (
            SELECT id::text FROM public.patient_registry WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE POLICY "prescriptions_update_policy" ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'prescriptions' AND (
        (substring(name from '^rx_([^_]+)_') IN (
            SELECT id::text FROM public.patient_registry WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE POLICY "lab_reports_upload_policy" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'lab-reports' AND (
        (substring(name from '^report_([^_]+)_') IN (
            SELECT id::text FROM public.lab_requisitions WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE POLICY "lab_reports_select_policy" ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'lab-reports' AND (
        (substring(name from '^report_([^_]+)_') IN (
            SELECT id::text FROM public.lab_requisitions WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE POLICY "lab_reports_update_policy" ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'lab-reports' AND (
        (substring(name from '^report_([^_]+)_') IN (
            SELECT id::text FROM public.lab_requisitions WHERE pod_id = public.get_user_pod()
        )) OR public.is_platform_admin()
    )
);

CREATE OR REPLACE FUNCTION public.sync_profile_pod_to_jwt_metadata()
RETURNS TRIGGER AS $$
DECLARE
    v_pod_id UUID;
BEGIN
    SELECT pod_id INTO v_pod_id FROM public.entities WHERE id = NEW.entity_id LIMIT 1;
    IF v_pod_id IS NOT NULL THEN
        UPDATE auth.users 
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('pod_id', v_pod_id)
        WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp;

DROP TRIGGER IF EXISTS trg_sync_profile_pod_to_jwt ON public.profiles;
CREATE TRIGGER trg_sync_profile_pod_to_jwt
    AFTER INSERT OR UPDATE OF entity_id ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_profile_pod_to_jwt_metadata();
