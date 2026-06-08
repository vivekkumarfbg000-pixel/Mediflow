# ARCHITECTURAL CONTRACT: INFINITE LOGIN LOADING RESOLUTION
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/App.tsx` -> Fix the watchdog's `isStillLoading` check and dependency array to prevent false positive triggers when logged out or when loading AuthGateway.
    *   `frontend/src/services/autoHealerAgent.ts` -> Optimize database health monitoring in `ProactiveHealthMonitor.checkSupabase()` to bypass authenticated table queries when no active session exists, preventing anonymous RLS exceptions.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All files under `supabase/migrations/` and `backend/` must remain untouched to prevent database schema regressions.
    *   All other files under `frontend/src/` except `App.tsx` and `autoHealerAgent.ts` must remain untouched.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):** No modifications to data parameters or types. Only frontend logic is altered.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):** No modifications.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:** 
    *   `public.profiles` RLS policies must remain intact.
    *   The watchdog must only trigger when there is an active session and the app is genuinely stuck in a loading/onboarding spinner viewport.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Frontend code compiles with zero errors using `npm run build` or `npx tsc --noEmit` inside the frontend directory.
    2. **Telemetry & Integrity Scans**: Database tests `node scratch/test_null_entity_login.js` and `node scratch/test_partner_onboarding_and_approval.js` run and complete successfully.
    3. **Functional Correctness**: Headless smoke E2E tests run successfully (`node Teach-team-main/scripts/verify_ui_e2e.js`) without console exceptions.
