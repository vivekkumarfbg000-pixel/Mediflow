-- Mediflow Commission Engine — Fix Commission Calculation & Split Payload Builder
-- Fixes:
--   1. pharmacy_fee was hardcoded at ₹150/medicine — now uses selling_price from bill items
--   2. Rebuilds on_encounter_submitted to use 3% platform fee correctly
--   3. Adds build_order_splits() RPC — cashfree-order calls this to get Cashfree split payload
-- NOTE: Does NOT edit the original trigger migration file. Replaces the trigger function only.

-- ─── 1. Fix on_encounter_submitted trigger ────────────────────────────────────
-- The existing trigger hardcodes pharmacy_fee = pharmacy_fee + 150 per medicine.
-- We fix it to use the sum of medicine bill items' selling_price (from medicine_bills).
-- If no medicine bill exists yet, it defaults to 0 (bill created later at counter).

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
    -- FEFO variables
    needed_qty           INT := 10;
    remaining_qty        INT;
    cur_batch            RECORD;
    allocated_qty        INT;
BEGIN
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
          (encounter_id, patient_id, lab_entity_id, loinc_code, test_name, barcode, assigned_technician_id)
        VALUES
          (NEW.id, NEW.patient_id, v_lab_entity_id, diag.loinc_code, diag.test_name,
           'BAR-' || upper(substring(NEW.id::text, 1, 8)) || '-' || diag.loinc_code,
           'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102');

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

                INSERT INTO public.activity_logs (action_type, details, entity_id)
                VALUES ('INVENTORY_SHORTAGE', jsonb_build_object(
                    'medicine_name', med.medicine_name,
                    'requested_quantity', needed_qty,
                    'remaining_quantity', remaining_qty,
                    'encounter_id', NEW.id,
                    'pharmacy_entity_id', v_pharmacy_entity_id
                ), v_pharmacy_entity_id);
            END IF;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.activity_logs (action_type, details, entity_id)
        VALUES ('SYSTEM_ERROR', jsonb_build_object(
            'trigger', 'on_encounter_submitted (pharmacy holds)',
            'error_message', SQLERRM, 'error_code', SQLSTATE, 'encounter_id', NEW.id
        ), v_pharmacy_entity_id);
    END;

    -- ── FIXED: pharmacy_fee from medicine bill items (actual selling prices) ──
    -- Prefer summing medicine_bill_items.line_total for this encounter.
    -- Falls back to 0 if compounder hasn't billed yet (they bill at counter separately).
    SELECT COALESCE(SUM(mbi.line_total), 0)
    INTO   pharmacy_fee
    FROM   public.medicine_bills mb
    JOIN   public.medicine_bill_items mbi ON mbi.bill_id = mb.id
    WHERE  mb.encounter_id = NEW.id;

    -- ── 3% platform fee — flat minimum ₹10 to protect low-value invoices ─────
    platform_fee := (doctor_fee + lab_fee + pharmacy_fee) * 0.03;
    IF platform_fee < 10.00 THEN platform_fee := 10.00; END IF;

    total := doctor_fee + lab_fee + pharmacy_fee + platform_fee;

    SELECT phone INTO v_patient_phone FROM public.patient_registry WHERE id = NEW.patient_id;

    -- ── Insert invoice (split_payload built dynamically by cashfree-order) ────
    INSERT INTO public.unified_invoices
      (encounter_id, patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee,
       total_amount, upi_qr_payload)
    VALUES
      (NEW.id, NEW.patient_id, doctor_fee, lab_fee, pharmacy_fee, platform_fee, total,
       'upi://pay?pa=mid-vivekmehta@kotakbank&pn=Mediflow&am=' || total ||
       '&cu=INR&tn=Mediflow-' || NEW.id);

    -- Update WhatsApp session to AWAITING_PAYMENT
    UPDATE public.whatsapp_sessions
    SET current_state = 'AWAITING_PAYMENT',
        last_interaction = now(),
        session_data = session_data || jsonb_build_object('invoiceTotal', total)
    WHERE whatsapp_sessions.patient_phone = v_patient_phone;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.on_encounter_submitted() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.on_encounter_submitted() TO authenticated;

-- ─── 2. build_order_splits() — called by cashfree-order edge function ─────────
-- Dynamically builds the Cashfree order_splits array from the invoice fee breakdown
-- and the pod's registered Cashfree vendor IDs.
-- Returns JSONB array: [{ "vendor_id": "VEND-XXX", "amount": 500 }, ...]
-- The platform fee is NOT listed — Cashfree automatically gives the remainder to you.

CREATE OR REPLACE FUNCTION public.build_order_splits(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice    RECORD;
  v_splits     JSONB := '[]'::JSONB;
  v_vendor     RECORD;
BEGIN
  -- Fetch invoice fee breakdown
  SELECT doctor_fee, lab_fee, pharmacy_fee, platform_fee, pod_id, encounter_id
  INTO   v_invoice
  FROM   public.unified_invoices
  WHERE  id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN '[]'::JSONB;
  END IF;

  -- Doctor split — find clinic entity vendor for this pod
  FOR v_vendor IN
    SELECT cv.vendor_id
    FROM   public.cashfree_vendors cv
    JOIN   public.entities e ON e.id = cv.entity_id
    WHERE  cv.pod_id = v_invoice.pod_id
      AND  e.entity_type IN ('clinic', 'doctor')
      AND  cv.verification_status = 'verified'
    LIMIT 1
  LOOP
    IF v_invoice.doctor_fee > 0 THEN
      v_splits := v_splits || jsonb_build_array(
        jsonb_build_object('vendor_id', v_vendor.vendor_id, 'amount', v_invoice.doctor_fee)
      );
    END IF;
  END LOOP;

  -- Lab split
  FOR v_vendor IN
    SELECT cv.vendor_id
    FROM   public.cashfree_vendors cv
    JOIN   public.entities e ON e.id = cv.entity_id
    WHERE  cv.pod_id = v_invoice.pod_id
      AND  e.entity_type = 'lab'
      AND  cv.verification_status = 'verified'
    LIMIT 1
  LOOP
    IF v_invoice.lab_fee > 0 THEN
      v_splits := v_splits || jsonb_build_array(
        jsonb_build_object('vendor_id', v_vendor.vendor_id, 'amount', v_invoice.lab_fee)
      );
    END IF;
  END LOOP;

  -- Pharmacy split
  FOR v_vendor IN
    SELECT cv.vendor_id
    FROM   public.cashfree_vendors cv
    JOIN   public.entities e ON e.id = cv.entity_id
    WHERE  cv.pod_id = v_invoice.pod_id
      AND  e.entity_type = 'pharmacy'
      AND  cv.verification_status = 'verified'
    LIMIT 1
  LOOP
    IF v_invoice.pharmacy_fee > 0 THEN
      v_splits := v_splits || jsonb_build_array(
        jsonb_build_object('vendor_id', v_vendor.vendor_id, 'amount', v_invoice.pharmacy_fee)
      );
    END IF;
  END LOOP;

  -- Persist splits back to invoice for idempotency
  UPDATE public.unified_invoices
  SET    split_payload = v_splits,
         split_settlement_status = CASE WHEN jsonb_array_length(v_splits) > 0 THEN 'split_queued' ELSE 'unprocessed' END
  WHERE  id = p_invoice_id;

  RETURN v_splits;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.build_order_splits(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.build_order_splits(UUID) TO authenticated;
