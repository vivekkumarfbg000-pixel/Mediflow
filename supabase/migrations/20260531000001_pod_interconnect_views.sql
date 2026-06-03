
-- Mediflow Connected Care Ecosystem
-- Migration: 20260531000001_pod_interconnect_views.sql
--
-- Purpose: Cross-pod operational views, real-time interconnect helpers,
--          pod health summary RPCs, and realtime broadcast channels.
--          Enables Doctor, Pharmacy, and Lab dashboards to share live
--          operational data within the same pod via Supabase Realtime.
--
-- Depends on: combined_upgrade.sql (all base tables must exist)
-- Run order:  After combined_upgrade.sql
-- Safe to re-run: YES (all statements are idempotent)

-- SECTION 1: Pod Entity Stats View
-- Provides a real-time count of approved entities per pod (Doctor/Pharmacy/Lab).
-- Used by: PodCommandCenter, PharmacyDashboard, LabDashboard Pod Network tabs.

CREATE OR REPLACE VIEW public.pod_daily_stats AS
SELECT
  pod_id,
  COUNT(DISTINCT CASE WHEN entity_type = 'clinic'   THEN id END) AS clinic_count,
  COUNT(DISTINCT CASE WHEN entity_type = 'pharmacy' THEN id END) AS pharmacy_count,
  COUNT(DISTINCT CASE WHEN entity_type = 'lab'      THEN id END) AS lab_count
FROM public.entities
WHERE status = 'approved'
GROUP BY pod_id;

COMMENT ON VIEW public.pod_daily_stats IS
  'Aggregated count of approved pod entity members by type. Refreshes on each query.';

-- Grant read access to authenticated users only
GRANT SELECT ON public.pod_daily_stats TO authenticated;

-- SECTION 2: get_pod_entities() — Cross-Entity Visibility RPC
-- Returns all approved entities in the same pod as the caller.
-- Security: SECURITY DEFINER so RLS is not applied inside the function body,
-- but the caller must be authenticated (enforced by GRANT).

CREATE OR REPLACE FUNCTION public.get_pod_entities(p_pod_id UUID)
RETURNS SETOF public.entities AS $$
  SELECT *
  FROM   public.entities
  WHERE  pod_id = p_pod_id
    AND  status  = 'approved'
  ORDER BY entity_type, name;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_pod_entities(UUID) IS
  'Returns all approved entities that share the given pod_id. '
  'Used by pharmacy and lab dashboards to surface pod partner info.';

