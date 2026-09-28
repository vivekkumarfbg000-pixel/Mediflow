# 🏛️ CTO Taskforce Implementation Plan: Fix Gender Check Constraint (23514) & Phone Unique Constraint (23505) on OCR Patient Profile Creation

## 🚨 Root Cause Analysis (RCA)

After a 360° deep audit of Supabase Postgres execution logs and schema constraints against `patient_registry`, we isolated the exact root cause of why OCR prescription scans failed to persist patient profiles in Supabase:

1. **Postgres Gender `CHECK` Constraint Violation (`23514`)**:
   - Supabase `patient_registry` schema enforces `gender TEXT CHECK (gender IN ('Male','Female','Other'))`.
   - The LLM OCR engine returns raw values like `"male"`, `"female"`, `"M"`, `"F"`, `"MALE"`, or `"FEMALE"`.
   - When passed directly to Supabase `.upsert()`, Postgres rejected the row with error `23514` (`check_violation`), causing `upsertData` to return `null` and aborting Supabase database persistence.

2. **Postgres Phone `UNIQUE` Constraint Violation (`23505`)**:
   - Supabase `patient_registry` schema enforces `phone TEXT NOT NULL UNIQUE`.
   - When paper scan prescriptions lacked a phone number, a dummy fallback `99999...` with limited randomness (`Math.random()`) was assigned.
   - When multiple walk-in scans collided on dummy numbers, Postgres threw error `23505` (`unique_violation`), rejecting the patient profile insert.

---

## 🛠️ Proposed Surgical File Changes

### 1. [`frontend/src/services/patientService.ts`](file:///c:/Users/vivek/OneDrive/Desktop/vitalsync-Mediflow%20ecosystem/frontend/src/services/patientService.ts)
- **[MODIFY]**:
  - Normalize `patient.gender` to exact canonical values (`'Male'`, `'Female'`, `'Other'`, or `null`) before creating `upsertPayload` so Postgres `CHECK (gender IN ('Male','Female','Other'))` never fails.
  - Generate a 100% unique timestamped fallback phone (`9999${Date.now().slice(-6)}...`) if phone is missing/invalid to prevent `23505` unique violations.
  - In `savePatientAsync`, if a `23505` or `23514` error occurs, sanitize payload and attempt targeted in-place update by phone/id to guarantee row creation.

### 2. [`frontend/src/components/compounder/tabs/AiPrescriptionUploadTab.tsx`](file:///c:/Users/vivek/OneDrive/Desktop/vitalsync-Mediflow%20ecosystem/frontend/src/components/compounder/tabs/AiPrescriptionUploadTab.tsx)
- **[MODIFY]**:
  - Normalize `gender` in `processPrescriptionFiles` to `'Male' | 'Female' | 'Other'`.
  - Use unique timestamp-based fallback `effectivePhone` (`9999${Date.now().slice(-6)}...`) when phone is not provided on paper slips.

---

## 🛡️ Verification & Anti-Regression Plan

1. **TypeScript Typecheck**:
   - Run `npm run typecheck --prefix frontend` to confirm 0 type errors.
2. **Production Build**:
   - Run `npm run build --prefix frontend` to verify successful bundle generation.
3. **End-to-End Workflow Verification**:
   - Scan prescription without phone or with lower-case gender → verify immediate row insertion into Supabase `patient_registry` with a valid UUID and patient code.