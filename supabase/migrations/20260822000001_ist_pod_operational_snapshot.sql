-- =============================================================================
-- Mediflow: Indian Standard Time (IST, UTC+5:30) Postgres Snapshot Upgrade
-- Enforces Directive 95: Evaluates daily metrics using Indian Standard Time (IST)
-- instead of UTC CURRENT_DATE to eliminate 00:00 - 05:30 AM rollover inaccuracies.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.pod_operational_snapshot()
RETURNS TABLE (
  pod_id                   UUID,
  patients_today           BIGINT,
  encounters_today         BIGINT,
  lab_pending_count        BIGINT,
  lab_completed_today      BIGINT,
  pharmacy_holds_pending   BIGINT,
  revenue_today_gross      NUMERIC,
  revenue_cleared          NUMERIC,
  whatsapp_active_sessions BIGINT,
  entity_count             BIGINT
) AS $$
DECLARE
  v_pod UUID := public.get_user_pod();
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
  RETURN QUERY
  SELECT
    v_pod                                                   AS pod_id,

    -- Patients registered today in this pod (IST Normalized)
    (SELECT COUNT(*) FROM public.patient_registry
     WHERE pod_id = v_pod
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = v_today) AS patients_today,

    -- Encounters submitted today (IST Normalized)
    (SELECT COUNT(*) FROM public.encounters
     WHERE pod_id = v_pod
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = v_today) AS encounters_today,

    -- Lab tests not yet completed
    (SELECT COUNT(*) FROM public.lab_requisitions
     WHERE pod_id = v_pod
       AND status IN ('pending', 'processing', 'collected'))       AS lab_pending_count,

    -- Lab tests completed today (IST Normalized)
    (SELECT COUNT(*) FROM public.lab_requisitions
     WHERE pod_id = v_pod
       AND status = 'completed'
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = v_today) AS lab_completed_today,

    -- Pharmacy holds still in "held" state
    (SELECT COUNT(*) FROM public.inventory_holds ih
     JOIN public.encounters enc ON enc.id = ih.encounter_id
     WHERE enc.pod_id = v_pod
       AND ih.hold_status = 'held')                                AS pharmacy_holds_pending,

    -- Gross revenue from paid invoices today (IST Normalized)
    (SELECT COALESCE(SUM(total_amount), 0)
     FROM public.unified_invoices
     WHERE pod_id = v_pod
       AND payment_status IN ('paid', 'cleared')
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') = v_today) AS revenue_today_gross,

    -- Revenue from invoices in any paid/settled state (cumulative)
    (SELECT COALESCE(SUM(net_payout), 0)
     FROM public.financial_ledgers
     WHERE pod_id = v_pod
       AND payment_status IN ('paid', 'settled'))                  AS revenue_cleared,

    -- Active WhatsApp chat sessions (not IDLE)
    (SELECT COUNT(*) FROM public.whatsapp_sessions
     WHERE pod_id = v_pod
       AND current_state <> 'IDLE')                               AS whatsapp_active_sessions,

    -- Total approved entities in the pod
    (SELECT COUNT(*) FROM public.entities
     WHERE pod_id = v_pod
       AND status = 'approved')                                    AS entity_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.pod_operational_snapshot() IS
  'Real-time operational summary for the authenticated user''s pod in Indian Standard Time (IST, UTC+5:30). '
  'Used by the Doctor Dashboard PodCommandCenter header.';

REVOKE EXECUTE ON FUNCTION public.pod_operational_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pod_operational_snapshot() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.pod_operational_snapshot() TO service_role;
