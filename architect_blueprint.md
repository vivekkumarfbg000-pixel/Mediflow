# ARCHITECTURAL CONTRACT: Clean Bright (Light Theme) Visual Refresh + Synthetic Profile Manager
> **CRITICAL NOTICE TO EXECUTING AGENTS:** This document is immutable law. Any code modification that violates the boundaries, data shapes, or security guardrails defined below will cause an immediate system rejection and code revert.

## 1. COMPONENT & REPOSITORY BOUNDARIES

### TARGET_FILES_TO_EDIT
| File | Status | Action |
|---|---|---|
| `frontend/src/components/shared/LandingPage.tsx` | ✅ COMPLETE | Light theme canvas — white bg, dark slate/indigo particles |
| `frontend/src/components/shared/AuthGateway.tsx` | ✅ COMPLETE | All form flows restyled to white/slate light theme; corrupted JSX repaired |
| `frontend/src/components/billing/BillingDashboard.tsx` | ✅ COMPLETE | All `text-clinical-*` / `bg-surface-container*` replaced with slate equivalents |
| `frontend/src/components/admin/SaaSAdminPanel.tsx` | ✅ PATCHED | Refactored to top-nav layout; stats cards restored; Synthetic Profile Manager added |
| `frontend/src/components/admin/SystemHealthCockpit.tsx` | ✅ PATCHED | Fault Injection panel removed; stale telemetry auto-cleanup on mount |
| `frontend/src/services/api.ts` | ✅ PATCHED | Added `generateSyntheticProfiles`, `getSyntheticProfiles`, `deleteSyntheticProfile`, `clearAllSyntheticProfiles` |
| `frontend/src/types/index.ts` | ✅ PATCHED | Added `SyntheticProfile` interface |

### FORBIDDEN_FILES (NO-FLY ZONES)
- All files under `supabase/migrations/` — **MUST REMAIN UNTOUCHED**
- All backend application files (`backend/app/**`)
- `frontend/src/lib/supabaseClient.ts` — auth config must not change
- `frontend/src/App.tsx` — routing rules must not change

---

## 2. DATA CONTRACT & TYPE INTEGRITY

### INCOMING_DATA_SHAPE
```typescript
// SyntheticProfile — defined in frontend/src/types/index.ts
interface SyntheticProfile {
  id: string;                         // "synth-{timestamp}-{index}-{random}"
  name: string;                       // "Priya Sharma"
  role: 'doctor' | 'compounder' | 'pharmacist' | 'lab_tech' | 'admin';
  email: string;                      // "priya.sharma0@mediflow-demo.in"
  associatedActivityMetric: {
    interactionsCount: number;        // 5..205
    lastActive: string;               // ISO datetime
  };
  createdAt: string;                  // ISO datetime
  isSynthetic: true;                  // discriminator literal
}
```

### OUTGOING_DATA_SHAPE
No API changes. All synthetic profiles are stored in **localStorage only** (`key: 'synthetic_profiles'`). They do not touch Supabase or any real user tables.

---

## 3. SECURITY & POLICY ENVIRONMENT

### ENVIRONMENT_VARIABLES_REQUIRED
None for frontend theme changes.

### ACCESS_CONTROL_CONSTRAINTS
- **Synthetic Profile Manager** is gated behind the admin role check (`isAdmin === true`) in `SaaSAdminPanel.tsx`.
- Synthetic profiles are MOCK DATA only — they never touch `public.profiles`, `public.pods`, or any Supabase table.
- Authentication and dashboard routing rules in `App.tsx` remain **100% unchanged**.
- Supabase RLS policies on `public.profiles`, `public.pods`, and `public.entities` are **untouched**.
- The `auto_healer` now reads `GROQ_API_KEY || VITE_GROQ_API_KEY` — no new secrets introduced.

---

## 4. VERIFICATION METRICS (THE DEFENSIVE PASS CRITERIA)

| # | Gate | Status |
|---|---|---|
| 1 | Vite Dev Server — zero error overlay on `http://localhost:5173` | ✅ PASSING |
| 2 | TypeScript — `npx tsc --noEmit` inside `/frontend` returns exit code 0 | 🔲 Pending |
| 3 | Contrast — All body text ≥ 4.5:1 on #FFFFFF canvas | ✅ Verified |
| 4 | AuthGateway — All flows render light-themed with white inputs | ✅ Verified |
| 5 | BillingDashboard — No `text-clinical-*` or `bg-surface-container*` tokens remain | ✅ Fixed |
| 6 | SaaSAdminPanel — Onboarding stats cards + Synthetic Profile Manager render without ReferenceError | ✅ Fixed |
| 7 | Synthetic Profile API — all 4 methods exist in `api.ts` and are typed | ✅ Added |
| 8 | No regression — All dashboards load without runtime errors | ✅ Dev server clean |
