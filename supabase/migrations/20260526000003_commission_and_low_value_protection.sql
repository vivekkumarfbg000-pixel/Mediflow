-- Add dynamic price and doctor consultation fee columns if not already added
ALTER TABLE public.master_test_catalog ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT 350.00;
ALTER TABLE public.encounter_diagnostics ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2) DEFAULT 400.00;

CREATE OR REPLACE FUNCTION public.on_encounter_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_lab_entity_id UUID;
    v_pharmacy_entity_id UUID;
    diag RECORD;
    med RECORD;
    doctor_fee DECIMAL;
    lab_fee DECIMAL := 0;
    pharmacy_fee DECIMAL := 0;
    platform_fee DECIMAL;
    total DECIMAL;
    v_patient_phone TEXT;
    v_test_price DECIMAL;
    
    -- FEFO variables
    needed_qty INT := 10; -- default per medication hold
    remaining_qty INT;
    cur_batch RECORD;
    allocated_qty INT;
BEGIN
    -- Look up doctor's dynamic consultation fee
    SELECT COALESCE(consultation_fee, 400.00) INTO doctor_fee
    FROM public.profiles
    WHERE id = NEW.doctor_id;
    
    IF doctor_fee IS NULL THEN
        doctor_fee := 400.00;
    END IF;

    -- Find partner lab and pharmacy in the same pod
    SELECT e.id INTO v_lab_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'lab'
    LIMIT 1;

    SELECT e.id INTO v_pharmacy_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'pharmacy'
    LIMIT 1;

    -- Action A: Route diagnostics to lab and auto-assign to Lalit Prasad for tech verification demo
    FOR diag IN SELECT * FROM public.encounter_diagnostics WHERE encounter_id = NEW.id
    LOOP
        -- Retrieve dynamic test price from master catalog
        SELECT COALESCE(price, 350.00) INTO v_test_price
        FROM public.master_test_catalog
        WHERE loinc_code = diag.loinc_code;

        IF v_test_price IS NULL THEN
            v_test_price := 350.00;
        END IF;

        -- Snapshot test price into encounter_diagnostics
        UPDATE public.encounter_diagnostics
        SET price = v_test_price
        WHERE id = diag.id;

        INSERT INTO public.lab_requisitions (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id)
        VALUES (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
                'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
                'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102');
                
        lab_fee := lab_fee + v_test_price;
    END LOOP;

    -- Action B: Create pharmacy inventory holds with FEFO and isolated transaction safety
    BEGIN
        FOR med IN SELECT * FROM public.encounter_medications WHERE encounter_id = NEW.id
        LOOP
            remaining_qty := needed_qty;
            
            -- Trace FEFO batches
            FOR cur_batch IN 
                SELECT id, batch_number, expiry_date, quantity_in_stock
                FROM public.pharmacy_inventory
                WHERE pharmacy_entity_id = v_pharmacy_entity_id
                  AND medicine_name = med.medicine_name
                  AND is_active = true
                  AND quantity_in_stock > 0
                  AND expiry_date >= CURRENT_DATE
                ORDER BY expiry_date ASC
            LOOP
                IF remaining_qty <= 0 THEN
                    EXIT;
                END IF;

                IF cur_batch.quantity_in_stock >= remaining_qty THEN
                    allocated_qty := remaining_qty;
                ELSE
                    allocated_qty := cur_batch.quantity_in_stock;
                END IF;

                -- Deduct shelf stock
                UPDATE public.pharmacy_inventory
                SET quantity_in_stock = quantity_in_stock - allocated_qty,
                    updated_at = now()
                WHERE id = cur_batch.id;

                -- Create hold record
                INSERT INTO public.inventory_holds (
                    pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                    batch_number, expiry_date, hold_status
                ) VALUES (
                    v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                    cur_batch.batch_number, cur_batch.expiry_date, 'held'
                );

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            -- Check if shortage exists
            IF remaining_qty > 0 THEN
                IF remaining_qty = needed_qty THEN
                    -- Completely Out of Stock (OOS)
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'OUT_OF_STOCK', NULL, 'held'
                    );
                ELSE
                    -- Partial match, write hold for the remaining shortage portion
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'SHORTAGE', NULL, 'held'
                    );
                END IF;

                -- Log standard shortage alert
                INSERT INTO public.activity_logs (action_type, details, entity_id)
                VALUES ('INVENTORY_SHORTAGE', jsonb_build_object(
                    'medicine_name', med.medicine_name,
                    'requested_quantity', needed_qty,
                    'remaining_quantity', remaining_qty,
                    'encounter_id', NEW.id,
                    'pharmacy_entity_id', v_pharmacy_entity_id
                ), v_pharmacy_entity_id);
            END IF;

            pharmacy_fee := pharmacy_fee + 150;
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO public.activity_logs (action_type, details, entity_id)
            VALUES ('SYSTEM_ERROR', jsonb_build_object(
                'trigger', 'on_encounter_submitted (Action B - Pharmacy holds)',
                'error_message', SQLERRM,
                'error_code', SQLSTATE,
                'encounter_id', NEW.id
            ), v_pharmacy_entity_id);
    END;

    -- Action C: Generate unified invoice (Enforce 3% split with a flat minimum ₹10 low-value protection)
    platform_fee := (doctor_fee + lab_fee + pharmacy_fee) * 0.03;
    IF platform_fee < 10.00 THEN
        platform_fee := 10.00;
    END IF;
    
    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    INSERT INTO public.unified_invoices
        (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount, upi_qr_payload)
    VALUES
        (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
         'upi://pay?pa=mediflow@icici&pn=Mediflow&am=' || total || '&cu=INR&tn=Mediflow-' || NEW.id);

    -- Update WhatsApp session to AWAITING_PAYMENT
    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT', last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
