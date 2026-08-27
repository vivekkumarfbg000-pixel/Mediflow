-- =============================================================================
-- Migration: 20260830000001_atomic_settlement_appointment_sync.sql
-- Description: Upgrades process_invoice_settlement to atomically reconcile
--              appointments table and patient_registry queue_status upon payment.
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
AS $$
DECLARE
    v_invoice RECORD;
    v_doctor_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_gateway_fee NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_amount NUMERIC := 0;
    v_pod_id UUID;
BEGIN
    -- 1. Lock the invoice to prevent concurrent webhook/counter race conditions
    SELECT * INTO v_invoice 
    FROM unified_invoices 
    WHERE id::text = p_invoice_id::text OR id::text LIKE p_invoice_id || '%'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    IF v_invoice.payment_status = 'cleared' THEN
        -- If already cleared, ensure appointments are also synced defensively
        IF v_invoice.appointment_id IS NOT NULL THEN
            UPDATE appointments
            SET status = 'ready_for_consult', payment_status = 'cleared', updated_at = NOW()
            WHERE id = v_invoice.appointment_id AND (status = 'pending_payment' OR payment_status != 'cleared');
        END IF;

        IF v_invoice.patient_id IS NOT NULL THEN
            UPDATE appointments
            SET status = 'ready_for_consult', payment_status = 'cleared', updated_at = NOW()
            WHERE patient_id = v_invoice.patient_id AND status = 'pending_payment';
        END IF;

        RETURN jsonb_build_object('success', true, 'skipped', true, 'message', 'Invoice already cleared');
    END IF;

    v_amount := COALESCE(p_amount_paid, v_invoice.total_amount);
    v_doctor_fee := COALESCE(v_invoice.doctor_fee, 500);
    v_platform_fee := COALESCE(v_invoice.platform_fee, 15);
    v_pod_id := v_invoice.pod_id;

    IF p_payment_method IN ('razorpay', 'phonepe', 'paytm') THEN
        v_gateway_fee := ROUND(v_amount * 0.02, 2); -- Typical 2% digital gateway fee
    ELSE
        v_gateway_fee := 0; -- Cash / UPI Counter is 0% MDR
    END IF;

    -- Counter Doctor Consultation Fee Immunity Protocol (Rule 58)
    IF COALESCE(v_invoice.pharmacy_fee, 0) = 0 
       AND COALESCE(v_invoice.lab_fee, 0) = 0 
       AND p_payment_method IN ('cash', 'upi') 
       AND COALESCE(v_invoice.source, '') != 'whatsapp' THEN
        v_platform_fee := 0;
        v_doctor_fee := v_amount;
    END IF;
    
    v_net_profit := GREATEST(0, v_platform_fee - v_gateway_fee);

    -- 2. Mark Invoice as Cleared
    UPDATE unified_invoices
    SET payment_status = 'cleared',
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE id = v_invoice.id;

    -- 3. Record Financial Ledger Entry (Doctor Fee)
    INSERT INTO financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id,
        transaction_type, gross_amount, commission_rate, net_payout,
        payment_status, reference_id, created_at, pod_id
    )
    VALUES (
        v_invoice.id, v_pod_id, v_pod_id,
        'doctor_consultation_fee', v_doctor_fee, 0.00, v_doctor_fee,
        'completed', COALESCE(p_gateway_reference_id, 'counter-' || p_payment_method || '-' || SUBSTRING(v_invoice.id::TEXT, 1, 8)),
        NOW(), v_pod_id
    );

    -- 4. Record Financial Ledger Entry (Platform Fee) if applicable
    IF v_platform_fee > 0 THEN
        INSERT INTO financial_ledgers (
            invoice_id, source_entity_id, destination_entity_id,
            transaction_type, gross_amount, commission_rate, net_payout,
            payment_status, reference_id, created_at, pod_id
        )
        VALUES (
            v_invoice.id, v_pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'::uuid,
            'platform_fee', v_platform_fee, 0.00, v_net_profit,
            'completed', COALESCE(p_gateway_reference_id, 'platform-' || p_payment_method || '-' || SUBSTRING(v_invoice.id::TEXT, 1, 8)),
            NOW(), v_pod_id
        );
    END IF;

    -- 5. Atomically update linked Appointment to 'ready_for_consult' & payment_status = 'cleared'
    IF v_invoice.appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE id = v_invoice.appointment_id;
    END IF;

    IF v_invoice.encounter_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE id = v_invoice.encounter_id OR encounter_id = v_invoice.encounter_id;
    END IF;

    -- Also reconcile any pending appointments for this patient
    IF v_invoice.patient_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'ready_for_consult',
            payment_status = 'cleared',
            updated_at = NOW()
        WHERE patient_id = v_invoice.patient_id AND status = 'pending_payment';

        -- Update patient_registry queue status if currently awaiting vitals / consultation
        UPDATE patient_registry
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
        'platform_fee', v_platform_fee,
        'gateway_fee', v_gateway_fee,
        'net_profit', v_net_profit
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_invoice_settlement(TEXT, TEXT, NUMERIC, TEXT) TO anon;