REVOKE EXECUTE ON FUNCTION public.get_pod_entities(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_pod_entities(UUID) TO authenticated;

-- SECTION 3: get_my_pod_entities() — Caller-Scoped Shortcut RPC
-- Convenience wrapper: automatically resolves the caller's own pod_id.
-- Dashboards can call this without knowing their pod_id upfront.

CREATE OR REPLACE FUNCTION public.get_my_pod_entities()
RETURNS SETOF public.entities AS $$
  SELECT *
  FROM   public.entities
  WHERE  pod_id = public.get_user_pod()
    AND  status  = 'approved'
  ORDER BY entity_type, name;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.get_my_pod_entities() IS
  'Convenience wrapper around get_pod_entities(). '
  'Automatically resolves the authenticated caller''s pod_id via get_user_pod().';

REVOKE EXECUTE ON FUNCTION public.get_my_pod_entities() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_pod_entities() TO authenticated;

-- SECTION 4: pod_operational_snapshot() — Live Pod Dashboard Feed
-- Returns a single-row operational summary of the caller's pod.
-- This is the data that feeds the "Pod Command Center" header metrics:
--   - Today's patients registered
--   - Active lab requisitions (pending + processing)
--   - Pending pharmacy holds
--   - Total revenue today (paid invoices)
--   - WhatsApp active sessions

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
  v_today DATE := CURRENT_DATE;
BEGIN
  RETURN QUERY
  SELECT
    v_pod                                                   AS pod_id,

    -- Patients registered today in this pod
    (SELECT COUNT(*) FROM public.patient_registry
     WHERE pod_id = v_pod
       AND DATE(created_at) = v_today)                      AS patients_today,

    -- Encounters submitted today
    (SELECT COUNT(*) FROM public.encounters
     WHERE pod_id = v_pod
       AND DATE(created_at) = v_today)                      AS encounters_today,

    -- Lab tests not yet completed
    (SELECT COUNT(*) FROM public.lab_requisitions
     WHERE pod_id = v_pod
       AND status IN ('pending', 'processing', 'collected')) AS lab_pending_count,

    -- Lab tests completed today
    (SELECT COUNT(*) FROM public.lab_requisitions
     WHERE pod_id = v_pod
       AND status = 'completed'
       AND DATE(created_at) = v_today)                      AS lab_completed_today,

    -- Pharmacy holds still in "held" state
    (SELECT COUNT(*) FROM public.inventory_holds ih
     JOIN public.encounters enc ON enc.id = ih.encounter_id
     WHERE enc.pod_id = v_pod
       AND ih.hold_status = 'held')                         AS pharmacy_holds_pending,

    -- Gross revenue from paid invoices today
    (SELECT COALESCE(SUM(total_amount), 0)
     FROM public.unified_invoices
     WHERE pod_id = v_pod
       AND payment_status = 'paid'
       AND DATE(created_at) = v_today)                      AS revenue_today_gross,

    -- Revenue from invoices in any paid/settled state (cumulative)
    (SELECT COALESCE(SUM(net_payout), 0)
     FROM public.financial_ledgers
     WHERE pod_id = v_pod
       AND payment_status IN ('paid', 'settled'))            AS revenue_cleared,

    -- Active WhatsApp chat sessions (not IDLE)
    (SELECT COUNT(*) FROM public.whatsapp_sessions
     WHERE pod_id = v_pod
       AND current_state <> 'IDLE')                         AS whatsapp_active_sessions,

    -- Total approved entities in the pod
    (SELECT COUNT(*) FROM public.entities
     WHERE pod_id = v_pod
       AND status = 'approved')                              AS entity_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.pod_operational_snapshot() IS
  'Real-time operational summary for the authenticated user''s pod. '
  'Used by the Doctor Dashboard PodCommandCenter header.';

REVOKE EXECUTE ON FUNCTION public.pod_operational_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pod_operational_snapshot() TO authenticated;

-- SECTION 5: pod_prescription_queue() — Pharmacy Cross-Entity View
-- Used by the Pharmacy Pod Interconnect tab to display the doctor's
-- active prescription queue without direct table access violations.
-- Returns encounters with medications from the same pod.

CREATE OR REPLACE FUNCTION public.pod_prescription_queue(p_pod_id UUID DEFAULT NULL)
RETURNS TABLE (
  encounter_id    UUID,
  patient_name    TEXT,
  patient_phone   TEXT,
  created_at      TIMESTAMPTZ,
  medications     JSONB,
  encounter_status TEXT
) AS $$
DECLARE
  v_pod UUID := COALESCE(p_pod_id, public.get_user_pod());
BEGIN
  RETURN QUERY
  SELECT
    enc.id                                  AS encounter_id,
    pr.name                                 AS patient_name,
    pr.phone                                AS patient_phone,
    enc.created_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'medicineName', em.medicine_name,
                'dosage',       em.dosage,
                'frequency',    em.frequency,
                'duration',     em.duration
              ))
       FROM public.encounter_medications em
       WHERE em.encounter_id = enc.id),
      '[]'::jsonb
    )                                       AS medications,
    enc.status                              AS encounter_status
  FROM  public.encounters enc
  JOIN  public.patient_registry pr ON pr.id = enc.patient_id
  WHERE enc.pod_id = v_pod
    AND enc.status  = 'completed'
  ORDER BY enc.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.pod_prescription_queue(UUID) IS
  'Returns the recent prescription queue for all completed encounters in the pod. '
  'Pharmacy dashboard uses this for the Pod Interconnect tab.';

