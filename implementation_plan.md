# 🏛️ J.A.R.V.I.S. v6.0 Big Tech Implementation Plan
## Compounder Desk: OPD Header Streamlining & Pathology Dashboard Crash / Access Fix

### 📋 Overview & Problem Statement
1. **OPD Header Clutter**: The `[👥 EHR Registry →]` and `[📖 SOPs]` shortcut buttons in the `OPD Chamber Flow` top ribbon are completely redundant because EHR Registry and SOPs are already canonically housed in the **More Hub** bottom dock.
2. **Pathology Dashboard Access & Rendering Failure**:
   - In `CompounderDashboard.tsx`, `<ClinicalHubTab />` is lazily mounted without an `<ErrorBoundary>`, leaving it vulnerable to silent white-screens.
   - In `ClinicalHubTab.tsx`, `report.biomarkerJson` parsing does not defend against stringified JSON or null values, causing runtime `TypeError` crashes during render.
   - In `Navbar.tsx`, `allowedRolesMap['compounder']` excludes `'lab'`, preventing clinical staff from switching to the full dedicated Pathology Laboratory Console (`LabDashboard.tsx`).

---

### 🎯 Optimization Goals
1. **Purge Redundant OPD Header Shortcuts**: Remove `[👥 EHR Registry →]` and `[📖 SOPs]` from the `OPD Chamber Flow` header ribbon in `CompounderDashboard.tsx`.
2. **Defensive Pathology Rendering**:
   - Harden biomarker JSON parsing in `ClinicalHubTab.tsx` with `try/catch` and defensive object coercion.
   - Wrap `<ClinicalHubTab />` in `CompounderDashboard.tsx` with `<ErrorBoundary fallbackTitle="Diagnostic Pathology Hub">`.
3. **Pathology Role Map Permission**:
   - Add `'lab'` to `allowedRolesMap['compounder']`, `receptionist`, and `staff` in `Navbar.tsx` so staff can open both the quick Pathology worklist tab and switch into the full Pathology Console.

---

### 📂 Proposed File Changes

#### 1. [MODIFY] `frontend/src/components/compounder/CompounderDashboard.tsx`
- **Lines 4348-4380**: Remove redundant `[EHR Registry →]` and `[SOPs]` buttons. Retain only `← Chamber Flow` when drilled down into a subtab.
- **Lines 5811-5821**: Wrap `<ClinicalHubTab />` in `<ErrorBoundary fallbackTitle="Diagnostic Pathology Hub">`.
- **Imports**: Import `ErrorBoundary` from `../shared/ErrorBoundary`.

#### 2. [MODIFY] `frontend/src/components/compounder/tabs/ClinicalHubTab.tsx`
- **Lines 196-245**: Harden `report.biomarkerJson` parsing against stringified JSON, null, and non-object shapes. Ensure all array and object iterations are guarded defensively.

#### 3. [MODIFY] `frontend/src/components/shared/Navbar.tsx`
- **Lines 378-380**: Add `'lab'` to `allowedRolesMap['compounder']`, `receptionist`, and `staff`.

---

### 🛡️ Safety & Verification Strategy
- **Rule 1.8 & Rule Zero Guard**: Eagle-Eye OCR, Prescription Scanning, and CDC sync remain 100% untouched.
- **Defensive Access**: Every biomarker access and report property defensively guarded.
- **Compiler Gate**: Run `npx tsc --noEmit` and verify Exit Code 0.
- **Daemon Bridge Sync**: Shadow compile and update memory vault at port 9000.