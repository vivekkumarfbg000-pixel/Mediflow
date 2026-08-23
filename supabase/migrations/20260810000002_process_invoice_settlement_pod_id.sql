-- Migration: process_invoice_settlement pod_id Scoping Fix
-- Enforces proper pod_id isolation on pool settlements and financial ledgers
-- to prevent silent cross-tenant data leakage in multi-tenant environments.

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
        settled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invoice_id;

    -- 3. Confirm associated Appointment
    IF v_invoice.appointment_id IS NOT NULL THEN
        UPDATE appointments 
        SET status = 'confirmed',
            payment_status = 'cleared',
            token_number = '#TK-' || UPPER(SUBSTRING(p_invoice_id::TEXT, 1, 5)),
            updated_at = NOW()
        WHERE id = v_invoice.appointment_id 
          AND status = 'pending_payment';
    END IF;

    -- 4. Generate Idempotent Pool Settlement
    IF p_gateway_reference_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM vitalsync_pool_settlements WHERE gateway_reference_id = p_gateway_reference_id) THEN
            INSERT INTO vitalsync_pool_settlements (
                invoice_id, patient_id, total_amount, doctor_share, platform_share, 
                gateway_fee, net_platform_profit, payment_mode, settlement_status, 
                gateway_reference_id, created_at, pod_id
            ) VALUES (
                p_invoice_id, v_invoice.patient_id, v_amount, v_doctor_fee, v_platform_fee,
                v_gateway_fee, v_net_profit, p_payment_method, 'completed', 
                p_gateway_reference_id, NOW(), v_pod_id
            );
        END IF;
    ELSE
        -- Generate a unique counter reference
        INSERT INTO vitalsync_pool_settlements (
            invoice_id, patient_id, total_amount, doctor_share, platform_share, 
            gateway_fee, net_platform_profit, payment_mode, settlement_status, 
            gateway_reference_id, created_at, pod_id
        ) VALUES (
            p_invoice_id, v_invoice.patient_id, v_amount, v_doctor_fee, v_platform_fee,
            v_gateway_fee, v_net_profit, p_payment_method, 'completed', 
            'counter-' || p_payment_method || '-' || SUBSTRING(p_invoice_id::TEXT, 1, 8), NOW(), v_pod_id
        );
    END IF;

    -- 5. Auto-Dispense Pharmacy Inventory Holds
    -- Strict Row-Level Locking on inventory_holds to prevent concurrent dispatch
    UPDATE inventory_holds 
    SET hold_status = 'dispensed',
        dispensed_at = NOW(),
        updated_at = NOW()
    WHERE patient_id = v_invoice.patient_id 
      AND hold_status = 'held'
      AND encounter_id = v_invoice.encounter_id;

    -- 6. Generate Financial Ledger Splits (Platform Fee & Doctor Fee)
    -- Insert Platform Fee Record
    INSERT INTO financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id, transaction_type,
        gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
    ) VALUES (
        p_invoice_id, v_pod_id, v_pod_id, 'platform_fee',
        v_amount, 3, v_platform_fee, 'cleared', NOW(), v_pod_id
    );

    -- Insert Doctor/Appointment Record
    INSERT INTO financial_ledgers (
        invoice_id, source_entity_id, destination_entity_id, transaction_type,
        gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
    ) VALUES (
        p_invoice_id, v_pod_id, v_pod_id, 'appointment_fee',
        v_amount, 0, v_doctor_fee, 'cleared', NOW(), v_pod_id
    );

    -- Add Lab & Pharmacy commission splits dynamically
    IF COALESCE(v_invoice.lab_fee, 0) > 0 THEN
        INSERT INTO financial_ledgers (
            invoice_id, source_entity_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
        ) VALUES (
            p_invoice_id, v_pod_id, v_pod_id, 'lab_commission',
            v_invoice.lab_fee, 0.5, (v_invoice.lab_fee * 0.5), 'cleared', NOW(), v_pod_id
        );
    END IF;

    IF COALESCE(v_invoice.pharmacy_fee, 0) > 0 THEN
        INSERT INTO financial_ledgers (
            invoice_id, source_entity_id, destination_entity_id, transaction_type,
            gross_amount, commission_rate, net_payout, payment_status, settled_at, pod_id
        ) VALUES (
            p_invoice_id, v_pod_id, v_pod_id, 'medicine_commission',
            v_invoice.pharmacy_fee, 0.2, (v_invoice.pharmacy_fee * 0.2), 'cleared', NOW(), v_pod_id
        );
    END IF;

    -- Refill Commission Pool Protocol (Rule 57)
    IF (COALESCE(v_invoice.pharmacy_fee, 0) > 0 OR COALESCE(v_invoice.lab_fee, 0) > 0) 
       AND p_payment_method IN ('paytm', 'phonepe', 'razorpay', 'upi') THEN
        DECLARE
            v_current_pool NUMERIC := 0;
            v_refill_amount NUMERIC := 0;
            v_refill_needed NUMERIC := 0;
        BEGIN
            SELECT COALESCE(commission_pool_balance, 0) INTO v_current_pool
            FROM public.pods
            WHERE id = v_pod_id
            FOR UPDATE;
            
            IF v_current_pool < 1000.00 THEN
                v_refill_needed := 1000.00 - v_current_pool;
                v_refill_amount := LEAST(v_refill_needed, v_amount - v_platform_fee);
                
                IF v_refill_amount > 0 THEN
                    UPDATE public.pods
                    SET commission_pool_balance = COALESCE(commission_pool_balance, 0) + v_refill_amount
                    WHERE id = v_pod_id;
                    
                    INSERT INTO public.pool_transactions (
                        pod_id, transaction_type, amount, reason, reference_id, balance_after
                    ) VALUES (
                        v_pod_id, 'credit', v_refill_amount, 
                        'Pool Refill via Online Invoice #' || p_invoice_id, 
                        p_invoice_id, (v_current_pool + v_refill_amount)
                    );
                END IF;
            END IF;
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', 'Invoice settlement completed atomically');
EXCEPTION WHEN OTHERS THEN
    -- In the event of ANY failure, Postgres will automatically rollback the entire transaction.
    RAISE WARNING 'Invoice settlement transaction failed: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
