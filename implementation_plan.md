# 🏛️ J.A.R.V.I.S. v6.0 Big Tech Implementation Plan
## Compounder Desk: OPD Queue Header Streamlining & Visual Hierarchy Refinement

### 📋 Overview & Problem Statement
In the Compounder Desk **OPD Queue** tab (`activeTab === 'opd_patients'`), two separate header containers are vertically stacked:
1. **Outer Tab Header (L4330-L4346)**: `"Live Chamber Queue & Tokens"` with subtitle `"Real-time doctor chamber token sequence, vitals clearance, and clinical flow"`.
2. **Inner Card Header (L5027-L5040)**: `"Today's Appointments Queue"` with subtitle `"Active OPD patient token stream, clinical vitals intake, and chamber triage."`
3. **Redundant & Cluttered Print Action (L5044-L5056)**: Contains duplicate printer emojis (`<Printer /> 🖨️ Print OPD Register (PDF)`), cluttering the active consultation triage workspace.

### 🎯 Optimization Goals
1. **Eliminate Word & Header Duplication**: Remove the redundant inner `<h2>` and repetitive phrasing ("Queue", "Tokens", "Chamber", "Appointments").
2. **Google/Meta-Tier Executive Command Ribbon**:
   - Title: **"OPD Chamber Flow"** with live CDC indicator (`● Live Chamber Sync`) and clean pill badge (`{activeOpdAppointments.length} Active Patients`).
   - Clean, purposeful subtitle without generic AI filler words.
3. **Integrated Segmented View Switcher**:
   - Embed the `Today's Stream` vs `Advance Bookings` switcher directly into the operational strip.
   - Retain fast `Export CSV` with sleek Google-tier styling.
4. **Relocate Print Register to More Hub**:
   - Remove the cluttered `Print OPD Register` button and double printer emoji from the active queue header.
   - Canonical home is verified in More Hub (`more_hub` -> Tile 4: **Clinical Print Center** with dedicated 1-tap PDF generation).

---

### 📂 Proposed File Changes

#### [MODIFY] `frontend/src/components/compounder/CompounderDashboard.tsx`
- **Lines 4330-4390**: Refine outer tab header into the unified **"OPD Chamber Flow"** executive control bar with real-time status and quick links.
- **Lines 5027-5070**: Replace duplicate inner header with an integrated segmented control bar (`Active Today` vs `Scheduled Advance`) and clean export tool. Remove the duplicate `Print OPD Register` button.

---

### 🛡️ Safety & Verification Strategy
- **Rule 1.8 & Rule Zero Guard**: Eagle-Eye OCR, Prescription Scanning, and CDC sync remain 100% untouched.
- **Defensive Access**: All array counts (`activeOpdAppointments.length`, `upcomingAppointments.length`) guarded defensively.
- **Compiler Gate**: Run `npx tsc --noEmit` and verify Exit Code 0.
- **Daemon Bridge Sync**: Shadow compile and update memory vault at port 9000.