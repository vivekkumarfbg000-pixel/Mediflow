-- Migration: walkin_lab_and_pod_health
-- Adds walk-in lab test support and doctor admin pod health view

-- 1. Mark walk-in lab requisitions distinctly
-- encounter_id is NULL for walk-in; we add a flag for clarity in reporting
ALTER TABLE public.lab_requisitions
  ADD COLUMN IF NOT EXISTS is_walkin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walkin_fee DECIMAL(10,2) DEFAULT 0.00;

-- 2. Auto-set is_walkin flag based on NULL encounter_id
CREATE OR REPLACE FUNCTION public.set_walkin_flag()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.encounter_id IS NULL THEN
    NEW.is_walkin := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_walkin_flag ON public.lab_requisitions;
CREATE TRIGGER tr_set_walkin_flag
  BEFORE INSERT ON public.lab_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.set_walkin_flag();

-- 3. Pod Health Snapshots Table (for Doctor Admin God View)
-- Captures a rolling window of cross-pod activity metrics for the doctor's overview
CREATE TABLE IF NOT EXISTS public.pod_health_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id        UUID REFERENCES public.pods(id) ON DELETE CASCADE,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Lab metrics
  lab_pending_count   INT DEFAULT 0,
  lab_completed_today INT DEFAULT 0,
  reagent_low_count   INT DEFAULT 0,

  -- Pharmacy metrics
  pharmacy_holds_pending   INT DEFAULT 0,
  pharmacy_low_stock_count INT DEFAULT 0,

  -- Revenue metrics
  revenue_today_gross  DECIMAL(10,2) DEFAULT 0.00,
  revenue_cleared      DECIMAL(10,2) DEFAULT 0.00,
  revenue_pending      DECIMAL(10,2) DEFAULT 0.00,

  -- Patient flow metrics
  patients_registered_today INT DEFAULT 0,
  encounters_today          INT DEFAULT 0,
  whatsapp_active_sessions  INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Index for fast latest-snapshot queries per pod
CREATE INDEX IF NOT EXISTS idx_pod_health_snapshots_pod_at
  ON public.pod_health_snapshots (pod_id, snapshot_at DESC);

-- 5. RLS: Doctors can read all pod health data (admin view)
ALTER TABLE public.pod_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pod_health_doctor_read"
  ON public.pod_health_snapshots FOR SELECT
  USING (
    pod_id = public.get_user_pod()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'platform_admin'
    )
  );

-- 6. Lab requisitions: Doctors can read all records (cross-pod admin view)
-- Drop existing restrictive policies if any, then create doctor-permissive policy
DO $$
BEGIN
  -- Allow doctors to read all lab requisitions in their pod
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lab_requisitions' AND policyname = 'doctor_read_all_lab_reqs'
  ) THEN
    CREATE POLICY "doctor_read_all_lab_reqs"
      ON public.lab_requisitions FOR SELECT
      USING (
        pod_id = public.get_user_pod()
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.role = 'platform_admin'
        )
      );
  END IF;
END $$;

-- 7. Walk-in fee revenue tracking: Insert into financial_ledgers when walk-in completes
CREATE OR REPLACE FUNCTION public.on_walkin_lab_completed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_pod_id UUID;
  v_lab_entity_id UUID;
  v_platform_entity_id UUID;
  v_fee DECIMAL(10,2);
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.is_walkin = true THEN
    v_fee := COALESCE(NEW.walkin_fee, 0);

    -- Get pod context from assigned_technician's entity
    SELECT e.pod_id, e.id INTO v_pod_id, v_lab_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'pathology_lab'
    LIMIT 1;

    SELECT e.id INTO v_platform_entity_id
    FROM public.entities e
    WHERE e.entity_type = 'platform'
    LIMIT 1;

    -- Record lab fee and platform commission
    IF v_fee > 0 THEN
      INSERT INTO public.financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id,
        transaction_type, gross_amount, commission_rate, net_payout, payment_status
      ) VALUES
        (NULL, v_lab_entity_id, v_lab_entity_id, 'lab_commission', v_fee, 3, v_fee * 0.97, 'pending'),
        (NULL, v_lab_entity_id, v_platform_entity_id, 'platform_fee', v_fee, 3, v_fee * 0.03, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_walkin_lab_completed ON public.lab_requisitions;
CREATE TRIGGER tr_walkin_lab_completed
  AFTER UPDATE ON public.lab_requisitions
  FOR EACH ROW EXECUTE FUNCTION public.on_walkin_lab_completed();
