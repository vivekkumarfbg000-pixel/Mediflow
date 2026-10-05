-- Phase 14: The Clinical Black-Box (Immutable Audit Ledger)

-- 1. Create the append-only ledger table
CREATE TABLE IF NOT EXISTS clinical_audit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    action_type VARCHAR(10) NOT NULL,
    record_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    changed_by_user UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Lockdown the ledger (Zero-Trust Security)
ALTER TABLE clinical_audit_ledger ENABLE ROW LEVEL SECURITY;

-- No one from the frontend can INSERT, UPDATE, or DELETE from this table. 
-- It is strictly managed by PostgreSQL Triggers and Supabase Service Role.
DROP POLICY IF EXISTS "Prevent tampered inserts on audit ledger" ON clinical_audit_ledger;
CREATE POLICY "Prevent tampered inserts on audit ledger" 
ON clinical_audit_ledger 
FOR ALL 
USING (false);

-- 3. Universal Capture Function
CREATE OR REPLACE FUNCTION capture_audit_event()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
    v_record_id UUID;
BEGIN
    -- Extract states based on operation
    IF (TG_OP = 'DELETE') THEN
        v_old := row_to_json(OLD)::JSONB;
        v_record_id := OLD.id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old := row_to_json(OLD)::JSONB;
        v_new := row_to_json(NEW)::JSONB;
        v_record_id := NEW.id;
    ELSIF (TG_OP = 'INSERT') THEN
        v_new := row_to_json(NEW)::JSONB;
        v_record_id := NEW.id;
    END IF;

    -- Avoid logging if no actual data changed (strict JSON equality)
    IF (TG_OP = 'UPDATE' AND v_old = v_new) THEN
        RETURN NULL;
    END IF;

    -- Insert into immutable ledger
    INSERT INTO clinical_audit_ledger (
        table_name,
        action_type,
        record_id,
        old_state,
        new_state,
        changed_by_user
    ) VALUES (
        TG_TABLE_NAME::text,
        TG_OP,
        v_record_id,
        v_old,
        v_new,
        auth.uid() -- Automatically captures the Supabase JWT identity if invoked via client
    );

    RETURN NULL; -- AFTER triggers return NULL
END;
$$;

-- 4. Deploy Triggers to Mission-Critical Tables

-- A. patient_registry
DROP TRIGGER IF EXISTS trg_audit_patient_registry ON patient_registry;
CREATE TRIGGER trg_audit_patient_registry
AFTER INSERT OR UPDATE OR DELETE ON patient_registry
FOR EACH ROW EXECUTE FUNCTION capture_audit_event();

-- B. pharmacy_inventory
DROP TRIGGER IF EXISTS trg_audit_pharmacy_inventory ON pharmacy_inventory;
CREATE TRIGGER trg_audit_pharmacy_inventory
AFTER INSERT OR UPDATE OR DELETE ON pharmacy_inventory
FOR EACH ROW EXECUTE FUNCTION capture_audit_event();

-- C. appointments (The Smart Queue)
DROP TRIGGER IF EXISTS trg_audit_appointments ON appointments;
CREATE TRIGGER trg_audit_appointments
AFTER INSERT OR UPDATE OR DELETE ON appointments
FOR EACH ROW EXECUTE FUNCTION capture_audit_event();

-- D. medicine_bills (The POS/Pharmacy)
DROP TRIGGER IF EXISTS trg_audit_medicine_bills ON medicine_bills;
CREATE TRIGGER trg_audit_medicine_bills
AFTER INSERT OR UPDATE OR DELETE ON medicine_bills
FOR EACH ROW EXECUTE FUNCTION capture_audit_event();
