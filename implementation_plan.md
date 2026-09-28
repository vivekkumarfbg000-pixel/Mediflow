# 🏛️ CTO Taskforce Implementation Plan: Permanent OCR Profile & Real-Time Supabase POS Billing Fix

## 🚨 Root Cause Analysis (RCA)

After a 360° full-lifecycle cross-domain trace across the entrypoint, state normalization, database/CDC, and consuming console domains, we isolated the root causes of the reported Clinic OS workflow failures:

1. **Split-Brain Patient UUID Mismatch & Unsynced Local State**:
   - During OCR scanning in `AiPrescriptionUploadTab.tsx`, a temporary UUID (`crypto.randomUUID()`) was created for local state (`extractedPatient`).
   - `savePatientAsync` in `patientService.ts` would query Supabase `patient_registry` by phone and assign the existing canonical UUID or generate a new patient code. However, if `isAssistedReview` was `true` (e.g. OCR fallback or walk-in patient), `AiPrescriptionUploadTab.tsx` skipped auto-committing to Supabase altogether.
   - Additionally, when `PatientService.savePatient` (synchronous) was called during profile editing, it launched a detached background IIFE without updating local memory arrays/cloudStore with the returned canonical UUID, nor did it dispatch `mediflow-state-change` to update active dashboards.

2. **Mismatched Active OCR Bundle Matching in POS Billing (`BillHubTab.tsx`)**:
   - When the compounder clicked **"Proceed to Billing"**, `AiPrescriptionUploadTab.tsx` saved `vitalsync_active_ocr_rx` in `localStorage` with `patientId`.
   - In `BillHubTab.tsx`, the active OCR bundle matcher checked strictly `parsed.patientId === selectedPatient.id`. If `selectedPatient` was resolved by phone/token/code or if `savePatientAsync` updated `selectedPatient.id` to the canonical Supabase UUID while `parsed.patientId` held the old local UUID, the ID check failed.
   - When `matchesById` failed, `BillHubTab` discarded the extracted medicines and lab tests, fell back to `billingMode = 'manual'`, set `includeConsult = true`, and presented the default empty OPD billing interface instead of auto-populating extracted medicines and lab tests.

3. **Incomplete Consultation & Payment Clearance Invariant**:
   - Scanned paper prescriptions represent a consultation that has **already taken place physically** with the doctor.
   - Currently, appointments created or matched during OCR were left in `pending_payment` or `awaiting_consultation` status, causing `BillHubTab` to treat the consultation fee as unpaid and default to charging an OPD consult fee.

4. **Chronic Care Real-Time Ingestion Sync**:
   - When chronic conditions (Diabetes, Hypertension, Thyroid, etc.) were detected, `ChronicCareService.autoIngestFromEncounter` wrote to Supabase `chronic_care_cohorts`, but did not dispatch `mediflow-state-change` or notify `RealtimeSyncService`, causing the Chronic Care Dashboard to remain un-updated until manual page refresh.

---

## 🛠️ Proposed Surgical File Changes

### 1. `frontend/src/services/patientService.ts`
- **[MODIFY]** `savePatient` & `savePatientAsync`:
  - Ensure canonical Supabase UUID (`targetId`) and `patient_code` immediately replace transient local UUIDs in memory arrays, `cloudStore`, and `localStorage`.
  - Ensure all fields (`name`, `phone`, `address`, `age`, `gender`, `is_chronic`, `chronic_conditions`, `vitals`, `queue_status`) are persisted atomically to Supabase `patient_registry`.
  - Unconditionally fire `window.dispatchEvent(new CustomEvent('mediflow-state-change'))` on every patient save so all open consoles update instantly.

### 2. `frontend/src/components/compounder/tabs/AiPrescriptionUploadTab.tsx`
- **[MODIFY]** `persistClinicOsPipeline` & `handleProceedToBilling`:
  - Remove the `!isAssistedReview` blocking check so fallback/assisted-review patients are also persisted to Supabase `patient_registry`.
  - Mark patient queue status as `'completed'` (or `'billing_ready'`) and update appointment/invoice status in Supabase `appointments` & `unified_invoices` to `status: 'completed'`, `payment_status: 'cleared'`.
  - Store canonical patient metadata in `vitalsync_active_ocr_rx` (including `patientId`, `patientPhone`, `patientCode`, `tokenNumber`, `medications`, `extractedMedicines`, `diagnosticTests`, `extractedTests`) so `BillHubTab` can reliably match the active OCR bundle.
  - When compounder edits patient profile (phone, address, name), trigger real-time cloud persistence and emit `mediflow-state-change`.

### 3. `frontend/src/components/compounder/tabs/BillHubTab.tsx`
- **[MODIFY]** Patient Selection & POS Bundle Matching:
  - Expand `activeOcrBundle` matching logic to check `parsed.patientId === selectedPatient.id || parsed.patientId === selectedPatient.patientCode || (parsed.patientCode && parsed.patientCode === selectedPatient.patientCode) || (cleanSelPhone.length >= 6 && cleanOcrPhone.length >= 6 && cleanSelPhone === cleanOcrPhone) || (parsed.tokenNumber != null && selectedPatient.tokenNumber != null && String(parsed.tokenNumber) === String(selectedPatient.tokenNumber)) || (parsed.patientPhone && selectedPatient.phone && cleanPhone(parsed.patientPhone) === cleanPhone(selectedPatient.phone))`.
  - Support `medications` / `extractedMedicines` / `extracted_medicines` and `diagnosticTests` / `extractedTests` / `extracted_tests` in `activeOcrBundle`.
  - Automatically set `includeConsult = false` for scanned prescription patients (consultation already completed/cleared).
  - Automatically populate extracted medicines and lab tests into the active digital billing POS grid with prices synced from the pharmacy inventory and LOINC catalog.

### 4. `frontend/src/services/chronicCareService.ts`
- **[MODIFY]** `autoIngestFromEncounter` & `registerChronicPatient`:
  - Atomic upsert to `chronic_care_cohorts` on Supabase with sovereign `pod_id`.
  - Unconditionally dispatch `mediflow-state-change` for zero-delay real-time rendering on the Chronic Care Dashboard.

---

## 🛡️ Verification & Anti-Regression Plan

1. **TypeScript Compilation Audit**:
   - Run `npx tsc --noEmit` to verify 0 type errors across the workspace.
2. **Workflow End-to-End Test Matrix**:
   - **Step A**: Scan prescription on Compounder Desk (OCR extraction of Patient Name, Age, Phone, Medicines, Lab Tests, Chronic Conditions).
   - **Step B**: Verify immediate creation/upsert of patient profile in Supabase `patient_registry` with a valid UUID and patient code.
   - **Step C**: Edit profile (phone/address) in profile widget → verify instant live sync to Supabase cloud.
   - **Step D**: Check Chronic Care Dashboard → verify patient auto-ingested into real-time chronic cohorts.
   - **Step E**: Click **"Proceed to Billing"** → verify UI lands directly on active POS billing grid with:
     - Correct patient profile loaded.
     - Extracted medicines & lab tests pre-selected and populated with real catalog prices.
     - OPD Consultation fee set to waived/already paid (`includeConsult = false`).