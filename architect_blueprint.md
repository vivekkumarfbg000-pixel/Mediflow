# ARCHITECTURAL CONTRACT: GLOBAL SYSTEM RELIABILITY, CRASH PREVENTION, AND PRODUCTION READY COMPILATION
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:**
    *   `frontend/src/components/shared/Navbar.tsx` -> Integrated dynamic specialization steppers and role re-labeling.
    *   `frontend/src/components/compounder/CompounderDashboard.tsx` -> Realigned dashboard header section layout hierarchy and mapped eye vitals.
*   **FORBIDDEN_FILES (NO-FLY ZONES):**
    *   `Teach-team-main/` -> Elite automated validation toolkit scripts must remain unaltered and read-only.
    *   `backend/app/main.py` -> Direct FastAPI endpoint configurations and simulation fallback frameworks are locked and stable.
    *   `supabase/schema.sql` -> Database constraints, user tables, and RLS policy configurations are immutable.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    ```typescript
    export interface EyeRefraction {
      sph: string;
      cyl: string;
      axis: string;
      add: string;
    }

    export interface RefractionRx {
      od: EyeRefraction;
      os: EyeRefraction;
      pd: string;
      lensType: 'Single Vision' | 'Bifocal' | 'Progressive' | 'Contact Lens';
      notes: string;
    }

    export interface EyeVitals {
      visualAcuityOD: string;
      visualAcuityOS: string;
      visualAcuityAidedOD?: string;
      visualAcuityAidedOS?: string;
      iop: string;
      recordedAt: string;
    }
    ```
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    ```typescript
    // Serialized structured JSON block embedded inside standard GP database fields
    // Boundaries: ---REFRACTION_RX_START--- and ---REFRACTION_RX_END---
    ```

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:**
    *   `VITE_SUPABASE_URL` -> Supabase server host location.
    *   `VITE_SUPABASE_ANON_KEY` -> Web socket and real-time CDC communication authentication key.
*   **ACCESS_CONTROL_CONSTRAINTS:**
    *   Enforce absolute Row-Level Security (RLS) policies isolating clinical tenants and active patient care-loops by pod.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Frontend bundle compiles with zero errors using `npm run build` (`tsc -b && vite build`) and backend py-compile reports success on `main.py`, `router.py`, and `scheduler.py`.
    2. **SecOps Security Scans**: Running `node Teach-team-main/scripts/security_taint_check.js` confirms zero hardcoded API secrets, RLS leakage, or injection weaknesses.
    3. **Database & Sandbox Integrity**: Running `node Teach-team-main/scripts/verify_db_sandbox.js` compiles all 12 schema migrations sequentially with zero parsing issues.
    4. **GitOps E2E Smoke Verification**: Running `node ../Teach-team-main/scripts/verify_ui_e2e.js` from `frontend` compiles the production static distribution crawler successfully and confirms DOM mounting integrity.
