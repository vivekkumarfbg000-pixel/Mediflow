-- =============================================================================
-- Mediflow Migration: Fix hardcoded seed technician UUID in encounter trigger
-- BUG-04: on_encounter_submitted() was assigning ALL lab requisitions across
-- ALL pods to a single seeded lab technician UUID (dfb2a1a8-...-317102),
-- regardless of which clinic submitted the encounter. This causes cross-pod
-- data attribution errors when a second real clinic onboards.
--
-- Fix: Dynamically look up an active lab technician profile within the lab
-- entity for this specific pod. Falls back to NULL if no tech is found.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_encounter_submitted()
RETURNS TRIGGER AS $func$
DECLARE
    v_lab_entity_id UUID;
    v_pharmacy_entity_id UUID;
    v_assigned_tech_id UUID;     -- ← BUG-04 FIX: resolved dynamically per pod
    diag RECORD;
    med RECORD;
    doctor_fee DECIMAL;
    lab_fee DECIMAL := 0;
    pharmacy_fee DECIMAL := 0;
    platform_fee DECIMAL;
    total DECIMAL;
    v_patient_phone TEXT;
    v_test_price DECIMAL;

    needed_qty INT := 10;
    remaining_qty INT;
    cur_batch RECORD;
    allocated_qty INT;

    v_pod_created_at TIMESTAMPTZ;
    v_is_virtual BOOLEAN := FALSE;
    v_is_pilot BOOLEAN := TRUE;
    v_doctor_vendor_id VARCHAR(100);
    v_pharmacy_vendor_id VARCHAR(100);
    v_lab_vendor_id VARCHAR(100);
    v_splits JSONB := '[]'::JSONB;
    v_split_item JSONB;