REVOKE EXECUTE ON FUNCTION public.pod_prescription_queue(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pod_prescription_queue(UUID) TO authenticated;

-- SECTION 6: pod_lab_requisition_queue() — Lab Cross-Entity View
-- Used by the Lab Pod Network tab to display doctor-ordered tests.

CREATE OR REPLACE FUNCTION public.pod_lab_requisition_queue(p_pod_id UUID DEFAULT NULL)
RETURNS TABLE (
  requisition_id   UUID,
  patient_name     TEXT,
  patient_phone    TEXT,
  test_name        TEXT,
  loinc_code       TEXT,
  barcode          TEXT,
  status           TEXT,
  is_walkin        BOOLEAN,
  created_at       TIMESTAMPTZ
) AS $$
DECLARE
  v_pod UUID := COALESCE(p_pod_id, public.get_user_pod());
BEGIN
  RETURN QUERY
  SELECT
    lr.id           AS requisition_id,
    pr.name         AS patient_name,
    pr.phone        AS patient_phone,
    lr.test_name,
    lr.loinc_code,
    lr.barcode,
    lr.status,
    lr.is_walkin,
    lr.created_at
  FROM  public.lab_requisitions lr
  JOIN  public.patient_registry pr ON pr.id = lr.patient_id
  WHERE lr.pod_id = v_pod
  ORDER BY lr.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.pod_lab_requisition_queue(UUID) IS
  'Returns lab requisitions for the pod with patient details. '
  'Used by the Lab dashboard Pod Network tab.';

REVOKE EXECUTE ON FUNCTION public.pod_lab_requisition_queue(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pod_lab_requisition_queue(UUID) TO authenticated;

-- SECTION 7: pod_settlement_summary() — Settlement Overview Per Entity
-- Used by Pharmacy and Lab "Settlements" tabs.
-- Returns per-entity financial ledger summary for the authenticated user's pod.

CREATE OR REPLACE FUNCTION public.pod_settlement_summary(p_entity_id UUID)
RETURNS TABLE (
  total_gross      NUMERIC,
  total_net_payout NUMERIC,
  total_pending    NUMERIC,
  total_paid       NUMERIC,
  last_settled_at  TIMESTAMPTZ,
  transaction_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(fl.gross_amount),  0)                           AS total_gross,
    COALESCE(SUM(fl.net_payout),    0)                           AS total_net_payout,
    COALESCE(SUM(CASE WHEN fl.payment_status = 'pending'
                      THEN fl.net_payout ELSE 0 END), 0)         AS total_pending,
    COALESCE(SUM(CASE WHEN fl.payment_status IN ('paid','settled')
                      THEN fl.net_payout ELSE 0 END), 0)         AS total_paid,
    MAX(fl.settled_at)                                           AS last_settled_at,
    COUNT(*)                                                     AS transaction_count
  FROM public.financial_ledgers fl
  WHERE fl.destination_entity_id = p_entity_id
    AND fl.pod_id = public.get_user_pod();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.pod_settlement_summary(UUID) IS
  'Aggregated financial settlement summary for a given entity in the caller''s pod.';

REVOKE EXECUTE ON FUNCTION public.pod_settlement_summary(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.pod_settlement_summary(UUID) TO authenticated;

-- SECTION 8: Patient Consent Flag (ensure patient_consents table exists)
-- Required by whatsapp-dispatch Edge Function consent gate.

CREATE TABLE IF NOT EXISTS public.patient_consents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id   UUID NOT NULL REFERENCES public.patient_registry(id) ON DELETE CASCADE,
  pod_id       UUID NOT NULL REFERENCES public.pods(id) ON DELETE CASCADE,
  whatsapp_opt_in   BOOLEAN DEFAULT TRUE,
  sms_opt_in        BOOLEAN DEFAULT TRUE,
  data_sharing_consent BOOLEAN DEFAULT TRUE,
  consented_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS pod_id UUID REFERENCES public.pods(id) ON DELETE CASCADE
  DEFAULT 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001';

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT TRUE;

ALTER TABLE public.patient_consents
  ADD COLUMN IF NOT EXISTS data_sharing_consent BOOLEAN DEFAULT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_consents_patient_pod
  ON public.patient_consents(patient_id, pod_id);

ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "pod_consent_isolation" ON public.patient_consents';
  EXECUTE 'CREATE POLICY "pod_consent_isolation"
    ON public.patient_consents FOR ALL TO authenticated
    USING (pod_id = public.get_user_pod())
    WITH CHECK (pod_id = public.get_user_pod())';
END $$;

GRANT SELECT, INSERT, UPDATE ON public.patient_consents TO authenticated;
GRANT ALL ON public.patient_consents TO service_role;

-- SECTION 9: financial_ledgers settled_at column (required by settlement summary)

ALTER TABLE public.financial_ledgers
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

ALTER TABLE public.financial_ledgers
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Index for fast settlement queries per entity
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_dest_entity
  ON public.financial_ledgers(destination_entity_id);

CREATE INDEX IF NOT EXISTS idx_financial_ledgers_pod_status
  ON public.financial_ledgers(pod_id, payment_status);

-- SECTION 10: unified_invoices — ensure payment_status column is consistent

ALTER TABLE public.unified_invoices
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'unpaid';

-- Backfill: map old "status" values to "payment_status"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'unified_invoices'
      AND column_name  = 'status'
  ) THEN
    EXECUTE 'UPDATE public.unified_invoices
             SET payment_status = status
             WHERE payment_status IS NULL OR payment_status = ''unpaid''';
  END IF;
END $$;

-- Index for webhook lookups by payment_status
CREATE INDEX IF NOT EXISTS idx_unified_invoices_payment_status
  ON public.unified_invoices(payment_status);

-- SECTION 11: Realtime Publication — enable cross-entity live sync
-- Adds the key tables to the Supabase Realtime publication so dashboards
-- receive instant push updates without polling.

DO $$
BEGIN
  -- Add tables to the supabase_realtime publication (idempotent via try/catch)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.encounters;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_requisitions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_holds;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.unified_invoices;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.entities;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- SECTION 12: Performance Indexes for Pod Interconnect Queries

-- Fast patient lookup by pod
CREATE INDEX IF NOT EXISTS idx_patient_registry_pod_created
  ON public.patient_registry(pod_id, created_at DESC);

-- Fast encounter lookup by pod and status
CREATE INDEX IF NOT EXISTS idx_encounters_pod_status
  ON public.encounters(pod_id, status, created_at DESC);

-- Fast lab req lookup by pod and status
CREATE INDEX IF NOT EXISTS idx_lab_requisitions_pod_status
  ON public.lab_requisitions(pod_id, status, created_at DESC);

-- Fast invoice lookup by pod and payment
CREATE INDEX IF NOT EXISTS idx_unified_invoices_pod_payment
  ON public.unified_invoices(pod_id, payment_status, created_at DESC);

-- Fast WhatsApp session lookup by pod
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_pod_state
  ON public.whatsapp_sessions(pod_id, current_state);

-- Fast entity type lookup (for pod_daily_stats view)
CREATE INDEX IF NOT EXISTS idx_entities_pod_status_type
  ON public.entities(pod_id, status, entity_type);

-- SECTION 13: Verification Queries
-- Uncomment and run to confirm migration applied successfully.

-- SELECT * FROM public.pod_daily_stats;
-- SELECT * FROM public.get_my_pod_entities();
-- SELECT * FROM public.pod_operational_snapshot();
-- SELECT * FROM public.pod_prescription_queue();
-- SELECT * FROM public.pod_lab_requisition_queue();
-- SELECT public.check_rate_limit('127.0.0.1', 15, 60);

-- END OF MIGRATION: 20260531000001_pod_interconnect_views.sql
