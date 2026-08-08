-- Migration: Atomic Care Loop RPC to fix Client-Side State Dropping & TOCTOU Race Conditions
-- Implements robust transactional wrapper for encounter execution.

CREATE OR REPLACE FUNCTION public.process_clinical_care_loop(
    p_encounter_id UUID,
    p_patient_id UUID,
    p_doctor_id UUID,
    p_pod_id UUID,
    p_lab_entity_id UUID,
    p_pharmacy_entity_id UUID,
    p_medications JSONB,
    p_diagnostics JSONB,
    p_patient_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lab_fee NUMERIC := 0;
    v_pharmacy_fee NUMERIC := 0;
    v_doctor_fee NUMERIC := 0;
    v_platform_fee NUMERIC := 0;
    v_invoice_total NUMERIC := 0;
    
    v_assigned_tech_id UUID := NULL;
    v_test JSONB;
    v_test_price NUMERIC := 350.00;
    
    v_med JSONB;
    v_needed_qty INT;
    v_remaining_qty INT;
    v_batch RECORD;
    v_allocated_qty INT;
    v_hold_status TEXT;
    
    v_already_paid_consult BOOLEAN := FALSE;
    v_doctor_display_name TEXT := 'Doctor';
    v_doctor_profile RECORD;
    
    v_meds_text TEXT := '';
    v_diags_text TEXT := '';
    v_bot_message TEXT;
    v_existing_session RECORD;
    v_current_history JSONB;
    v_session_data JSONB;
    v_new_history_entry JSONB;
BEGIN
    -- 1. Insert Diagnostics
    IF jsonb_array_length(p_diagnostics) > 0 THEN
        FOR v_test IN SELECT * FROM jsonb_array_elements(p_diagnostics)
        LOOP
            INSERT INTO encounter_diagnostics (encounter_id, loinc_code, test_name, status)
            VALUES (p_encounter_id, v_test->>'loincCode', v_test->>'name', 'ordered');
            
            -- Prepare text for WhatsApp
            v_diags_text := v_diags_text || '🧪 ' || (v_test->>'name') || E'\n';
            
            -- Route to Lab Requisitions
            IF p_lab_entity_id IS NOT NULL THEN
                -- Find lab technician
                IF v_assigned_tech_id IS NULL THEN
                    SELECT id INTO v_assigned_tech_id FROM profiles 
                    WHERE entity_id = p_lab_entity_id AND role = 'lab_technician' LIMIT 1;
                END IF;
                
                -- Get Price
                v_test_price := 350.00;
                SELECT price INTO v_test_price FROM master_test_catalog WHERE loinc_code = v_test->>'loincCode' LIMIT 1;
                IF v_test_price IS NULL THEN v_test_price := 350.00; END IF;
                
                v_lab_fee := v_lab_fee + v_test_price;
                
                INSERT INTO lab_requisitions (
                    encounter_id, patient_id, lab_entity_id, loinc_code, test_name, 
                    barcode, status, assigned_technician_id, pod_id
                ) VALUES (
                    p_encounter_id, p_patient_id, p_lab_entity_id, v_test->>'loincCode', v_test->>'name',
                    UPPER('BAR-' || SUBSTRING(p_encounter_id::TEXT, 1, 8) || '-' || (v_test->>'loincCode')),
                    'pending', v_assigned_tech_id, p_pod_id
                );
            END IF;
        END LOOP;
    END IF;

    -- 2. Reserve Pharmacy Stock (WITH PESSIMISTIC LOCKING)
    IF jsonb_array_length(p_medications) > 0 THEN
        FOR v_med IN SELECT * FROM jsonb_array_elements(p_medications)
        LOOP
            v_needed_qty := 10;
            v_remaining_qty := v_needed_qty;
            
            IF p_pharmacy_entity_id IS NOT NULL THEN
                v_pharmacy_fee := v_pharmacy_fee + 150;
                
                -- Prepare text for WhatsApp
                v_meds_text := v_meds_text || '💊 ' || (v_med->>'medicineName') || ' (' || COALESCE(v_med->>'frequency', '') || ', ' || COALESCE(v_med->>'duration', '') || ')' || E'\n';
                
                -- FOR UPDATE strictly serializes concurrent stock deductions! (Fixes TOCTOU)
                FOR v_batch IN 
                    SELECT id, batch_number, expiry_date, quantity_in_stock 
                    FROM pharmacy_inventory 
                    WHERE pharmacy_entity_id = p_pharmacy_entity_id 
                      AND medicine_name = v_med->>'medicineName'
                      AND is_active = true 
                      AND quantity_in_stock > 0 
                      AND expiry_date >= CURRENT_DATE
                    ORDER BY expiry_date ASC
                    FOR UPDATE
                LOOP
                    IF v_remaining_qty <= 0 THEN EXIT; END IF;
                    
                    v_allocated_qty := LEAST(v_batch.quantity_in_stock, v_remaining_qty);
                    
                    UPDATE pharmacy_inventory 
                    SET quantity_in_stock = quantity_in_stock - v_allocated_qty,
                        updated_at = NOW()
                    WHERE id = v_batch.id;
                    
                    INSERT INTO inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name,
                        dosage, quantity, batch_number, expiry_date, hold_status
                    ) VALUES (
                        p_pharmacy_entity_id, p_encounter_id, p_patient_id, v_med->>'medicineName',
                        COALESCE(v_med->>'dosage', ''), v_allocated_qty, v_batch.batch_number, v_batch.expiry_date, 'held'
                    );
                    
                    v_remaining_qty := v_remaining_qty - v_allocated_qty;
                END LOOP;
                
                IF v_remaining_qty > 0 THEN
                    IF v_remaining_qty = v_needed_qty THEN
                        v_hold_status := 'OUT_OF_STOCK';
                    ELSE
                        v_hold_status := 'SHORTAGE';
                    END IF;
                    
                    INSERT INTO inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name,
                        dosage, quantity, batch_number, expiry_date, hold_status
                    ) VALUES (
                        p_pharmacy_entity_id, p_encounter_id, p_patient_id, v_med->>'medicineName',
                        COALESCE(v_med->>'dosage', ''), v_remaining_qty, v_hold_status, NULL, 'held'
                    );
                    
                    INSERT INTO activity_logs (action_type, details, entity_id, pod_id)
                    VALUES (
                        'INVENTORY_SHORTAGE', 
                        jsonb_build_object(
                            'medicine_name', v_med->>'medicineName', 
                            'requested_quantity', v_needed_qty, 
                            'remaining_quantity', v_remaining_qty, 
                            'encounter_id', p_encounter_id, 
                            'pharmacy_entity_id', p_pharmacy_entity_id
                        ), 
                        p_pharmacy_entity_id, p_pod_id
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Unified Invoice Generation
    SELECT EXISTS (
        SELECT 1 FROM unified_invoices 
        WHERE (patient_id = p_patient_id OR patient_id::TEXT = p_patient_id::TEXT)
          AND (payment_status = 'cleared' OR payment_status = 'paid')
          AND (doctor_fee > 0 OR type = 'consult')
    ) INTO v_already_paid_consult;

    IF NOT v_already_paid_consult THEN
        v_doctor_fee := 400.00;
        SELECT consultation_fee, display_name, name INTO v_doctor_profile FROM profiles WHERE id = p_doctor_id LIMIT 1;
        IF v_doctor_profile.consultation_fee IS NOT NULL THEN
            v_doctor_fee := v_doctor_profile.consultation_fee;
        END IF;
        IF v_doctor_profile.display_name IS NOT NULL THEN
            v_doctor_display_name := v_doctor_profile.display_name;
        ELSIF v_doctor_profile.name IS NOT NULL THEN
            v_doctor_display_name := v_doctor_profile.name;
        END IF;
    END IF;

    v_platform_fee := (v_doctor_fee + v_lab_fee + v_pharmacy_fee) * 0.03;
    IF v_platform_fee < 10.00 THEN v_platform_fee := 10.00; END IF;
    v_invoice_total := v_doctor_fee + v_lab_fee + v_pharmacy_fee + v_platform_fee;

    INSERT INTO unified_invoices (
        encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount,
        upi_qr_payload, pod_id
    ) VALUES (
        p_encounter_id, p_patient_id, v_doctor_fee, v_lab_fee, v_pharmacy_fee, v_platform_fee, v_invoice_total,
        'upi://pay?pa=vitalsync@axl&pn=VitalSync&am=' || v_invoice_total || '&cu=INR&tn=VitalSync-' || p_encounter_id, p_pod_id
    );

    -- 4. Mutate WhatsApp Bot State
    IF p_patient_phone IS NOT NULL THEN
        SELECT id, session_data INTO v_existing_session FROM whatsapp_sessions WHERE patient_phone = p_patient_phone LIMIT 1;
        
        IF v_existing_session.id IS NOT NULL THEN
            IF NOT v_doctor_display_name ILIKE 'Dr.%' THEN
                v_doctor_display_name := 'Dr. ' || v_doctor_display_name;
            END IF;
            
            v_bot_message := '*' || v_doctor_display_name || '* has signed off your Clinical e-Prescription (e-Rx) and care invoice.';
            IF LENGTH(v_meds_text) > 0 THEN v_bot_message := v_bot_message || E'\n\n*Generic Medicines ordered*:\n' || v_meds_text; END IF;
            IF LENGTH(v_diags_text) > 0 THEN v_bot_message := v_bot_message || E'\n\n*Diagnostics Ordered*:\n' || v_diags_text; END IF;
            v_bot_message := v_bot_message || E'\n\n*Payment Pending*: A unified care pod invoice is generated. Please pay below:';
            
            v_session_data := v_existing_session.session_data;
            v_current_history := COALESCE(v_session_data->'chatHistory', '[]'::JSONB);
            v_new_history_entry := jsonb_build_object('sender', 'bot', 'text', v_bot_message, 'time', NOW());
            v_current_history := v_current_history || v_new_history_entry;
            
            v_session_data := jsonb_set(v_session_data, '{chatHistory}', v_current_history);
            v_session_data := jsonb_set(v_session_data, '{invoiceTotal}', to_jsonb(v_invoice_total));
            
            UPDATE whatsapp_sessions 
            SET current_state = 'AWAITING_PAYMENT',
                session_data = v_session_data,
                last_interaction = NOW()
            WHERE id = v_existing_session.id;
            
            INSERT INTO activity_logs (action_type, details, entity_id, pod_id)
            VALUES ('WHATSAPP_STATE_TRANSITION', jsonb_build_object('phone', p_patient_phone, 'newState', 'AWAITING_PAYMENT'), v_existing_session.id, p_pod_id);
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'invoiceTotal', v_invoice_total);
EXCEPTION WHEN OTHERS THEN
    -- In the event of ANY failure, Postgres will automatically rollback the entire transaction.
    RAISE WARNING 'Care loop transaction failed: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