BEGIN
    -- If it's an update, only proceed if status changed to completed
    IF TG_OP = 'UPDATE' AND (OLD.status = 'completed' OR NEW.status != 'completed') THEN
        RETURN NEW;
    END IF;
    -- If it's an insert, only proceed if status is completed
    IF TG_OP = 'INSERT' AND NEW.status != 'completed' THEN
        RETURN NEW;
    END IF;

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

    -- BUG-04 FIX: Resolve the lab technician dynamically for THIS pod's lab entity.
    -- Do NOT use a hardcoded seed UUID — that breaks multi-tenant isolation.
    SELECT p.id INTO v_assigned_tech_id
    FROM public.profiles p
    WHERE p.entity_id = v_lab_entity_id
      AND p.role = 'lab_technician'
    LIMIT 1;
    -- v_assigned_tech_id may be NULL if no lab technician has been onboarded yet.
    -- The requisition will still be created; assignment happens when a tech logs in.

    -- Action A: Route diagnostics to lab
    FOR diag IN SELECT * FROM public.encounter_diagnostics WHERE encounter_id = NEW.id
    LOOP
        SELECT COALESCE(price, 350.00) INTO v_test_price
        FROM public.master_test_catalog
        WHERE loinc_code = diag.loinc_code;

        IF v_test_price IS NULL THEN
            v_test_price := 350.00;
        END IF;

        UPDATE public.encounter_diagnostics
        SET price = v_test_price
        WHERE id = diag.id;

        INSERT INTO public.lab_requisitions (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id)
        VALUES (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
                'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
                v_assigned_tech_id);   -- ← now NULL-safe, per-pod dynamic lookup

        lab_fee := lab_fee + v_test_price;
    END LOOP;

    -- Action B: Create pharmacy inventory holds
    BEGIN
        FOR med IN SELECT * FROM public.encounter_medications WHERE encounter_id = NEW.id
        LOOP
            remaining_qty := needed_qty;

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

                UPDATE public.pharmacy_inventory
                SET quantity_in_stock = quantity_in_stock - allocated_qty,
                    updated_at = now()
                WHERE id = cur_batch.id;

                INSERT INTO public.inventory_holds (
                    pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                    batch_number, expiry_date, hold_status
                ) VALUES (
                    v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                    cur_batch.batch_number, cur_batch.expiry_date, 'held'
                );

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            IF remaining_qty > 0 THEN
                IF remaining_qty = needed_qty THEN
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'OUT_OF_STOCK', NULL, 'held'
                    );
                ELSE
                    INSERT INTO public.inventory_holds (
                        pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                        batch_number, expiry_date, hold_status
                    ) VALUES (
                        v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                        'SHORTAGE', NULL, 'held'
                    );
                END IF;

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

    -- Action C: Generate unified invoice with pilot check & convenience fee calculations
    SELECT p.created_at INTO v_pod_created_at
    FROM public.pods p
    JOIN public.entities e ON e.pod_id = p.id
    WHERE e.id = NEW.entity_id
    LIMIT 1;

    IF v_pod_created_at IS NOT NULL AND (now() - v_pod_created_at) > INTERVAL '30 days' THEN
        v_is_pilot := FALSE;
    END IF;

    -- Check for an active virtual appointment for this patient
    SELECT COALESCE(is_virtual, FALSE) INTO v_is_virtual
    FROM public.appointments
    WHERE patient_id = NEW.patient_id
      AND status != 'completed'
      AND status != 'cancelled'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_is_pilot THEN
        platform_fee := 0.00;
    ELSE
        IF v_is_virtual THEN
            -- 3% convenience fee on doctor consultation fee
            platform_fee := ROUND(doctor_fee * 0.03, 2);
        ELSE
            -- Walk-in has 0% convenience fee to the patient
            platform_fee := 0.00;
        END IF;
    END IF;

    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    -- Calculate Split Payouts
    SELECT vendor_id INTO v_doctor_vendor_id
    FROM public.cashfree_vendors
    WHERE entity_id = NEW.entity_id
    LIMIT 1;

    SELECT vendor_id INTO v_lab_vendor_id
    FROM public.cashfree_vendors
    WHERE entity_id = v_lab_entity_id
    LIMIT 1;

    SELECT vendor_id INTO v_pharmacy_vendor_id
    FROM public.cashfree_vendors
    WHERE entity_id = v_pharmacy_entity_id
    LIMIT 1;

    IF v_doctor_vendor_id IS NOT NULL AND doctor_fee > 0 THEN
        v_split_item := jsonb_build_object(
            'vendor_id', v_doctor_vendor_id,
            'amount', doctor_fee
        );
        v_splits := v_splits || jsonb_build_array(v_split_item);
    END IF;

    IF v_pharmacy_vendor_id IS NOT NULL AND pharmacy_fee > 0 THEN
        IF v_is_pilot THEN
            v_split_item := jsonb_build_object(
                'vendor_id', v_pharmacy_vendor_id,
                'amount', pharmacy_fee
            );
        ELSE
            v_split_item := jsonb_build_object(
                'vendor_id', v_pharmacy_vendor_id,
                'amount', ROUND(pharmacy_fee * 0.97, 2)
            );
        END IF;
        v_splits := v_splits || jsonb_build_array(v_split_item);
    END IF;

    IF v_lab_vendor_id IS NOT NULL AND lab_fee > 0 THEN
        IF v_is_pilot THEN
            v_split_item := jsonb_build_object(
                'vendor_id', v_lab_vendor_id,
                'amount', lab_fee
            );
        ELSE
            v_split_item := jsonb_build_object(
                'vendor_id', v_lab_vendor_id,
                'amount', ROUND(lab_fee * 0.97, 2)
            );
        END IF;
        v_splits := v_splits || jsonb_build_array(v_split_item);
    END IF;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    INSERT INTO public.unified_invoices
        (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total_amount, upi_qr_payload, split_payload, split_settlement_status)
    VALUES
        (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
         'upi://pay?pa=vitalsync@icici&pn=VitalSync&am=' || total || '&cu=INR&tn=VitalSync-' || NEW.id,
         v_splits,
         CASE WHEN jsonb_array_length(v_splits) > 0 THEN 'split_queued'::varchar ELSE 'unprocessed'::varchar END);

    -- Update WhatsApp session
    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT', last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Secure execution context
REVOKE EXECUTE ON FUNCTION public.on_encounter_submitted() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_encounter_submitted() TO authenticated;

-- Re-wire trigger (already exists, replace is idempotent)
DROP TRIGGER IF EXISTS trg_encounter_submitted ON public.encounters;
CREATE TRIGGER trg_encounter_submitted
    AFTER INSERT OR UPDATE ON public.encounters
    FOR EACH ROW
    EXECUTE FUNCTION public.on_encounter_submitted();
