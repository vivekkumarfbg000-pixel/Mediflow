# ARCHITECTURAL CONTRACT: PROFILES TABLE RLS HARDENING & LOGIN BLOCK RESOLUTION
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `supabase/migrations/20260605000003_harden_profiles_self_access_rls.sql` -> Drop/re-create public.profiles SELECT policy and add UPDATE policy.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All files under `frontend/src/` (except verification script executions) and `backend/` must remain untouched to prevent collateral regressions.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):** No modifications to data parameters or types. Only SQL schema rules are altered.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):** No modifications.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:** 
    *   `public.profiles` SELECT policy must allow `id = auth.uid() OR entity_id IN (SELECT id FROM public.entities WHERE pod_id = public.get_user_pod()) OR public.is_platform_admin()`.
    *   `public.profiles` UPDATE policy must allow `id = auth.uid() OR public.is_platform_admin()`.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Frontend code compiles with zero errors using `npm run build` or `npm run typecheck`.
    2. **Telemetry & Integrity Scans**: Running `node scratch/check_all_rls.js` confirms the new policies are correctly active.
    3. **Functional Correctness**: A newly signed-up user with `entity_id = null` can successfully retrieve their profile via the Supabase client and can successfully log in.
