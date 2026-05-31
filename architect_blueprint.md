# ARCHITECTURAL CONTRACT: SUPABASE ENVIRONMENT RESILIENCY & LOADING RECOVERY
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 👥 MEET YOUR ELITE TECH TEAM
Active Roles for this Action:
1. **Elite Systems Architect (Active)**: Defines structural boundaries, type gates, and security parameters. (Anti-Hallucination Firewall).
2. **CTO Debugging Task Force (Pending Ingestion)**: Applies surgical, regression-free micro-patches with safety rollbacks.
3. **SecOps Sentry (Active)**: Audits migrations, restricts credential exposures, and validates RLS.
4. **GitOps Guardian (Active)**: Executes pre-flight scans, production builds, and headless E2E verification before pushing.

---

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/lib/supabaseClient.ts` -> Provide public-facing fallback credentials for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to guarantee that the application never throws uncaught configuration crashes in Vercel or preview environments where environmental injections are not pre-configured.
    *   `frontend/public/sw.js` -> Locked (caching loops resolved).
    *   `backend/Dockerfile` -> Locked (permissions resolved).
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All database migrations under `supabase/migrations/` and `supabase/combined_upgrade.sql`.
    *   All application routers, controllers, frontend views, or database triggers.

---

## 2. PRODUCTION HEALTH AND RUNTIME GUARANTEES
All executing agents must strictly follow the *Clinical Precision* and *Deployment Resiliency* standards:
*   **Fallback Configuration Resiliency**: The public Supabase key and API URL are public-facing frontend keys and are safe to bundle. Providing standard public fallbacks is the correct and reliable way to ensure 100% startup compliance without throwing fatal errors.
*   **Zero Startup Exceptions**: The client application must boot completely into #root, mount successfully in the DOM, and load the auth gateway page rather than halting mid-bootstrap due to configuration assertions.

---

## 3. DATA CONTRACT & TYPE INTEGRITY
*   No changes to schemas or data contracts are permitted.

---

## 4. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED**: Fallbacks are provided, but active keys will still override if present.
*   **ACCESS_CONTROL_CONSTRAINTS**: Row-Level Security remains fully enabled on all tables.

---

## 5. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
The system is considered functional if and only if:
1. **Type Safety & Build Gates**: Frontend compiles with zero errors using `npx tsc --noEmit` and passes linting using `npm run lint`.
2. **Production Build Compilation**: Running `npm run build` inside `frontend/` succeeds with zero errors.
3. **E2E Smoke Verification**: Running `node Teach-team-main/scripts/verify_ui_e2e.js` confirms that the entire clinical Care network mounts and runs cleanly in a headless browser with zero exceptions.
4. **Functional Correctness**: The app loads flawlessly under the Vercel production hosting url, booting to the authentic auth gateway page without throwing fatal configuration errors in the browser console.
