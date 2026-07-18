-- Mediflow — Migration: 20260719000000_fix_encounter_trigger_pod_id.sql
--
-- Purpose:
--   Update on_encounter_submitted() trigger to explicitly set pod_id in
--   public.lab_requisitions and public.unified_invoices.
--   Without this, they default to the fallback pod ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'),
--   which breaks RLS tenant isolation for other clinics/pods.
--
-- Safe to re-run: YES

CREATE OR REPLACE FUNCTION public.on_encounter_submitted()
RETURNS TRIGGER AS $$
DECLARE
    v_lab_entity_id      UUID;
    v_pharmacy_entity_id UUID;
    diag                 RECORD;
    med                  RECORD;
    doctor_fee           DECIMAL;
    lab_fee              DECIMAL := 0;
    pharmacy_fee         DECIMAL := 0;
    platform_fee         DECIMAL;
    total                DECIMAL;
    v_patient_phone      TEXT;
    v_test_price         DECIMAL;
    v_pod_id             UUID;
    -- FEFO variables
    needed_qty           INT := 10;
    remaining_qty        INT;
    cur_batch            RECORD;
    allocated_qty        INT;
BEGIN
    -- Resolve pod_id of the encounter (fallback to default pod if NULL)
    v_pod_id := COALESCE(NEW.pod_id, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');

    -- 1. Doctor consultation fee
    SELECT COALESCE(consultation_fee, 400.00) INTO doctor_fee
    FROM public.profiles WHERE id = NEW.doctor_id;
    IF doctor_fee IS NULL THEN doctor_fee := 400.00; END IF;

    -- 2. Partner lab and pharmacy in same pod
    SELECT e.id INTO v_lab_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'lab' LIMIT 1;

    SELECT e.id INTO v_pharmacy_entity_id
    FROM public.entities e
    JOIN public.entities clinic ON clinic.pod_id = e.pod_id
    WHERE clinic.id = NEW.entity_id AND e.entity_type = 'pharmacy' LIMIT 1;

    -- 3. Route diagnostics to lab
    FOR diag IN SELECT * FROM public.encounter_diagnostics WHERE encounter_id = NEW.id
    LOOP
        SELECT COALESCE(price, 350.00) INTO v_test_price
        FROM public.master_test_catalog WHERE loinc_code = diag.loinc_code;
        IF v_test_price IS NULL THEN v_test_price := 350.00; END IF;

        UPDATE public.encounter_diagnostics SET price = v_test_price WHERE id = diag.id;

        INSERT INTO public.lab_requisitions
          (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id, pod_id)
        VALUES
          (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
           'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
           'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', v_pod_id);

        lab_fee := lab_fee + v_test_price;
    END LOOP;

    -- 4. Pharmacy inventory holds with FEFO
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
                IF remaining_qty <= 0 THEN EXIT; END IF;
                IF cur_batch.quantity_in_stock >= remaining_qty THEN
                    allocated_qty := remaining_qty;
                ELSE
                    allocated_qty := cur_batch.quantity_in_stock;
                END IF;

                UPDATE public.pharmacy_inventory
                SET quantity_in_stock = quantity_in_stock - allocated_qty, updated_at = now()
                WHERE id = cur_batch.id;

                INSERT INTO public.inventory_holds
                  (pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                   batch_number, expiry_date, hold_status)
                VALUES
                  (v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, allocated_qty,
                   cur_batch.batch_number, cur_batch.expiry_date, 'held');

                remaining_qty := remaining_qty - allocated_qty;
            END LOOP;

            IF remaining_qty > 0 THEN
                INSERT INTO public.inventory_holds
                  (pharmacy_entity_id, encounter_id, patient_id, medicine_name, dosage, quantity,
                   batch_number, expiry_date, hold_status)
                VALUES
                  (v_pharmacy_entity_id, NEW.id, NEW.patient_id, med.medicine_name, med.dosage, remaining_qty,
                   CASE WHEN remaining_qty = needed_qty THEN 'OUT_OF_STOCK' ELSE 'SHORTAGE' END,
                   NULL, 'held');

                INSERT INTO public.activity_logs (action_type, details, entity_id, pod_id)
                VALUES ('INVENTORY_SHORTAGE', jsonb_build_object(
                    'medicine_name', med.medicine_name,
                    'requested_quantity', needed_qty,
                    'remaining_quantity', remaining_qty,
                    'encounter_id', NEW.id,
                    'pharmacy_entity_id', v_pharmacy_entity_id
                ), v_pharmacy_entity_id, v_pod_id);
            END IF;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.activity_logs (action_type, details, entity_id, pod_id)
        VALUES ('SYSTEM_ERROR', jsonb_build_object(
            'trigger', 'on_encounter_submitted (pharmacy holds)',
            'error_message', SQLERRM, 'error_code', SQLSTATE, 'encounter_id', NEW.id
        ), v_pharmacy_entity_id, v_pod_id);
    END;

    -- 5. pharmacy_fee from medicine bill items (actual selling prices)
    SELECT COALESCE(SUM(mbi.line_total), 0)
    INTO   pharmacy_fee
    FROM   public.medicine_bills mb
    JOIN   public.medicine_bill_items mbi ON mbi.bill_id = mb.id
    WHERE  mb.encounter_id = NEW.id;

    -- 6. 3% platform fee — flat minimum ₹10 to protect low-value invoices
    platform_fee := (doctor_fee + lab_fee + pharmacy_fee) * 0.03;
    IF platform_fee < 10.00 THEN platform_fee := 10.00; END IF;

    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    -- 7. Insert invoice (with explicit pod_id to ensure tenant isolation RLS compliance)
    INSERT INTO public.unified_invoices
      (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee,
       total_amount, upi_qr_payload, pod_id)
    VALUES
      (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
       'upi://pay?pa=mid-vivekmehta@kotakbank&pn=Mediflow&am=' || total ||
       '&cu=INR&tn=Mediflow-' || NEW.id, v_pod_id);

    -- 8. Update WhatsApp session to AWAITING_PAYMENT
    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT',
        last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Secure execution
REVOKE EXECUTE ON FUNCTION public.on_encounter_submitted() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.on_encounter_submitted() TO authenticated;

-- Re-wire trigger (replace is idempotent)
DROP TRIGGER IF EXISTS trg_encounter_submitted ON public.encounters;
CREATE TRIGGER trg_encounter_submitted
    AFTER INSERT OR UPDATE ON public.encounters
    FOR EACH ROW
    EXECUTE FUNCTION public.on_encounter_submitted();

