-- Phase 8: Atomic Inventory Decrement RPC
-- This RPC prevents race conditions and negative inventory when multiple compounders dispense simultaneously.

CREATE OR REPLACE FUNCTION atomic_decrement_inventory(p_item_id UUID, p_quantity INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE pharmacy_inventory
    SET stock = GREATEST(0, stock - p_quantity),
        quantity_in_stock = GREATEST(0, stock - p_quantity),
        updated_at = NOW()
    WHERE id = p_item_id;
END;
$$;
