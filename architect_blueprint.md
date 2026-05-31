# ARCHITECTURAL CONTRACT: PREMIUM WHITE DASHBOARD INTEGRITY
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 👥 MEET YOUR ELITE TECH TEAM
Active Roles for this Action:
1. **Elite Systems Architect (Active)**: Defines structural boundaries, type gates, and aesthetic rulesets. (Anti-Hallucination Firewall).
2. **CTO Debugging Task Force (Pending Ingestion)**: Applies surgical, regression-free micro-patches with safety rollbacks.
3. **SecOps Sentry (Active)**: Audits migrations, restricts credential exposures, and validates RLS.
4. **GitOps Guardian (Active)**: Executes pre-flight scans, production builds, and headless E2E verification before pushing.

---

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/App.tsx` -> Introduce initial auth `isLoadingSession` check to render `FullPageLoader` and eliminate login page flashing.
    *   `frontend/e2e_pilot_validation.js` -> Convert CommonJS imports to ES Modules syntax to resolve Node ESM runtime reference crashes.
    *   `Teach-team-main/scripts/verify_ui_e2e.js` -> Refactor `cwd` configuration to build and run Vite preview servers within the nested `frontend/` directory dynamically.
    *   `frontend/tailwind.config.js` -> Locked to `darkMode: 'class'` to completely disable system OS-level dark theme hijacking.
    *   `frontend/src/components/shared/Navbar.tsx` -> Refactored all drawer, header, bottom nav, and side panel states to white.
    *   `frontend/src/components/admin/PodCommandCenter.tsx` -> Handled modern, light clinical scorecard grids, monospaced tabular metrics, and border outlines instead of circular neon graphs.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All database migrations under `supabase/migrations/` (unless explicitly updating telemetry triggers).
    *   All backend routers, billing webhook handlers, and token resolvers.

---

## 2. CLINICAL PRECISION SYSTEM TOKENS (LIGHT THEME LAW)
All executing agents must strictly follow the *Clinical Precision* design tokens:
*   **Base Canvas Background**: `#F8FAFC` (Tailwind `bg-slate-50` or `#f8fafc`).
*   **Card Surfaces**: `#FFFFFF` (Tailwind `bg-white`).
*   **Dividers / Borders**: 1px solid `#E2E8F0` (Tailwind `border-slate-200/60`).
*   **Headlines Typography**: `font-family: Outfit` (Geometric, clean, modern, administrative style).
*   **Data Density & Labels**: `font-family: Inter` (Clean, sterile body text).
*   **Monospaced Metrics**: `font-family: JetBrains Mono` or tabular figures inside `font-mono text-slate-800` for numerical precision.
*   **Semantic Colors**: Green (`emerald-600` / `#16A34A`), Teal (`teal-600` / `#0D9488`), Amber (`amber-600` / `#D97706`), Red (`rose-600` / `#DC2626`). NO neon or radioactive green glow orbs.

---

## 3. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    No new inputs or APIs are introduced. Existing telemetry and metrics remain intact.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    No new endpoints or database schemas are modified.

---

## 4. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED**: Standard Supabase environment variables.
*   **ACCESS_CONTROL_CONSTRAINTS**: Row-Level Security remains fully enabled. No credentials, tokens, or private keys are allowed in UI configurations.

---

## 5. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
The system is considered functional if and only if:
1. **Type Safety & Build Gates**: Code compiles with zero errors using `npx tsc --noEmit` and passes linting.
2. **Production Build Compilation**: Running `npm run build` succeeds in under 5 seconds with zero fatal build or chunk limit exceptions.
3. **E2E Smoke Verification**: Running `node Teach-team-main/scripts/verify_ui_e2e.js` confirms that the entire clinical Care network mounts and runs cleanly in a headless browser with zero exceptions.
4. **Functional Correctness**: The dashboard renders a beautiful, premium, clean white interface matching Stripe, Linear, or top medical software designs.
