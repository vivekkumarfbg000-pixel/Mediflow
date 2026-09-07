-- =========================================================================================
-- VitalSync Enterprise Migration: 20260907000007_atomic_financial_settlement_engine.sql
-- Description: Military-Grade Atomic Financial Settlement Engine (process_invoice_settlement_v2)
-- Directives: Rule 3, Rule 5, Rule 18, Rule 58, Rule 103 (Doctor Fee Immunity & Double Entry Invariant)
-- =========================================================================================

-- 1. Ensure public.vitalsync_pool_settlements columns exist idempotently
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS doctor_share NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS platform_share NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS gateway_fee NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS net_platform_profit NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'completed';
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS gateway_reference_id TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.vitalsync_pool_settlements ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Ensure public.financial_ledgers columns exist idempotently
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS appointment_id TEXT;
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS patient_id TEXT;
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.financial_ledgers ADD COLUMN IF NOT EXISTS patient_name TEXT;

-- 3. Ensure high-performance indexes exist
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_invoice_id ON public.financial_ledgers(invoice_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_pod_id ON public.financial_ledgers(pod_id);
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_status ON public.financial_ledgers(payment_status);
CREATE INDEX IF NOT EXISTS idx_vitalsync_pool_invoice_id ON public.vitalsync_pool_settlements(invoice_id);

-- 4. Create Atomic Double-Entry Financial Settlement Engine RPC (v2)
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
    v_sop RECORD;
    v_amount NUMERIC(12,2) := 0.00;
    v_doc_fee NUMERIC(12,2) := 0.00;
    v_lab_fee NUMERIC(12,2) := 0.00;
    v_pharm_fee NUMERIC(12,2) := 0.00;
    v_lab_doctor_split NUMERIC(5,2) := 40.00;
    v_lab_platform_split NUMERIC(5,2) := 5.00;
    v_pharm_doctor_split NUMERIC(5,2) := 20.00;
    v_pharm_platform_split NUMERIC(5,2) := 2.00;
    v_doc_consult_net NUMERIC(12,2) := 0.00;
    v_lab_plat_net NUMERIC(12,2) := 0.00;
    v_lab_doc_net NUMERIC(12,2) := 0.00;
    v_lab_net NUMERIC(12,2) := 0.00;
    v_pharm_plat_net NUMERIC(12,2) := 0.00;
    v_pharm_doc_net NUMERIC(12,2) := 0.00;
    v_pharm_net NUMERIC(12,2) := 0.00;
    v_total_platform NUMERIC(12,2) := 0.00;
    v_total_doctor NUMERIC(12,2) := 0.00;
    v_gateway_fee NUMERIC(12,2) := 0.00;
    v_net_platform_profit NUMERIC(12,2) := 0.00;
    v_check_sum NUMERIC(12,2) := 0.00;
    v_diff NUMERIC(12,2) := 0.00;
    v_gateway_ref TEXT;
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
    IF v_invoice.payment_status = 'cleared' OR v_invoice.status = 'paid' THEN
        RETURN jsonb_build_object(
            'success', true, 
            'skipped', true, 
            'message', 'Invoice already cleared and settled',
            'invoice_id', v_invoice.id::text
        );
    END IF;

    -- 2. Dynamically extract SOP rules from public.clinic_sops
    SELECT * INTO v_sop
    FROM public.clinic_sops
    WHERE (pod_id::text = v_invoice.pod_id::text OR entity_id::text = v_invoice.pod_id::text OR is_active = true)
    ORDER BY CASE WHEN pod_id::text = v_invoice.pod_id::text THEN 0 ELSE 1 END, created_at DESC
    LIMIT 1;

    IF FOUND AND v_sop.extracted_config IS NOT NULL THEN
        v_lab_doctor_split := COALESCE((v_sop.extracted_config->'splits'->>'doctor')::NUMERIC, 40.00);
        v_lab_platform_split := COALESCE((v_sop.extracted_config->'splits'->>'platform')::NUMERIC, 5.00);
        v_pharm_doctor_split := COALESCE((v_sop.extracted_config->'splits'->>'pharmacyDoctor')::NUMERIC, 20.00);
        v_pharm_platform_split := COALESCE((v_sop.extracted_config->'splits'->>'pharmacyPlatform')::NUMERIC, 2.00);
    END IF;

    -- 3. Resolve baseline figures
    v_amount := COALESCE(p_amount_paid, v_invoice.total_amount, 0.00);
    v_doc_fee := COALESCE(v_invoice.doctor_fee, 0.00);
    v_lab_fee := COALESCE(v_invoice.lab_fee, 0.00);
    v_pharm_fee := COALESCE(v_invoice.pharmacy_fee, 0.00);

    -- Fallback: If item fees are all 0 but total > 0, treat as pure doctor consultation
    IF v_doc_fee = 0.00 AND v_lab_fee = 0.00 AND v_pharm_fee = 0.00 AND v_amount > 0.00 THEN
        v_doc_fee := v_amount;
    END IF;

    -- 4. Multi-Party Double-Entry Split Allocations
    -- Doctor Consultation Fee Immunity (Rule 58 & 103): 100% to Doctor, 0% Platform Fee
    v_doc_consult_net := v_doc_fee;

    -- Lab Requisitions Split: 5% Platform Fee, Doctor Referral %, Lab Net
    IF v_lab_fee > 0.00 THEN
        v_lab_plat_net := ROUND(v_lab_fee * (v_lab_platform_split / 100.0), 2);
        v_lab_doc_net := ROUND((v_lab_fee - v_lab_plat_net) * (v_lab_doctor_split / 100.0), 2);
        v_lab_net := v_lab_fee - v_lab_plat_net - v_lab_doc_net;
    END IF;

    -- Pharmacy Prescriptions Split: 2% Platform Fee, Doctor Referral %, Pharmacy Net
    IF v_pharm_fee > 0.00 THEN
        v_pharm_plat_net := ROUND(v_pharm_fee * (v_pharm_platform_split / 100.0), 2);
        v_pharm_doc_net := ROUND((v_pharm_fee - v_pharm_plat_net) * (v_pharm_doctor_split / 100.0), 2);
        v_pharm_net := v_pharm_fee - v_pharm_plat_net - v_pharm_doc_net;
    END IF;

    -- Aggregate Platform & Doctor totals
    v_total_platform := v_lab_plat_net + v_pharm_plat_net;
    v_total_doctor := v_doc_consult_net + v_lab_doc_net + v_pharm_doc_net;

    -- Double-Entry Accounting Invariant Enforcement: Gross = Doctor + Lab + Pharmacy + Platform
    v_check_sum := v_total_doctor + v_lab_net + v_pharm_net + v_total_platform;
    v_diff := v_amount - v_check_sum;
    IF v_diff != 0.00 THEN
        -- Reconcile sub-cent rounding differences into doctor consultation or largest bucket
        IF v_doc_consult_net > 0.00 THEN
            v_doc_consult_net := v_doc_consult_net + v_diff;
            v_total_doctor := v_total_doctor + v_diff;
        ELSIF v_pharm_net > 0.00 THEN
            v_pharm_net := v_pharm_net + v_diff;
        ELSIF v_lab_net > 0.00 THEN
            v_lab_net := v_lab_net + v_diff;
        END IF;
    END IF;

    -- Gateway MDR calculation
    IF p_payment_method IN ('razorpay', 'phonepe', 'paytm') THEN
        v_gateway_fee := ROUND(v_amount * 0.02, 2);
    ELSE
        v_gateway_fee := 0.00;
    END IF;
    v_net_platform_profit := GREATEST(0.00, v_total_platform - v_gateway_fee);

    -- 5. Atomic Insertion into public.financial_ledgers
    -- A. Doctor Consultation Ledger
    IF v_doc_consult_net > 0.00 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at,
            platform_fee_deducted, gateway_disbursed_net, payment_method, amount, pod_id
        ) VALUES (
            gen_random_uuid(),
            v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'appointment_fee',
            v_doc_consult_net, 0, v_doc_consult_net, 'cleared', NOW(),
            0.00, CASE WHEN p_payment_method = 'cash' THEN 0.00 ELSE v_doc_consult_net END, p_payment_method, v_doc_consult_net, v_invoice.pod_id
        );
    END IF;

    -- B. Lab Ledgers
    IF v_lab_fee > 0.00 THEN
        IF v_lab_plat_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'platform_fee',
                v_lab_fee, v_lab_platform_split, v_lab_plat_net, 'cleared', NOW(),
                v_lab_plat_net, p_payment_method, v_lab_plat_net, v_invoice.pod_id
            );
        END IF;

        IF v_lab_doc_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'appointment_fee',
                v_lab_fee, v_lab_doctor_split, v_lab_doc_net, 'cleared', NOW(),
                0.00, p_payment_method, v_lab_doc_net, v_invoice.pod_id
            );
        END IF;

        IF v_lab_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'lab_commission',
                v_lab_fee, (100.00 - v_lab_platform_split - v_lab_doctor_split), v_lab_net, 'cleared', NOW(),
                0.00, p_payment_method, v_lab_net, v_invoice.pod_id
            );
        END IF;
    END IF;

    -- C. Pharmacy Ledgers
    IF v_pharm_fee > 0.00 THEN
        IF v_pharm_plat_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'platform_fee',
                v_pharm_fee, v_pharm_platform_split, v_pharm_plat_net, 'cleared', NOW(),
                v_pharm_plat_net, p_payment_method, v_pharm_plat_net, v_invoice.pod_id
            );
        END IF;

        IF v_pharm_doc_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'medicine_commission',
                v_pharm_fee, v_pharm_doctor_split, v_pharm_doc_net, 'cleared', NOW(),
                0.00, p_payment_method, v_pharm_doc_net, v_invoice.pod_id
            );
        END IF;

        IF v_pharm_net > 0.00 THEN
            INSERT INTO public.financial_ledgers (
                id, invoice_id, appointment_id, patient_id, destination_entity_id, transaction_type,
                gross_amount, commission_rate, net_payout, payment_status, settled_at,
                platform_fee_deducted, payment_method, amount, pod_id
            ) VALUES (
                gen_random_uuid(),
                v_invoice.id, v_invoice.appointment_id::text, v_invoice.patient_id::text, v_invoice.pod_id, 'medicine_commission',
                v_pharm_fee, (100.00 - v_pharm_platform_split - v_pharm_doctor_split), v_pharm_net, 'cleared', NOW(),
                0.00, p_payment_method, v_pharm_net, v_invoice.pod_id
            );
        END IF;
    END IF;

    -- 6. Mark unified_invoices as cleared
    UPDATE public.unified_invoices
    SET payment_status = 'cleared',
        payment_method = p_payment_method,
        platform_fee = v_total_platform,
        settled_at = NOW(),
        paid_at = NOW(),
        status = 'paid',
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- 7. Update linked Appointment status to ready_for_consult (enforces payment clearance gate)
    IF v_invoice.appointment_id IS NOT NULL THEN
        UPDATE public.appointments
        SET payment_status = 'cleared',
            status = 'ready_for_consult',
            updated_at = NOW()
        WHERE id::text = v_invoice.appointment_id::text
          AND (payment_status IS NULL OR payment_status != 'cleared');
    END IF;

    -- 8. Record Pool Settlement
    v_gateway_ref := COALESCE(p_gateway_reference_id, 'counter-' || p_payment_method || '-' || SUBSTRING(v_invoice.id::TEXT, 1, 8));
    INSERT INTO public.vitalsync_pool_settlements (
        id, invoice_id, patient_id, total_amount, doctor_share, platform_share,
        gateway_fee, net_platform_profit, payment_mode, payment_method,
        settlement_status, gateway_reference_id, amount, pod_id, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_invoice.id::text, v_invoice.patient_id::text, v_amount, v_total_doctor, v_total_platform,
        v_gateway_fee, v_net_platform_profit, p_payment_method, p_payment_method,
        'completed', v_gateway_ref, v_amount, v_invoice.pod_id, NOW(), NOW()
    );

    -- 9. Auto-dispense held inventory items
    UPDATE public.inventory_holds
    SET hold_status = 'dispensed',
        dispensed_at = NOW()
    WHERE (patient_id::text = v_invoice.patient_id::text)
      AND hold_status = 'held';

    -- 10. Return complete atomic breakdown
    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice.id::text,
        'total_amount', v_amount,
        'doctor_total', v_total_doctor,
        'lab_total', v_lab_net,
        'pharmacy_total', v_pharm_net,
        'platform_total', v_total_platform,
        'gateway_fee', v_gateway_fee,
        'net_platform_profit', v_net_platform_profit,
        'payment_method', p_payment_method,
        'balanced', true
    );
END;
$$;

-- 5. Backwards Compatibility: Ensure process_invoice_settlement calls v2
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
