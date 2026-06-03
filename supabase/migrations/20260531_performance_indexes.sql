
-- Mediflow Connected Care Ecosystem — Performance Index Migration
-- Migration ID: 20260531_performance_indexes
-- Created: 2026-05-31
-- Purpose: Add targeted indexes for hot query paths across all dashboard roles
-- Safe to run multiple times (uses CREATE INDEX IF NOT EXISTS)

-- Enable pg_trgm for fuzzy text search on patient names
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Patient Registry — Most frequent queries across all roles

-- Phone lookup (Compounder: search patient by phone on check-in)
CREATE INDEX IF NOT EXISTS idx_patient_registry_phone
  ON public.patient_registry(phone);

-- Name fuzzy search (Compounder: autocomplete patient name field)
CREATE INDEX IF NOT EXISTS idx_patient_registry_name_trgm
  ON public.patient_registry USING gin(name gin_trgm_ops);

-- Entity-based patient listing (multi-tenant pod isolation)
CREATE INDEX IF NOT EXISTS idx_patient_registry_entity
  ON public.patient_registry(registered_at_entity);

-- ABHA ID lookup (government health ID integration)
CREATE INDEX IF NOT EXISTS idx_patient_registry_abha
  ON public.patient_registry(abha_id)
  WHERE abha_id IS NOT NULL;

-- 2. Encounters — Doctor dashboard (most complex join queries)

-- Doctor's patient list (ordered by latest first)
CREATE INDEX IF NOT EXISTS idx_encounters_doctor_time
  ON public.encounters(doctor_id, created_at DESC);

-- Patient encounter history timeline
CREATE INDEX IF NOT EXISTS idx_encounters_patient_time
  ON public.encounters(patient_id, created_at DESC);

-- Status filter (active vs completed encounters)
CREATE INDEX IF NOT EXISTS idx_encounters_status
  ON public.encounters(status, created_at DESC);

-- Entity-level encounter listing for multi-tenant isolation
CREATE INDEX IF NOT EXISTS idx_encounters_entity
  ON public.encounters(entity_id, created_at DESC);

-- 3. Lab Requisitions — Lab dashboard hot paths

-- Lab entity listing (Lab tech: see their pending requisitions)
CREATE INDEX IF NOT EXISTS idx_lab_req_lab_entity
  ON public.lab_requisitions(lab_entity_id, status, created_at DESC);

-- Patient requisition history
CREATE INDEX IF NOT EXISTS idx_lab_req_patient
  ON public.lab_requisitions(patient_id, created_at DESC);

-- Status filter (pending → processing → completed pipeline)
CREATE INDEX IF NOT EXISTS idx_lab_req_status
  ON public.lab_requisitions(status, created_at DESC);

-- Barcode lookup (Lab tech: scan barcode to fetch requisition)
CREATE INDEX IF NOT EXISTS idx_lab_req_barcode
  ON public.lab_requisitions(barcode)
  WHERE barcode IS NOT NULL;

-- Technician assignment filter
CREATE INDEX IF NOT EXISTS idx_lab_req_technician
  ON public.lab_requisitions(assigned_technician_id, status)
  WHERE assigned_technician_id IS NOT NULL;

-- 4. Pharmacy Inventory & Inventory Holds — Pharmacy POS hot paths

-- Inventory holds by pharmacy + status (Pharmacy: pending fulfillment queue)
CREATE INDEX IF NOT EXISTS idx_inventory_holds_pharmacy_status
  ON public.inventory_holds(pharmacy_entity_id, hold_status, created_at DESC);

-- Patient inventory holds (to detect chronic refill candidates)
CREATE INDEX IF NOT EXISTS idx_inventory_holds_patient
  ON public.inventory_holds(patient_id, hold_status);

-- Pharmacy inventory expiry scan (expiry alerts — only stock > 0 matters)
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_expiry
  ON public.pharmacy_inventory(expiry_date, pharmacy_entity_id)
  WHERE stock > 0;

