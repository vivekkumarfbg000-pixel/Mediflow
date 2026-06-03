# 🎓 Developer Guide: TSX Compile Resolution, Color Contrast, & High-End Aesthetics
> **MEDIFLOW CORE DEVELOPMENT MANUAL:** This guide details standard operating procedures for resolving common compilation errors, fixing visual readability (contrast) issues, and applying elite design principles to product widgets.

---

## 🛠️ Part 1: Resolving TSX/JSX Compilation & Bracket Errors

### The Incident: Vite/Oxc Parse Error
A typical build block error is:
```bash
[plugin:vite:oxc] Transform failed with 1 error:
[PARSE_ERROR] Expected `}` but found `Identifier` at src/components/compounder/CompounderDashboard.tsx:3626:39
3626 |                     Grant Consent (Aarav Sharma)
     |                     ^^^^^^^^^^^^^^ expected `}`
```

### Why it Happens:
In TSX/JSX, code inside return blocks alternates between **HTML-like tags** and **JavaScript expressions** evaluated inside curly braces `{}`. 
This error occurs when you write plain text directly inside a JavaScript evaluation context, or leave a curly brace unclosed.

### Wrong vs. Correct Code Patterns:

❌ **WRONG: Evaluated context containing raw string text**
```tsx
return (
  <div>
    {activePatient && (
      <div>
        {/* The parser expects a JS identifier or closed brace here, not raw text */}
        {activePatient.name} (Active Patient)
      </div>
    )}
  </div>
);
```

✔️ **CORRECT: Grouped text inside tag elements or JS template strings**
```tsx
return (
  <div>
    {activePatient && (
      <div>
        {/* CORRECT: Text is enclosed in HTML tags or template literal */}
        <span>{activePatient.name} (Active Patient)</span>
      </div>
    )}
  </div>
);
```

### How to Fix Mismatched Brackets & Elements:
1. **Element Locking**: Always close every JSX element: `<Card>...</Card>` or self-closing `<Card />`.
2. **Conditional Braces**: For every `{` opened to run JavaScript logic, verify that there is a matching `}` immediately after the statement.
3. **IDE Linters**: Enable ESLint extension inside VSCode/Cursor to underline syntax errors instantly in red before compiling.

---

## 🎨 Part 2: WCAG Color Contrast & Gradient Design Standards

### The Rule of Legibility:
Text elements must be clearly visible under any ambient light setting. Having light-colored text (e.g. white, light gray, cyan-200) on top of light gradients or light panels causes eye strain and fails WCAG AA contrast standards.

### Correct Contrast Color Mapping System:

| Accent Mode | Background Class | Text Class | Border Class |
| :--- | :--- | :--- | :--- |
| **Normal / Info** | `bg-indigo-50/50` | `text-indigo-800` | `border-indigo-150` |
| **Warning / Action**| `bg-amber-50` | `text-amber-900` | `border-amber-200` |
| **Critical / Alert**| `bg-rose-50` | `text-rose-800` | `border-rose-200` |
| **Success** | `bg-emerald-50` | `text-emerald-700` | `border-emerald-200` |
| **Neutral Card** | `bg-slate-50` | `text-slate-800` | `border-slate-200` |

### Case Study: High-Contrast Gradient Panels

❌ **POOR CONTRAST (Fails WCAG):**
```tsx
<div className="bg-gradient-to-br from-indigo-500 to-indigo-100 p-4">
  {/* The white text is illegible on the light purple gradient background */}
  <p className="text-slate-200">Patient Biomarker Trajectory</p>
</div>
```

✔️ **HIGH CONTRAST & PREMIUM (WCAG Compliant):**
```tsx
<div className="bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 p-4 rounded-xl">
  {/* Text is dark and readable, drawing attention with harmonious accent colors */}
  <p className="text-indigo-800 font-bold text-xs uppercase tracking-wide">
    Patient Biomarker Trajectory
  </p>
  <span className="text-slate-700 font-medium text-xs mt-1 block">
    Creatinine: 1.2 mg/dL
  </span>
</div>
```

---

## 💎 Part 3: Premium Aesthetics & Micro-interactions

A professional SaaS dashboard should feel alive, snappy, and premium. Follow these rules when designing components:

### 1. Glassmorphism & Backdrop Blurs
For modals or floating control bars, use soft translucent borders and backdrop blurs to establish clear visual depth.
*   **Modal Overlay**: `bg-slate-900/40 backdrop-blur-md`
*   **Translucent Cards**: `bg-white/90 border border-slate-250/60 shadow-[0_4px_24px_rgba(0,0,0,0.02)]`

### 2. Snappy Micro-animations
Use transitions on all hover states to make buttons and cards feel responsive.
*   **Scale Hover**: `transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]`
*   **Soft Glow**: `hover:shadow-md hover:shadow-indigo-500/5 hover:border-indigo-200`

### 3. Typography Rhythm
Avoid browser default font weights. Ensure labels are distinct.
*   **Header labels**: `font-bold text-slate-900 leading-tight uppercase text-xs tracking-wider`
*   **Secondary details**: `font-medium text-slate-650 text-[11px]`
*   **Data indicators**: `font-mono font-semibold`

---

## 🔒 Part 4: Compliance Lock & Patient Consent Lifecycle

Clinical records, diagnostics ordering, and prescribing are locked behind a **Compliance Lock** if the patient's data processing consent is missing or expired (older than 30 days).

### Consent Architecture:
1. **WhatsApp Simulator Flow:** The patient receives a consent opt-in request on WhatsApp. Replying **"1"** invokes the WhatsApp session handler, registering the row inside `public.patient_consents`.
2. **Physical Consent Override (Bypass):** In clinical dashboards, a **"Grant Physical Consent (Bypass)"** button is provided on the lock screen. Clicking this runs `api.grantInPersonConsent(patientId)` which immediately inserts a consent record into Supabase or updates local storage cache `active_consent_ids`.
3. **State Syncing:** Both actions fire `api.notify()`, triggering React subscribers to automatically remove the visual Compliance Lock overlay in under 100ms.

---

## ⚙️ Part 5: DevSecOps Verification Pipeline

Before pushing code:
1.  **Run Type Checks Locally**: 
    ```bash
    npm run build
    ```
2.  **Verify Database Schema Alignments**: Look for schema exceptions in the debug console or the Auto-Healer telemetry dashboard.
3.  **Perform Git Audit**: Ensure no credentials or keys are written into components. Expose configuration variables exclusively using Supabase Edge Secret managers.
