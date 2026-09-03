-- =============================================================================
-- Migration: Relax Entity & Amount NOT-NULL Constraints (Zero Dummy Data)
-- Migration ID: 20260903000009_relax_entity_and_gross_amount_constraints
-- =============================================================================

-- 1. Relax encounters.entity_id NOT-NULL (allows consultations before clinic entity is attached)
ALTER TABLE public.encounters 
  ALTER COLUMN entity_id DROP NOT NULL;

-- 2. Relax lab_requisitions.lab_entity_id NOT-NULL (allows test orders before lab partner assignment)
ALTER TABLE public.lab_requisitions 
  ALTER COLUMN lab_entity_id DROP NOT NULL;

-- 3. Relax financial_ledgers.gross_amount NOT-NULL & add DEFAULT 0.00
ALTER TABLE public.financial_ledgers 
  ALTER COLUMN gross_amount DROP NOT NULL;

ALTER TABLE public.financial_ledgers 
  ALTER COLUMN gross_amount SET DEFAULT 0.00;

-- 4. Automatically sync gross_amount and amount on financial_ledgers
UPDATE public.financial_ledgers 
SET gross_amount = COALESCE(gross_amount, amount, 0.00)
WHERE gross_amount IS NULL;

UPDATE public.financial_ledgers 
SET amount = COALESCE(amount, gross_amount, 0.00)
WHERE amount IS NULL;
