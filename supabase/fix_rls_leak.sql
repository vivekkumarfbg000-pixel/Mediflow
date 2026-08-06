-- =============================================================================
-- Mediflow: Structural Security Patch (RLS Bypass Fix)
-- =============================================================================
-- ACTION REQUIRED: Run this script in your Supabase SQL Editor.
-- This replaces the public `USING (true)` select policies with strict tenant isolation.

-- 1. Appointments
DROP POLICY IF EXISTS "appointments_select_authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on appointments" ON public.appointments;
CREATE POLICY "Enforce tenant CDC isolation on appointments" 
ON public.appointments FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 2. Financial Ledgers
DROP POLICY IF EXISTS "Allow public select on financial_ledgers" ON public.financial_ledgers;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on financial_ledgers" ON public.financial_ledgers;
CREATE POLICY "Enforce tenant CDC isolation on financial_ledgers" 
ON public.financial_ledgers FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 3. Unified Invoices
DROP POLICY IF EXISTS "Allow public select on unified_invoices" ON public.unified_invoices;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on unified_invoices" ON public.unified_invoices;
CREATE POLICY "Enforce tenant CDC isolation on unified_invoices" 
ON public.unified_invoices FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 4. Patient Registry
DROP POLICY IF EXISTS "Allow public select on patient_registry" ON public.patient_registry;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on patient_registry" ON public.patient_registry;
CREATE POLICY "Enforce tenant CDC isolation on patient_registry" 
ON public.patient_registry FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 5. WhatsApp Sessions
DROP POLICY IF EXISTS "Allow public select on whatsapp_sessions" ON public.whatsapp_sessions;
DROP POLICY IF EXISTS "Enforce tenant CDC isolation on whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Enforce tenant CDC isolation on whatsapp_sessions" 
ON public.whatsapp_sessions FOR SELECT TO authenticated USING (pod_id = public.get_user_pod());

-- 6. Lab Reports
DROP POLICY IF EXISTS "lab_reports_select_authenticated" ON public.lab_reports;
DROP POLICY IF EXISTS "Enforce tenant isolation on lab_reports" ON public.lab_reports;
CREATE POLICY "Enforce tenant isolation on lab_reports" 
ON public.lab_reports FOR SELECT TO authenticated USING (
    patient_id IN (SELECT id FROM public.patient_registry WHERE pod_id = public.get_user_pod())
);
