-- ==============================================================================
-- PHASE 27: COMPLETE ERADICATION OF LEGACY COMMISSION SPLITS & COMMISSION POOLS
-- 100% Legal Practo Ray / HIS Hospital Single-Bucket ERP Model (NMC §6.4 & RBI PSS Act)
-- ==============================================================================

-- 1. Ensure pods table defaults to 0.00% platform fee and clean columns
ALTER TABLE IF EXISTS public.pods 
  ALTER COLUMN platform_fee_percent SET DEFAULT 0.00;

UPDATE public.pods 
SET platform_fee_percent = 0.00,
    pending_cash_balance = 0.00
WHERE platform_fee_percent > 0.00 OR pending_cash_balance != 0.00;

-- 2. Permanently replace process_invoice_settlement_v2 with 100% Direct Clinic Settlement
-- Zero platform cuts, Zero kickbacks, Zero vitalsync_pool_settlements insertions.
DROP FUNCTION IF EXISTS public.process_invoice_settlement_v2(TEXT, TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_invoice_settlement_v2(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.process_invoice_settlement_v2(
    p_invoice_id TEXT,
    p_payment_method TEXT DEFAULT 'upi',
    p_amount_paid NUMERIC DEFAULT NULL,
    p_gateway_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_amount NUMERIC(12,2) := 0.00;
    v_doc_fee NUMERIC(12,2) := 0.00;
    v_lab_fee NUMERIC(12,2) := 0.00;
    v_pharm_fee NUMERIC(12,2) := 0.00;
    v_pod_id UUID;
    v_patient_id UUID;
BEGIN
    -- 1. Strict row-level lock on unified_invoices to eliminate race conditions
    SELECT * INTO v_invoice
    FROM public.unified_invoices
    WHERE id::text = p_invoice_id OR id::text LIKE (p_invoice_id || '%')
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found: ' || p_invoice_id);
    END IF;

    -- Idempotent bypass if already cleared
    IF v_invoice.payment_status = 'cleared' OR v_invoice.payment_status = 'paid' THEN
        RETURN jsonb_build_object(
            'success', true, 
            'skipped', true, 
            'message', 'Invoice already cleared and settled at clinic counter',
            'invoice_id', v_invoice.id::text
        );
    END IF;

    -- 2. Resolve baseline figures
    v_amount := COALESCE(p_amount_paid, v_invoice.total_amount, 0.00);
    v_doc_fee := COALESCE(v_invoice.doctor_fee, 0.00);
    v_lab_fee := COALESCE(v_invoice.lab_fee, 0.00);
    v_pharm_fee := COALESCE(v_invoice.pharmacy_fee, 0.00);

    -- Fallback: If departmental fees are all 0 but total > 0, treat as pure doctor consultation
    IF v_doc_fee = 0.00 AND v_lab_fee = 0.00 AND v_pharm_fee = 0.00 AND v_amount > 0.00 THEN
        v_doc_fee := v_amount;
    END IF;

    -- Safe pod ID and patient ID casting
    BEGIN
        v_pod_id := v_invoice.pod_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_pod_id := 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid;
    END;

    BEGIN
        v_patient_id := v_invoice.patient_id::uuid;
    EXCEPTION WHEN OTHERS THEN
        v_patient_id := NULL;
    END;

    -- 3. Atomic Insertion into public.financial_ledgers as Pure Clinic Bookkeeping (0% Platform Fee)
    -- A. Doctor Consultation Ledger (100% Direct Clinic Retention)
    IF v_doc_fee > 0.00 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, patient_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at,
            platform_fee_deducted, payment_method, amount, pod_id
        ) VALUES (
            gen_random_uuid(),
            v_invoice.id, v_patient_id, NULL, 'appointment_fee',
            v_doc_fee, 0.00, v_doc_fee, 'cleared', NOW(),
            0.00, p_payment_method, v_doc_fee, v_pod_id
        );
    END IF;

    -- B. Lab Diagnostic Ledger (100% Direct Clinic Retention - 0% Platform Fee)
    IF v_lab_fee > 0.00 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, patient_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at,
            platform_fee_deducted, payment_method, amount, pod_id
        ) VALUES (
            gen_random_uuid(),
            v_invoice.id, v_patient_id, NULL, 'lab_diagnostic',
            v_lab_fee, 0.00, v_lab_fee, 'cleared', NOW(),
            0.00, p_payment_method, v_lab_fee, v_pod_id
        );
    END IF;

    -- C. Pharmacy Dispensation Ledger (100% Direct Clinic Retention - 0% Platform Fee)
    IF v_pharm_fee > 0.00 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, patient_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at,
            platform_fee_deducted, payment_method, amount, pod_id
        ) VALUES (
            gen_random_uuid(),
            v_invoice.id, v_patient_id, NULL, 'pharmacy_dispensation',
            v_pharm_fee, 0.00, v_pharm_fee, 'cleared', NOW(),
            0.00, p_payment_method, v_pharm_fee, v_pod_id
        );
    END IF;

    -- 4. Mark unified_invoices as cleared at clinic counter with 0 platform fee
    UPDATE public.unified_invoices
    SET payment_status = 'cleared',
        status = 'paid',
        payment_method = p_payment_method,
        payment_mode = 'counter_direct',
        billing_model = 'hospital_single_bucket',
        platform_fee = 0.00,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- 5. Mark associated appointment as confirmed if pending
    IF v_invoice.encounter_id IS NOT NULL THEN
        UPDATE public.appointments
        SET status = 'confirmed',
            updated_at = NOW()
        WHERE id::text = v_invoice.encounter_id::text AND status = 'pending_payment';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice.id::text,
        'amount_settled', v_amount,
        'doctor_fee', v_doc_fee,
        'lab_fee', v_lab_fee,
        'pharmacy_fee', v_pharm_fee,
        'platform_fee', 0.00,
        'billing_model', 'hospital_single_bucket',
        'payment_mode', 'counter_direct',
        'status', 'cleared'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_invoice_settlement_v2(TEXT, TEXT, NUMERIC, TEXT) TO authenticated, anon, service_role;

