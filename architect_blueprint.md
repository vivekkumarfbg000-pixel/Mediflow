# ARCHITECTURAL CONTRACT: LOGIN AND PARTNER LOGIN HANDLERS RESOLUTION
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/components/shared/AuthGateway.tsx` -> Correctly assign the submit handlers of normal login and partner login forms to use `handleRealEmailSignIn` and `handleRealPartnerSignIn`.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All files under `supabase/migrations/` and `backend/` must remain untouched to prevent database schema regressions.
    *   All other files under `frontend/src/` except `AuthGateway.tsx` must remain untouched.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):** No modifications to data parameters or types. Only frontend handlers are altered.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):** No modifications.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:** 
    *   `public.profiles` RLS policies must remain intact.
    *   Partner login must restrict access to only roles `pharmacist`, `lab_technician`, and `compounder` (which is correctly handled inside `handleRealPartnerSignIn`).

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Frontend code compiles with zero errors using `npm run build` or `npx tsc --noEmit` inside the frontend directory.
    2. **Telemetry & Integrity Scans**: Database tests `node scratch/test_null_entity_login.js` and `node scratch/test_partner_onboarding_and_approval.js` run and complete successfully.
    3. **Functional Correctness**: Normal email login and partner login forms submit to handlers that immediately resolve profiles and invoke `onAuthSuccess`, avoiding spinner hangs or double-loading race conditions.