-- Generic name search (Pharmacy POS: autocomplete medicine name)
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_name_trgm
  ON public.pharmacy_inventory USING gin(name gin_trgm_ops);

-- Low stock detection (stock <= reorder_level)
CREATE INDEX IF NOT EXISTS idx_pharmacy_inventory_low_stock
  ON public.pharmacy_inventory(pharmacy_entity_id, stock)
  WHERE stock <= 10;

-- 5. Unified Invoices & Financial Ledgers — Billing dashboard hot paths

-- Invoice status scan (Billing: unpaid invoices list)
CREATE INDEX IF NOT EXISTS idx_unified_invoices_status
  ON public.unified_invoices(payment_status, created_at DESC);

-- Patient invoice history
CREATE INDEX IF NOT EXISTS idx_unified_invoices_patient
  ON public.unified_invoices(patient_id, created_at DESC);

-- Encounter → invoice join (most frequent relation)
CREATE INDEX IF NOT EXISTS idx_unified_invoices_encounter
  ON public.unified_invoices(encounter_id);

-- Financial ledger settlement scan
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_status
  ON public.financial_ledgers(payment_status, created_at DESC);

-- Commission reconciliation (Billing: per-entity payout calculation)
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_destination
  ON public.financial_ledgers(destination_entity_id, payment_status, created_at DESC);

-- Source entity transactions
CREATE INDEX IF NOT EXISTS idx_financial_ledgers_source
  ON public.financial_ledgers(source_entity_id, created_at DESC);

-- 6. WhatsApp Sessions — Bot state machine hot path

-- Phone-based session lookup (most critical — called on every inbound message)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone
  ON public.whatsapp_sessions(patient_phone);

-- State filter (find all sessions in a specific state for batch operations)
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_state
  ON public.whatsapp_sessions(current_state, last_interaction DESC);

-- 7. Activity Logs & Telemetry — Audit & observability

-- Activity log by entity (Admin: entity-level audit trail)
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity
  ON public.activity_logs(entity_id, created_at DESC)
  WHERE entity_id IS NOT NULL;

-- Activity log by actor (User-level audit trail)
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor
  ON public.activity_logs(actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- System health telemetry by severity + status
CREATE INDEX IF NOT EXISTS idx_system_health_severity
  ON public.system_health_telemetry(severity, status, created_at DESC);

-- 8. Seasonal Demand Forecasts — Pharmacy AI dashboard

-- Forecasts per pharmacy entity (not yet acted upon)
CREATE INDEX IF NOT EXISTS idx_seasonal_forecasts_pharmacy
  ON public.seasonal_demand_forecasts(pharmacy_entity_id, is_acted_upon, created_at DESC);

-- 9. Profiles — Auth & role resolution (called on every page load)

-- Entity-based profile lookup (multi-tenant staff listing)
CREATE INDEX IF NOT EXISTS idx_profiles_entity
  ON public.profiles(entity_id)
  WHERE entity_id IS NOT NULL;

-- 10. Pods & Entities — Tenant management

-- Active entities per pod
CREATE INDEX IF NOT EXISTS idx_entities_pod_active
  ON public.entities(pod_id, is_active, entity_type);

-- Entity status filter (Admin: pending/approved/rejected entity management)
CREATE INDEX IF NOT EXISTS idx_entities_status
  ON public.entities(status, entity_type, created_at DESC);

-- ANALYZE all indexed tables to update planner statistics

ANALYZE public.patient_registry;
ANALYZE public.encounters;
ANALYZE public.lab_requisitions;
ANALYZE public.pharmacy_inventory;
ANALYZE public.inventory_holds;
ANALYZE public.unified_invoices;
ANALYZE public.financial_ledgers;
ANALYZE public.whatsapp_sessions;
ANALYZE public.activity_logs;
ANALYZE public.seasonal_demand_forecasts;
ANALYZE public.profiles;
ANALYZE public.entities;
ANALYZE public.pods;
