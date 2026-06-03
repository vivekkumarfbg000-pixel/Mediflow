# ARCHITECTURAL CONTRACT: CLINICAL AI WIDGET COLOR CONTRAST REFACTOR
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES
*   **TARGET_FILES_TO_EDIT:** 
    *   `frontend/src/components/doctor/tabs/ConsultationTab.tsx` -> Correct contrast issues in the AI Predictive Lab Pattern card.
    *   `frontend/src/components/doctor/OphthalmologyPatientAnalysisPanel.tsx` -> Correct contrast issues in the Ophthalmic Analysis modal.
*   **FORBIDDEN_FILES (NO-FLY ZONES):** 
    *   All files under `backend/`, `supabase/`, and core configurations like `vite.config.ts` or `tailwind.config.js`.

## 2. DATA CONTRACT & TYPE INTEGRITY
*   **INCOMING_DATA_SHAPE (INPUTS):** No modifications to data parameters or types. Only style rules are altered.
*   **OUTGOING_DATA_SHAPE (OUTPUTS):** No modifications.

## 3. SECURITY & POLICY ENVIRONMENT
*   **ENVIRONMENT_VARIABLES_REQUIRED:** None.
*   **ACCESS_CONTROL_CONSTRAINTS:** None.

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)
*   The system is considered functional if and only if:
    1. **Type Safety & Build Gates**: Code compiles with zero errors using `npx tsc --noEmit` or `npm run build`.
    2. **Contrast and Visibility Compliance**: All text elements in the AI Analyzer card and modal (headings, list items, description summaries, risk pills) use dark, high-contrast colors (`text-slate-800`, `text-slate-700`, etc.) that are readable on light theme backgrounds.
