-- Phase 13: Optimistic Concurrency Control & Atomic Inventory

-- 1. Redefine atomic_decrement_inventory to return BOOLEAN
DROP FUNCTION IF EXISTS atomic_decrement_inventory(UUID, INT);
CREATE OR REPLACE FUNCTION atomic_decrement_inventory(p_item_id UUID, p_quantity INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_stock INT;
BEGIN
    -- Lock the row for update to prevent concurrent race conditions
    SELECT stock INTO current_stock 
    FROM pharmacy_inventory 
    WHERE id = p_item_id 
    FOR UPDATE;

    IF current_stock IS NULL THEN
        RETURN FALSE;
    END IF;

    IF current_stock < p_quantity THEN
        RETURN FALSE; -- Insufficient stock
    END IF;

    UPDATE pharmacy_inventory
    SET stock = stock - p_quantity,
        quantity_in_stock = quantity_in_stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_item_id;

    RETURN TRUE;
END;
$$;

-- 2. Add occ_version to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS occ_version INT DEFAULT 1;

-- 3. Create OCC trigger for appointments
CREATE OR REPLACE FUNCTION enforce_appointment_occ()
RETURNS TRIGGER AS $$
BEGIN
    -- Only enforce if occ_version is explicitly incremented in the incoming payload
    -- If the incoming payload has the same version as the old one (e.g. legacy sync), we might skip or fail.
    -- To strictly enforce OCC, the client MUST pass NEW.occ_version = OLD.occ_version + 1
    -- However, to prevent breaking legacy upserts that don't pass occ_version, we check if NEW.occ_version was provided.
    
    IF NEW.occ_version IS NOT NULL AND OLD.occ_version IS NOT NULL THEN
        IF NEW.occ_version != OLD.occ_version + 1 AND NEW.occ_version != OLD.occ_version THEN
            RAISE EXCEPTION 'OCC_VERSION_MISMATCH';
        END IF;
    END IF;

    -- Auto-increment fallback for backend-only updates
    IF NEW.occ_version IS NULL OR NEW.occ_version = OLD.occ_version THEN
        NEW.occ_version = COALESCE(OLD.occ_version, 0) + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_appointment_occ ON appointments;
CREATE TRIGGER trg_enforce_appointment_occ
BEFORE UPDATE ON appointments
FOR EACH ROW
EXECUTE FUNCTION enforce_appointment_occ();
