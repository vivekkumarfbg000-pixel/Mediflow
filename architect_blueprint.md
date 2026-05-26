# ARCHITECTURAL CONTRACT: RESOLUTION OF COMPILE-TIME JSX SYNTAX ERRORS IN COMPOUNDER DASHBOARD
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:**
    *   `src/components/compounder/CompounderDashboard.tsx` -> Correct JSX element nesting mismatch by properly closing the `<div className="glass-panel p-6 border-white/10 shadow-xl space-y-5">` element inside the `billingPatient` conditional check preceding the ternary else block.
*   **FORBIDDEN_FILES (NO-FLY ZONES):**
    *   `tech-team/` -> Maintained as read-only.
    *   `src/services/` -> Core backend simulation wrappers are 100% stable.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):**
    *   Preserve all active states (`billingPatient`, `billingItems`, `apptCounterBooked`, `labCounterBooked`, `deliveryType`).
*   **OUTGOING_DATA_SHAPE (OUTPUTS):**
    *   Syntactically flawless JSX returning a fully valid compounder React component.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:**
    *   Maintain active patient checking isolation boundaries to prevent unauthorized user routing switches.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Code compiles with zero errors using `npm run build` (`tsc -b && vite build`).
    2. **E2E Smoke Verification**: Standard offline simulated loops and live integrations run error-free (`node e2e_pilot_validation.cjs`).