-- Backwards Compatibility Alias: Ensure legacy callers to process_invoice_settlement resolve cleanly to v2
CREATE OR REPLACE FUNCTION public.process_invoice_settlement(
    p_invoice_id TEXT,
    p_payment_method TEXT DEFAULT 'upi',
    p_amount_paid NUMERIC DEFAULT NULL,
    p_gateway_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.process_invoice_settlement_v2(p_invoice_id, p_payment_method, p_amount_paid, p_gateway_reference_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO authenticated, anon, service_role;

-- 3. Permanently neuter accumulate_platform_revenue into safe no-op
DROP FUNCTION IF EXISTS public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.accumulate_platform_revenue(UUID, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.accumulate_platform_revenue(
    p_pod_id UUID, 
    p_amount NUMERIC, 
    p_is_cash BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
BEGIN
    -- Practo Model Invariant: Zero platform revenue cuts on clinical transactions
    RETURN jsonb_build_object('success', true, 'platform_fee', 0.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.accumulate_platform_revenue(UUID, NUMERIC, BOOLEAN) TO authenticated, anon, service_role;

-- 4. Permanently neuter debit_commission_pool into safe no-op
DROP FUNCTION IF EXISTS public.debit_commission_pool(UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.debit_commission_pool(UUID, NUMERIC, TEXT, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.debit_commission_pool(
    p_pod_id UUID, 
    p_amount NUMERIC,
    p_reason TEXT DEFAULT 'legacy_fee',
    p_reference_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
    -- Practo Model Invariant: Zero commission pool debits
    RETURN jsonb_build_object('success', true, 'pool_balance', 0.00, 'debited', 0.00);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.debit_commission_pool(UUID, NUMERIC, TEXT, UUID) TO authenticated, anon, service_role;
