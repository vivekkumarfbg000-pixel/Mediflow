-- Migration: core_feature_index_optimization
-- Category: Priority 1 (Query Performance) & Priority 4 (Schema Design)
-- Optimizes the nested loops inside 'on_encounter_submitted' and related multi-vendor care workflows.

-- 1. Composite Index for FEFO Shelf Tracking
-- Speeds up range scan filtering on active pharmacy items sorted by expiry_date ASC.
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_fefo_opt 
ON public.pharmacy_inventory (pharmacy_entity_id, medicine_name, is_active, quantity_in_stock, expiry_date ASC);

-- 2. Composite Index for Clinic-to-Partner pod routing
-- Speeds up the JOIN on public.entities for lab/pharmacy pod matching.
CREATE INDEX IF NOT EXISTS idx_entities_pod_type_opt 
ON public.entities (pod_id, entity_type);

-- 3. B-Tree Indexes on loop cursors
-- Eliminates sequential table scans when looping over medications & diagnostics inside encounter triggers.
CREATE INDEX IF NOT EXISTS idx_encounter_medications_encounter_id_opt 
ON public.encounter_medications (encounter_id);

CREATE INDEX IF NOT EXISTS idx_encounter_diagnostics_encounter_id_opt 
ON public.encounter_diagnostics (encounter_id);
