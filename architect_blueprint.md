# ARCHITECTURAL CONTRACT: HUGGING FACE BACKEND DEPLOYMENT & VERCEL PWA LOADING RECOVERY
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
    *   `backend/Dockerfile` -> Fix Hugging Face Space non-root permission crash by pre-creating the `/app/tmp` directory, setting ownership to `mediflow`, and granting broad read/write permissions to allow dynamic UID operations.
    *   `frontend/public/sw.js` -> Fix Vercel production crash (blank page) by:
        1. Eliminating development source files (`/src/...`) from `ASSETS_TO_CACHE`.
        2. Implementing a robust **Network-First** caching strategy for HTML/navigation requests to guarantee users fetch the latest hashed production assets when online.
        3. Adding defensive check to intercept and bypass caching for `.js`/`.css` asset fetches that return Vercel's rewritten `text/html` index page (indicating a deleted/missing hashed asset 404).
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All database migrations under `supabase/migrations/` and `supabase/combined_upgrade.sql`.
    *   All application routers, controllers, frontend views, or database triggers.

---

## 2. PRODUCTION HEALTH AND RUNTIME GUARANTEES
All executing agents must strictly follow the *Clinical Precision* and *Deployment Resiliency* standards:
*   **Zero Syntax Violations**: The service worker `sw.js` is served natively as standard ES5/ES6 JavaScript to client browsers. ABSOLUTELY NO TypeScript type annotations (e.g. `: any`, `: string`) are allowed inside this file, as they will cause direct syntax parser crashes in the browser.
*   **Isolation of Upload Buffers**: In Hugging Face Spaces, write operations can only safely target isolated directories with permissive ACLs. The `./tmp/` upload buffer path must be pre-allocated and granted `chmod -R 777` permissions inside the container to avoid `PermissionError` blockages when processing OCR/Voice payloads.
*   **Deterministic SPA Fallbacks**: Any asset request that returns `text/html` instead of the requested mime-type (`application/javascript`, `text/css`) must be rejected at the service worker gate to avoid corrupting browser script executions with HTML strings.

---

## 3. DATA CONTRACT & TYPE INTEGRITY
*   No new APIs, parameters, or database schemas are introduced. All existing contracts, types, and REST schemas remain intact.

---

## 4. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED**: Standard Supabase credentials.
*   **ACCESS_CONTROL_CONSTRAINTS**: Row-Level Security remains fully enabled. No secrets or administrative keys are committed to Git.

---

## 5. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
The system is considered functional if and only if:
1. **Type Safety & Build Gates**: Frontend compiles with zero errors using `npx tsc --noEmit` and passes linting using `npm run lint`.
2. **Production Build Compilation**: Running `npm run build` inside `frontend/` succeeds with zero errors.
3. **E2E Smoke Verification**: Running `node Teach-team-main/scripts/verify_ui_e2e.js` confirms that the entire clinical Care network mounts and runs cleanly in a headless browser with zero exceptions.
4. **Functional Correctness**: The app loads flawlessly under any environment (localhost or Vercel production hosting) and the service worker operates resiliently without throwing syntax or asset-caching errors.
