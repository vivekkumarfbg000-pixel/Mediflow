# 🗺️ VitalSync Mediflow Master Evolution Plan: J.A.R.V.I.S God-Tier (Phase 2 & 3)

## 🎯 Strategic Objective
We are upgrading J.A.R.V.I.S from a high-speed text aggregator into a **Mathematically Precise AI Engineer** (AST) and a **Relentless QA Automation Suite** (Playwright).

---

## 🧪 Phase 2: Engine 12 — Playwright E2E Automation (The QA Sentinel)
Right now, J.A.R.V.I.S. gathers the DOM, but it cannot actively verify if a fix actually works. We will build an autonomous QA pipeline.

### The Implementation:
1. **Initialize Playwright**: Install `@playwright/test` into the `frontend/` directory.
2. **The Clinic Loop Spec**: Write a master `clinic-os-loop.spec.ts` test that programmatically:
   - Logs in as a Doctor.
   - Registers a virtual patient via the Compounder desk.
   - Verifies the Token is assigned.
   - Verifies WhatsApp integration hooks don't throw 500 errors.
3. **Daemon Bridge Integration**: Create an endpoint `POST /api/run-e2e` inside `daemon-bridge.cjs`.
4. **Dashboard Button**: Wire up the "E2E Tests" button on the `PromptGuardDashboard` to trigger this endpoint and stream the results back via SSE (Server-Sent Events) in real-time.

### 🏁 Deliverable
Before any code is ever merged, you click a button and J.A.R.V.I.S physically simulates a 3-minute clinic shift in 3 seconds to guarantee Rule Zero is intact.

---

## 🌳 Phase 3: Engine 11 — AST Code Surgery (The Precision Scalpel)
Right now, J.A.R.V.I.S (Engine 7) uses simple line-number guessing (`lines.slice(start, end)`) to extract code snippets. If a file changes, line numbers shift and it extracts the wrong block.

### The Implementation:
1. **Babel / SWC Integration**: Install `@babel/parser` or `typescript` compiler API inside the Daemon Bridge.
2. **Abstract Syntax Tree (AST) Parsing**: When a bug is reported in a component (e.g., `CompounderDashboard.tsx`), the daemon parses the file into an AST graph.
3. **Symbol Extraction**: Instead of asking for "Lines 45-90", J.A.R.V.I.S searches the AST for the exact function signature `function saveVitals()` and extracts the exact boundaries down to the closing curly brace `}`.

### 🏁 Deliverable
J.A.R.V.I.S will feed Antigravity mathematically perfect code blocks. This guarantees that Antigravity's `multi_replace_file_content` edits will NEVER fail due to "Target Content Not Found".

---

## ⚡ Execution Strategy
Which phase should we begin executing right now?
- **Option A:** Start building **Phase 2 (Playwright E2E)**.
- **Option B:** Start building **Phase 3 (AST Surgery)**.