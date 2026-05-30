-- =============================================================================
-- Mediflow Connected Care Ecosystem — Automatic Timestamps Migration
-- Migration ID: 20260531_updated_at_triggers
-- Created: 2026-05-31
-- Purpose: Add updated_at columns + auto-update triggers on all mutable tables
-- Ensures accurate modification tracking for audit, caching, and conflict resolution
-- =============================================================================

-- =============================================================================
-- 1. Shared trigger function (single definition, reused across all tables)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Revoke public execution to prevent privilege leak
REVOKE EXECUTE ON FUNCTION public.update_modified_column() FROM PUBLIC;

-- =============================================================================
-- 2. Patient Registry
-- =============================================================================
ALTER TABLE public.patient_registry
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_patient_registry_updated_at ON public.patient_registry;
CREATE TRIGGER trg_patient_registry_updated_at
  BEFORE UPDATE ON public.patient_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 3. Encounters
-- =============================================================================
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_encounters_updated_at ON public.encounters;
CREATE TRIGGER trg_encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 4. Lab Requisitions
-- =============================================================================
ALTER TABLE public.lab_requisitions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_lab_req_updated_at ON public.lab_requisitions;
CREATE TRIGGER trg_lab_req_updated_at
  BEFORE UPDATE ON public.lab_requisitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 5. Inventory Holds
-- =============================================================================
ALTER TABLE public.inventory_holds
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_inventory_holds_updated_at ON public.inventory_holds;
CREATE TRIGGER trg_inventory_holds_updated_at
  BEFORE UPDATE ON public.inventory_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 6. Unified Invoices
-- =============================================================================
ALTER TABLE public.unified_invoices
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_unified_invoices_updated_at ON public.unified_invoices;
CREATE TRIGGER trg_unified_invoices_updated_at
  BEFORE UPDATE ON public.unified_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 7. Financial Ledgers
-- =============================================================================
ALTER TABLE public.financial_ledgers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_financial_ledgers_updated_at ON public.financial_ledgers;
CREATE TRIGGER trg_financial_ledgers_updated_at
  BEFORE UPDATE ON public.financial_ledgers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 8. Pharmacy Inventory
-- =============================================================================
ALTER TABLE public.pharmacy_inventory
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_pharmacy_inventory_updated_at ON public.pharmacy_inventory;
CREATE TRIGGER trg_pharmacy_inventory_updated_at
  BEFORE UPDATE ON public.pharmacy_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 9. WhatsApp Sessions
-- =============================================================================
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_whatsapp_sessions_updated_at ON public.whatsapp_sessions;
CREATE TRIGGER trg_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 10. Profiles (Auth users)
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 11. Entities (Clinic/Pharmacy/Lab registrations)
-- =============================================================================
ALTER TABLE public.entities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_entities_updated_at ON public.entities;
CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON public.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 12. Pods (Healthcare cluster units)
-- =============================================================================
ALTER TABLE public.pods
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_pods_updated_at ON public.pods;
CREATE TRIGGER trg_pods_updated_at
  BEFORE UPDATE ON public.pods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 13. Seasonal Demand Forecasts
-- =============================================================================
ALTER TABLE public.seasonal_demand_forecasts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_seasonal_forecasts_updated_at ON public.seasonal_demand_forecasts;
CREATE TRIGGER trg_seasonal_forecasts_updated_at
  BEFORE UPDATE ON public.seasonal_demand_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_modified_column();

-- =============================================================================
-- 14. Numeric field constraints (prevent negative amounts)
-- =============================================================================

-- Invoices: fees must be non-negative
ALTER TABLE public.unified_invoices
  ADD CONSTRAINT IF NOT EXISTS chk_invoice_doctor_fee CHECK (doctor_fee >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_invoice_lab_fee CHECK (lab_fee >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_invoice_pharmacy_fee CHECK (pharmacy_fee >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_invoice_platform_fee CHECK (platform_fee >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_invoice_total CHECK (total_amount >= 0);

-- Financial ledgers: amounts must be positive
ALTER TABLE public.financial_ledgers
  ADD CONSTRAINT IF NOT EXISTS chk_ledger_gross CHECK (gross_amount > 0),
  ADD CONSTRAINT IF NOT EXISTS chk_ledger_net CHECK (net_payout >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_ledger_commission CHECK (commission_rate >= 0 AND commission_rate <= 100);

-- Pharmacy inventory: stock can't be negative
ALTER TABLE public.pharmacy_inventory
  ADD CONSTRAINT IF NOT EXISTS chk_pharmacy_stock CHECK (stock >= 0);

-- Inventory holds: quantity must be positive
ALTER TABLE public.inventory_holds
  ADD CONSTRAINT IF NOT EXISTS chk_hold_quantity CHECK (quantity > 0);

-- =============================================================================
-- 15. Backfill updated_at for existing rows (set to created_at value)
-- =============================================================================
UPDATE public.patient_registry SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.encounters SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.lab_requisitions SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.inventory_holds SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.unified_invoices SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.financial_ledgers SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE public.seasonal_demand_forecasts SET updated_at = created_at WHERE updated_at IS NULL;
