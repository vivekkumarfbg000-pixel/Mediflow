# ARCHITECTURAL CONTRACT: PROFESSIONAL LANDING WEBSITE & ROUTING
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/components/shared/LandingPage.tsx` -> [NEW] Implement the new premium public landing website.
    *   `frontend/src/App.tsx` -> [MODIFY] Mount the `LandingPage` component for unauthenticated sessions.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All files under `supabase/migrations/` and `backend/` must remain untouched to prevent database schema regressions.
    *   All other files under `frontend/src/` except `App.tsx` and `LandingPage.tsx` must remain untouched.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):** No modifications to data parameters or types. Only frontend elements are added.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):** No modifications.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:** 
    *   `public.profiles` RLS policies must remain intact.
    *   Unauthenticated users must see the landing page and the integrated `<AuthGateway>` inline login form.
    *   Once a user has a valid authenticated session, the app must route them directly to their dashboard.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Frontend code compiles with zero errors using `npm run build` or `npx tsc --noEmit` inside the frontend directory.
    2. **Telemetry & Integrity Scans**: Database tests `node scratch/test_null_entity_login.js` and `node scratch/test_partner_onboarding_and_approval.js` run and complete successfully.
    3. **Functional Correctness**: Headless smoke E2E tests run successfully (`node Teach-team-main/scripts/verify_ui_e2e.js`) without console exceptions, verifying that the new landing page compiles and mounts.
