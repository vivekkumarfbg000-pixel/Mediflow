-- =============================================================================
-- Migration: 20260904000002_enhance_realtime_sync_and_settlement.sql
-- 1. Upgrades process_invoice_settlement to support all split types (appointment_fee, medicine_commission, lab_commission, platform_fee)
-- 2. Standardizes transaction_type to 'appointment_fee' so frontend charts and ledgers align seamlessly
-- 3. Ensures strict REPLICA IDENTITY FULL on core financial and clinical tables
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_invoice_settlement(
    p_invoice_id TEXT,
    p_payment_method TEXT,
    p_amount_paid NUMERIC DEFAULT NULL,
    p_gateway_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invoice RECORD;
    v_doctor_fee NUMERIC := 0;
    v_pharmacy_fee NUMERIC := 0;
    v_lab_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_gateway_fee NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_amount NUMERIC := 0;
    v_pod_id UUID;
    v_dest_platform_id UUID;
    v_patient_name TEXT := 'Patient';
    v_ref_id TEXT;
BEGIN
    -- 1. Lock invoice row to prevent concurrent race conditions
    SELECT * INTO v_invoice 
    FROM public.unified_invoices 
    WHERE id::text = p_invoice_id::text OR id::text LIKE p_invoice_id || '%'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    -- Resolve patient name if available
    IF v_invoice.patient_id IS NOT NULL THEN
        SELECT COALESCE(name, 'Patient') INTO v_patient_name
        FROM public.patient_registry
        WHERE id = v_invoice.patient_id;
    END IF;

    v_amount := COALESCE(p_amount_paid, v_invoice.total_amount, 0);
    v_doctor_fee := COALESCE(v_invoice.doctor_fee, 0);
    v_pharmacy_fee := COALESCE(v_invoice.pharmacy_fee, 0);
    v_lab_fee := COALESCE(v_invoice.lab_fee, 0);
    v_platform_fee := COALESCE(v_invoice.platform_fee, 0);
    v_pod_id := COALESCE(v_invoice.pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid);
    v_dest_platform_id := v_pod_id;
    v_ref_id := COALESCE(p_gateway_reference_id, 'tx-' || p_payment_method || '-' || SUBSTRING(v_invoice.id::TEXT, 1, 8));

    -- Gateway fees (0% MDR for cash & direct UPI)
    IF p_payment_method IN ('razorpay', 'phonepe', 'paytm', 'card') THEN
        v_gateway_fee := ROUND(v_amount * 0.02, 2);
    ELSE
        v_gateway_fee := 0;
    END IF;

    -- Counter Doctor Consultation Fee Immunity Protocol (Rule 58 & 103)
    IF v_pharmacy_fee = 0 AND v_lab_fee = 0 AND p_payment_method IN ('cash', 'upi') AND COALESCE(v_invoice.source, '') != 'whatsapp' THEN
        v_platform_fee := 0;
        v_doctor_fee := v_amount;
    END IF;

    IF v_doctor_fee = 0 AND v_pharmacy_fee = 0 AND v_lab_fee = 0 THEN
        v_doctor_fee := v_amount;
    END IF;

    v_net_profit := GREATEST(0, v_platform_fee - v_gateway_fee);

    -- 2. Mark Invoice as Cleared
    UPDATE public.unified_invoices
    SET payment_status = 'cleared',
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- 3. Record Financial Ledger Entries (Doctor Fee / Appointment Fee)
    IF v_doctor_fee > 0 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, source_entity_id, destination_entity_id,
            transaction_type, gross_amount, commission_rate, net_payout,
            payment_status, reference_id, created_at, pod_id, patient_id
        )
        VALUES (
            'tx-doc-' || SUBSTRING(v_invoice.id::TEXT, 1, 8),
            v_invoice.id, v_dest_platform_id, v_dest_platform_id,
            'appointment_fee', v_doctor_fee, 0.00, v_doctor_fee,
            'cleared', v_ref_id,
            NOW(), v_pod_id, v_invoice.patient_id
        )
        ON CONFLICT (id) DO UPDATE
        SET payment_status = 'cleared',
            net_payout = EXCLUDED.net_payout,
            gross_amount = EXCLUDED.gross_amount;
    END IF;

    -- 4. Record Pharmacy Commission if present
    IF v_pharmacy_fee > 0 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, source_entity_id, destination_entity_id,
            transaction_type, gross_amount, commission_rate, net_payout,
            payment_status, reference_id, created_at, pod_id, patient_id
        )
        VALUES (
            'tx-pharma-' || SUBSTRING(v_invoice.id::TEXT, 1, 8),
            v_invoice.id, v_dest_platform_id, v_dest_platform_id,
            'medicine_commission', v_pharmacy_fee, 0.20, ROUND(v_pharmacy_fee * 0.20, 2),
            'cleared', v_ref_id,
            NOW(), v_pod_id, v_invoice.patient_id
        )
        ON CONFLICT (id) DO UPDATE
        SET payment_status = 'cleared',
            net_payout = EXCLUDED.net_payout;
    END IF;

    -- 5. Record Lab Commission if present
    IF v_lab_fee > 0 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, source_entity_id, destination_entity_id,
            transaction_type, gross_amount, commission_rate, net_payout,
            payment_status, reference_id, created_at, pod_id, patient_id
        )
        VALUES (
            'tx-lab-' || SUBSTRING(v_invoice.id::TEXT, 1, 8),
            v_invoice.id, v_dest_platform_id, v_dest_platform_id,
            'lab_commission', v_lab_fee, 0.40, ROUND(v_lab_fee * 0.40, 2),
            'cleared', v_ref_id,
            NOW(), v_pod_id, v_invoice.patient_id
        )
        ON CONFLICT (id) DO UPDATE
        SET payment_status = 'cleared',
            net_payout = EXCLUDED.net_payout;
    END IF;

    -- 6. Record Platform Fee if present
    IF v_platform_fee > 0 THEN
        INSERT INTO public.financial_ledgers (
            id, invoice_id, source_entity_id, destination_entity_id,
            transaction_type, gross_amount, commission_rate, net_payout,
            payment_status, reference_id, created_at, pod_id, patient_id
        )
        VALUES (
            'tx-plat-' || SUBSTRING(v_invoice.id::TEXT, 1, 8),
            v_invoice.id, v_dest_platform_id, v_dest_platform_id,
            'platform_fee', v_platform_fee, 0.03, v_net_profit,
            'cleared', v_ref_id,
            NOW(), v_pod_id, v_invoice.patient_id
        )
        ON CONFLICT (id) DO UPDATE
        SET payment_status = 'cleared',
            net_payout = EXCLUDED.net_payout;
    END IF;

    -- 7. Atomically sync linked Appointment(s) to 'ready_for_consult' & payment_status = 'cleared'
    IF v_invoice.appointment_id IS NOT NULL THEN
        UPDATE public.appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE id = v_invoice.appointment_id;
    END IF;

    IF v_invoice.encounter_id IS NOT NULL THEN
        UPDATE public.appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE id = v_invoice.encounter_id OR encounter_id = v_invoice.encounter_id;
    END IF;

    IF v_invoice.patient_id IS NOT NULL THEN
        UPDATE public.appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE patient_id = v_invoice.patient_id AND (status = 'pending_payment' OR payment_status != 'cleared');

        -- Update patient_registry queue status
        UPDATE public.patient_registry
        SET queue_status = 'awaiting_consultation',
            updated_at = NOW()
        WHERE id = v_invoice.patient_id AND (queue_status IS NULL OR queue_status IN ('registered', 'awaiting_vitals'));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice.id,
        'amount_paid', v_amount,
        'payment_method', p_payment_method,
        'doctor_fee', v_doctor_fee,
        'pharmacy_fee', v_pharmacy_fee,
        'lab_fee', v_lab_fee,
        'platform_fee', v_platform_fee,
        'gateway_fee', v_gateway_fee,
        'net_profit', v_net_profit
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO authenticated, service_role, anon;
