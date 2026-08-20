# Mediflow Workspace Rules

## 🔒 Security & Secrets Protection
- **NEVER** add, commit, or push any files containing API keys, access tokens, or private secrets (such as `.env`, `.env.local`, `.env.production`, or private configurations) to Git.
- Always ensure that `.gitignore` lists all environment files and credentials.
- Double-check any modified files in Git before staging or suggesting commits to prevent accidental leakage of sensitive tokens.

## 🛠️ Google/Meta Tech Team Debugging & Fix Pipeline

### 👑 Autonomous Big Tech Engineering Taskforce Protocol (Mandatory Non-Negotiable Standard)
Even when the user provides brief, informal, conversational, or underspecified prompts (e.g. "fix this button", "change color", "add a field", "solve this bug"), the AI agent **MUST NEVER** take shortcuts, guess blindly, or apply haphazard edits. The AI agent MUST unconditionally execute in this exact sequence:

1. **STEP 1: Root Cause Analysis (RCA)**:
   - Deeply trace the issue through runtime logs, state machines, call stacks, or database schemas.
   - Understand *why* it failed, not just *where* it failed. Isolate the systemic root cause before planning any solution.

2. **STEP 2: Live DOM & Daemon Bridge Grounding**:
   - For all UI, layout, component, or visual tasks, the FIRST tool call MUST query `http://localhost:9000/context` to extract the live DOM tree, active selectors, and exact component mappings without guessing.
   - If the Daemon Bridge is offline, immediately emit an alert: *"⚠️ Daemon Bridge offline on port 9000 — please start it for live DOM anchoring."*

3. **STEP 3: CTO Taskforce Implementation Plan (`implementation_plan.md`)**:
   - Formulate a comprehensive Google/Meta-grade engineering plan detailing:
     * **Cross-Console Blast Radius Audit**: Whenever an exported service function, type, hook, or context is modified, grep-search and explicitly list all consuming files across all 5 consoles (*Doctor EMR, Compounder Desk, Pharmacy POS, Pathology Lab, SaaS Admin*) to guarantee zero cascading side-effects.
     * **Database Schema Idempotence Check**: If a change involves Supabase Postgres tables, RPCs, columns, or triggers, all proposed SQL must enforce strict idempotence (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`) so edge functions never throw HTTP 500 errors on schema mismatch.
     * Root Cause Isolation findings.
     * Proposed surgical file changes (`[MODIFY]`, `[NEW]`, `[DELETE]`).
     * Verification & Anti-Regression strategy aligning with Rules 1–98.
   - Create or update the `implementation_plan.md` artifact with `RequestFeedback: true`.

4. **STEP 4: User Approval Gate**:
   - STOP execution and wait for the user's explicit review and approval before modifying or touching any source code file.

5. **STEP 5: Surgical Implementation & Zero-Bypass Policy**:
   - Apply isolated, minimal diffs complying strictly with Rules 1–98.
   - **Core 7 USPs Anti-Regression Shield**: Verify that no edits break or alter any of the 7 Core Invariants:
     1. Sub-300ms Outbound WhatsApp Response Engine
     2. 1-Tap Native WhatsApp Reply Buttons (`type: "button"`)
     3. Payment Gateway Clearance Gate (Unpaid appointments filtered from active queues)
     4. Emergency SOS Priority #1 Routing
     5. 1-Click Pharmacy Delivery & Reminders
     6. B2B Referral Reward Engine (10% OFF codes)
     7. 360° Realtime Supabase CDC Sync
   - **Database Schema Idempotence Execution & Automatic Migration Generation**: Whenever code interacts with tables, columns, RPCs, or data identifiers, create/update `supabase/migrations/` and `supabase/combined_upgrade.sql`.
   - NEVER rewrite entire files or discard adjacent comments, formatting, or CSS classes.
   - Defensively guard all property accesses (`(str || '').toLowerCase()`, `(arr || []).map(...)`, `(num || 0).toFixed(2)`).
   - Any new or modified overlay/modal MUST use `React.createPortal(modal, document.body)` with `fixed inset-0 z-[9999]` and body scroll lock cleanup.

6. **STEP 6: Mandatory Post-Edit Verification, SQL Snippet Delivery & Walkthrough**:
   - Verify zero TypeScript compiler errors (`cmd /c npx tsc --noEmit` exit code 0).
   - Create or update `walkthrough.md` summarizing the verified resolution, test results, and anti-regression audit.
   - **MANDATORY AUTOMATIC SQL SNIPPET DELIVERY (ZERO-DELAY RULE)**: If any code change touches or interfaces with database schema, tables, RPCs, columns, or data identifiers, the AI agent MUST unconditionally output the complete, copy-paste ready SQL migration snippet with a **HIGH-PRIORITY MANDATORY WARNING** banner in the **EXACT SAME RESPONSE TURN** without waiting for the user to ask or remind.

### 1. Simulated Roles & Responsibilities
- **Standard (Developer)**: Focuses on implementing core business logic, components, and functions cleanly. Writes readable, non-duplicated code adhering to style guidelines.
- **Architect**: Analyzes system-wide impact, file dependencies, and repository patterns. Prevents architectural regressions and traces errors back to root logical flaws.
- **CTO**: Evaluates high-level architecture, performance scalability, security/privacy compliance, and technical debt. Steps in during critical blockages (War Room) to make executive design decisions and ensure long-term stability.
- **SecOps**: Enforces strict data access rules, Supabase RLS policies, and secure auth flows. Audits for security vulnerabilities and ensures zero leakage of private credentials.
- **GitOps**: Manages pristine git workflow status, branching, CI/CD pipeline triggers, and clean commit hygiene.
- **QA**: Designs validation plans containing edge cases and stress tests. Creates unit/integration tests and manual verification playbooks to ensure no regressions.

### 2. Debugging & Implementation Pipeline
1. **Root Cause Isolation**:
   - Trace the error through logs, call stacks, or source code.
   - Understand *why* it failed, not just *where* it failed. Do not just patch the symptoms.
2. **Impact & Strategic Analysis (CTO & Architect Alignment)**:
   - Check which files, components, or API endpoints import or rely on the code being modified.
   - Evaluate if the fix aligns with long-term architecture or introduces technical debt.
   - Assess potential side effects on other user flows or system behaviors.
3. **Surgical Implementation**:
   - Implement the fix with high precision. Preserve adjacent comments, formats, and unrelated functionality.
   - Run verification checks to ensure no new errors/warnings (e.g. lint errors, TypeScript compiler errors) are introduced.
4. **Verification & Regression Testing**:
   - Validate that the fix resolves the reported error.
   - Confirm that existing/related features remain fully functional.

## 🧠 Post-Resolution Learnings & Persistent Rules

### 1. Database Schema Alignment & Resilience
- **Strict Query Alignment**: If a table's schema in the database does not match the frontend's expected properties, always query and insert using the actual database column names (e.g., using `consented_at` instead of `granted_at`; `data_sharing_consent` instead of `consent_type`).
- **Query Hardening**: Never include query filters (like `.is('revoked_at', null)`) targeting columns that do not exist in the database schema, as this throws errors that trigger circuit-breaker fallbacks.

### 2. Local-First Synchronization Safeguards
- **Local State Preservation**: To prevent background database synchronization routines from overwriting active local/mock states with empty datasets (e.g. due to unauthenticated JWTs, RLS restrictions, or offline mock sessions), always maintain a local timestamp cache (e.g., `local_consent_timestamps`).
- **Cache Merging**: Merge local cache entries with database sync results before saving the final active lists, filtering out expired items locally.

### 3. Non-Intrusive Viewport Scrolling
- **Bounded Container Scroll**: To avoid unsolicited page-level scrolling, never use `scrollIntoView()` on container children. Manipulate the container's `scrollTop` directly (`container.scrollTop = container.scrollHeight`).
- **User Scroll Detection**: Always implement scroll detectors (`onScroll`) to trace when a user scrolls up. Suppress programmatic scrolls if the user is actively reading earlier content.
- **Visibility Checks**: Verify container visibility (`isOpen === true` or equivalent) before applying scrolls to prevent layout shifts.

### 4. Prompt Reading & Visual Selection Priority
- **Complete Prompt Reading**: Read every user prompt completely to fully understand the query *before* creating a plan or proposing changes.
- **Visual Selection Priority**: Always inspect the `VISUAL COMPONENT MULTI-SELECTION` metadata (including DOM path, CSS selectors, and inner text) first. Treat it as the definitive target for user-selected UI components, layout modifications, or header changes.

### 5. Mandatory Supabase SQL Generation & Execution Warning
- **Automatic SQL Script Generation & Prominent Warning**: Whenever a new feature, API upgrade, edge function modification, or schema update requires database schema changes (new tables, columns, indexes, functions, or RLS policies), you MUST:
  1. Update `supabase/unified_setup.sql` (or corresponding migration files) with idempotent DDL (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
  2. Provide a clean, copy-paste ready SQL snippet in the final response.
  3. Display a **HIGH-PRIORITY MANDATORY WARNING** directing the user to run the SQL snippet in the Supabase SQL Editor, explaining clearly that backend/edge functions cannot function properly without executing the required SQL first.

### 6. Mandatory Preservation of Mediflow Core USPs (Anti-Regression Rule)
You MUST NEVER break, remove, alter, or regress any of the following 7 Core USPs:
1. **Sub-300ms Outbound WhatsApp Response Engine**: Outbound Meta Graph API requests MUST be dispatched FIRST (~250ms latency) before session DB updates or non-blocking activity logs.
2. **1-Tap Native WhatsApp Reply Buttons (`type: "button"`)**: Main menus, dates, and slots MUST use single-tap reply buttons for instant auto-sending.
3. **Active Payment Gateway Gate**: The system does NOT use Cashfree. The primary payment gateways are PhonePe and Razorpay. Unpaid appointments MUST remain in `status: "pending_payment"` and MUST be filtered out from active Doctor EMR and Compounder queues until the active gateway (PhonePe or Razorpay) emits a successful payment status.
4. **Emergency SOS Priority #1 Routing**: SOS bookings charge ₹618.00 and move to Priority #1 position at the top of the Doctor Queue with pulsing red alert banner.
5. **1-Click Pharmacy Delivery & 3 Reminders**: Chronic prescriptions trigger 1-Click delivery orders and schedule 3 reminders (Day 7, Month 1, Month 3).
6. **B2B Referral Reward Engine**: Codes (`REF-XXXX`) unlock 10% OFF for referrer and new patient, automatically deducting from checkup and medicine bills.
7. **360° Realtime Supabase Sync**: `realtimeSyncService.ts` streams live Postgres events to Doctor EMR, Compounder Desk, and Pharmacy Counter without page refreshes.

### 7. Mandatory Preservation of 2-Touchpoint Care Loop & Premium Patient Loyalty Engine
You MUST NEVER alter or break the 2-Touchpoint Clinical & Monetization Care Loop:
1. **Touchpoint 1 (Morning Consult)**: Doctor hears symptoms, registers vitals, prescribes initial lab tests.
2. **Touchpoint 2 (Evening Report Review)**: Upon lab report approval, WhatsApp offers 2 buttons:
   - `Physical Review at Clinic 🏥` (**Primary / Default**): Assigns 04:00 PM - 06:00 PM evening slot & reserves prescribed medicines at Clinic Counter Pharmacy.
   - `Virtual Video Review 💻` (**Emergency / Busy Fallback**): Generates Jitsi link for remote video review & dispatches 1-Click home delivery.
3. **4 Premium Member Benefits**: Paying medicine/lab bills at clinic counter unlocks 1 Free Virtual Consult (15-20 days), 10% OFF Refills, WhatsApp Daily Reminders + AI Longitudinal Report, and Instant PDF Lab Reports.

### 8. Anti-Regression Directives & Persistent Bug Prevention (Audit Lessons 1–38)
You MUST ALWAYS enforce these strict technical safeguards across all future code edits to prevent regressions of resolved bugs:

1. **Postgres CDC Field Normalization**: All incoming Supabase Postgres CDC records MUST pass through `normalizeRecord()` in `realtimeSyncService.ts` to convert `snake_case` database fields to `camelCase` properties before updating local states.
2. **IndexedDB & LocalStorage Safe JSON Parsing**: ALL calls reading `localStorage` (such as `wal_mem_outbox`, `offline_sync_queue`, `whatsapp_broadcast_logs`, `founder_alerts`, `vitalsync_support_tickets`) MUST be wrapped in `try-catch` blocks with safe fallback defaults to prevent `SyntaxError` crashes on corrupted storage strings.
3. **Active Payment Gate (PhonePe & Razorpay)**: The system does NOT use Cashfree. `pending_payment` appointments MUST remain hidden from active Doctor EMR and Compounder queues until PhonePe or Razorpay clears the invoice. Filtering maps MUST check both `a.patientId` and `a.patient_id` (`a.patientId || a.patient_id`) so CDC records are never misidentified.
4. **Ghost Payment Cancellation**: Unpaid poller routines MUST mark stale (>15m) unpaid appointments as `cancelled` — NEVER auto-confirm unpaid visits.
5. **Pharmacy GST Standardization**: Standardize pharmacy GST calculation to 5% across both BillHubTab and Pharmacy POS paths.
6. **WhatsApp Chat Realtime Isolation**: Incoming Realtime WhatsApp messages MUST NOT force-open unknown patient sessions or override the doctor's active chat context.
7. **Compounder Realtime `syncData` Handler**: Financial CDC event listeners in `CompounderDashboard.tsx` MUST invoke a valid `syncData` callback without unhandled `ReferenceError` crashes.
8. **Live 8-Step Workflow Pill Reactivity**: Compounder workflow lookup maps MUST bind `[dataRevision]` in `useMemo` dependency arrays to ensure live progress updates.
9. **Doctor Consultation Focus Protection**: Realtime patient list syncs MUST NEVER reset the doctor's active consultation selection to `registered[0]` mid-consultation.
10. **Blob URL Memory Leak Prevention**: EVERY invocation of `URL.createObjectURL(blob)` for PDF, invoice, spectacle, or audio preview/print tabs MUST call `URL.revokeObjectURL(url)` immediately after opening.
11. **Numeric `tokenNumber` Search Safety**: Search filters querying `tokenNumber` MUST wrap numeric values with `String(p.tokenNumber).toLowerCase()` to prevent `TypeError` crashes.
12. **Defensive Phone Search Null Guards**: Search filters querying `phone` MUST use `(p.phone || '')` guards before calling `.includes()`.
13. **Patient Mobile Encounter Chaining**: Encounter medication maps MUST use optional chaining (`enc.medications?.map`) to prevent crashes on encounters without prescriptions.
14. **Settlement Loading State Guarantee**: Settlement widgets MUST invoke `setLoading(false)` on early returns when `podId` or `entityId` is missing.
15. **Invoice ID Substring Safety**: Financial ledger entry renderings MUST guard `(entry.invoiceId || 'N/A')` before taking `.substring()`.
16. **SOP Config Null Property Safety**: SOP configuration rendering MUST use optional chaining `?.` and fallbacks `||` on `extractedConfig` properties.
17. **CSV Generic Medicine Search Safety**: Medicine search filters MUST guard `(i.genericName || '')` for CSV-imported batches.
18. **Bill Card `toFixed(2)` Null Guards**: Bill card price displays MUST wrap total amounts with `(bill.totalAmount || 0).toFixed(2)` defensive guards.
19. **React Chat Stream Key Stability**: Dynamic message streams in WhatsApp tabs MUST use composite keys (`key={`msg-${idx}-${sender}-${text.slice(0, 15)}`}`) instead of array indices (`key={idx}`).
20. **Command Palette Theme Toggle Event Sync**: Theme toggle actions in `CommandPalette.tsx` MUST dispatch `mediflow-theme-change` to keep Navbar and App state synchronized.
21. **WhatsApp 10-Digit Phone Normalization**: `pushWhatsAppMessageFromBot` MUST compare normalized 10-digit numbers (`replace(/\D/g, '').slice(-10)`) and update DB by session `id`.
22. **Outbound WhatsApp Session Auto-Provisioning**: `pushWhatsAppMessageFromBot` MUST automatically provision a session (`sessions.unshift(newSession)` & Supabase DB `insert`) when messaging a new phone number.
23. **Biometry Worksheet Controlled Inputs**: Biometry form elements MUST use a `safeValue` record with nullish coalescing defaults (`?? ''`) for all biometry fields.
24. **Optical Prescription `-0.00` Formatting Sanitization**: SPH and CYL option generators MUST explicitly sanitize `val === '-0.00' ? '0.00' : val`.
25. **Global `mediflow-toast` Event Listening**: `ToastProvider.tsx` MUST maintain an active `mediflow-toast` window listener and memoize the `toast` context value with `useMemo`.
26. **Mobile Nav Dark Mode Contrast**: Mobile bottom navigation bars MUST use `border-white/10` for border styling on dark backgrounds.
27. **Dynamic Specialization Context Reactivity**: `SpecializationProvider` MUST listen for `mediflow-specialization-change` and `storage` events with a `specRevision` state counter for instant UI re-rendering without page refreshes.
28. **Multi-Tenant SOP Entity ID Isolation**: SOP activation routines MUST extract `currentEntityId` dynamically from `activePod?.id` or `activeProfile?.clinicId` instead of static hardcoded UUIDs.
29. **Pod Command Center Date Sync**: Daily metric calculations MUST evaluate `currentTime.toISOString().split('T')[0]` dynamically so counters roll over accurately at midnight.
30. **Profile Settings Modal Promise Safety**: Supabase `.single()` query callbacks MUST inspect `!error` before accessing returning records.
31. **WhatsApp AI Support Sentry Auto-Scroll**: Floating AI support chat drawers MUST maintain a `chatScrollRef` auto-scrolling `scrollTop = scrollHeight` on new message arrival.
32. **Patients Directory Telemedicine Substring Safety**: Telemedicine room ID renderings and virtual booking routines MUST guard `(virtualAppt.id || 'tele-001').substring(0, 8)` before taking `.substring()`.
33. **Cashfree Order Invoice ID Schema Safety**: `cashfree-order` Edge Function validation MUST use `z.string().min(1)` instead of `z.string().uuid()` to support both custom string IDs (`inv-XXXX`) and UUIDs.
34. **Financial Ledger Search Filter Safety**: `FinancialsTab.tsx` ledger search filters MUST guard `(entry.invoiceId || '')` and `(entry.transactionType || '')` before calling `.toLowerCase()`.
35. **Refraction Desk Search Filter Safety**: `RefractionDashboard.tsx` search filters MUST guard `(p.name || '')` and `(p.phone || '')` before calling `.toLowerCase()` or `.includes()`.
36. **WAL IndexedDB Outbox Method Integrity**: `WALIndexedDB.addEntry` in `api.ts` MUST delegate to `this.append(entry)` with clean try-catch blocks to prevent class syntax errors and ensure offline storage fallbacks.
37. **Patient WhatsApp Simulator Avatar Safety**: Avatar rendering in `PatientWhatsAppSimulator.tsx` MUST use `(activePatient?.name || 'Mediflow').substring(0, 2)` before calling `.substring()` or `.toUpperCase()`.
38. **Telemetry Incident Persistence**: `SystemHealthCockpit.tsx` MUST NEVER automatically delete `failed` or `unresolved` telemetry incidents on component mount, preserving HITL escalations for admin inspection.
39. **Dynamic Supabase Auth Token Clearing**: `autoHealerAgent.ts` MUST dynamically iterate `localStorage` keys matching `sb-*-auth-token` instead of using static hardcoded project reference strings.
40. **SaaS Admin Metrics RPC Fallbacks**: `SaaSAdminPanel.tsx` MUST provide calculated fallback metrics for onboarding, revenue, and cost stats if RPC queries return null or throw database errors.
41. **SaaS Admin Pod List Resilience**: `SaaSAdminPanel.tsx` MUST populate default pod info (`Apex Eye & Dental Care Clinic`) if `pods` table queries return empty.
42. **Telemetry Analytics Distinct User Identity**: `telemetry.ts` MUST dynamically extract `distinct_id` from the active profile (`p.name || p.email || p.role`) instead of using static hardcoded user names.
43. **Telemetry Webhook Subsystem Safety**: Deno Edge function `notify-developer-webhook/index.ts` MUST guard `(subsystem || 'system').toLowerCase()` to prevent runtime Edge crashes on missing payload properties.
44. **Web Vitals LCP Font Preloading**: `index.html` Google Fonts links MUST use asynchronous preloads (`rel="preload" as="style" onload="..."`) to ensure LCP remains under 2500ms and prevent `VITALS_BREACH` alerts.
45. **Database Schema Repair RPC Alignment**: `supabase/combined_upgrade.sql` MUST define both `heal_schema_drift` and `execute_autonomous_db_repair` PL/pgSQL functions for instant 1-pass Auto-Healer database repairs.
46. **UnifiedInvoice Type Guard Alignment**: `SaaSAdminPanel.tsx` paymentStatus filter checks MUST evaluate `i.paymentStatus === 'cleared' || (i.paymentStatus as string) === 'paid'` to satisfy TypeScript strict compiler type union safety.
47. **Multi-Payment Gateway & Zero-Fee UPI Engine**: The system does NOT use Cashfree. `paymentService.ts` MUST support Scenario B Direct Dynamic Zero-Fee UPI Deep-Links (`upi://pay?pa=...`), Razorpay, PhonePe, and Cash Counter billing, logging settlements directly to `vitalsync_pool_settlements`.
48. **WhatsApp Payment Assertion Engine**: When patients tap `[ I Have Paid ✅ ]` or reply `PAY` / `DONE` on WhatsApp, `whatsappService.ts` MUST immediately allocate the OPD Token (`#TK-005`), clear the invoice, log commission pool splits, and dispatch the confirmation receipt.
49. **Razorpay Server-Side Webhook Verification**: `razorpay-webhook` MUST automatically process `payment.captured` events, mark `payment_status = 'cleared'`, assign OPD tokens, and auto-dispatch WhatsApp confirmation receipts without requiring manual patient assertion.
50. **Razorpay Standard Web Checkout**: Frontend `BillHubTab.tsx`, `PatientMobileDashboard.tsx`, and `CompounderDashboard.tsx` MUST provide prominent **`Razorpay (Online Gateway)`** options that dynamically load `checkout.js`, pass server-returned `keyId` alongside `order_id` to prevent Key ID mismatch errors, and verify server-side HMAC-SHA256 signature via `razorpay-verify` before marking invoices as paid.
51. **TypeScript Strict Type Safety**: `BillingService.clearInvoice`, `BillingService.recordInvoicePayment`, `BillingService.markInvoicePaid`, `api.ts`, and `apptPaymentMode` state MUST include `'razorpay'` \| `'phonepe'` in `paymentMethod` union types (excluding Cashfree), patient references MUST evaluate active scope variables (`activePatient`), and toast notifications MUST dispatch `mediflow-toast` custom events to ensure `tsc -b --force` Vercel builds pass cleanly.
51. **Supabase Edge Function Keep-Alive Handler**: Edge Functions (`razorpay-order`, `cashfree-order`, `ping`) MUST return HTTP 200 OK to `HEAD` & `GET` requests, and frontend calls MUST pass `Authorization: Bearer` & `apikey` headers wrapped in try-catch fallbacks to eliminate `Failed to fetch` errors.
52. **GitHub Actions 24/7 Keep-Alive Workflow**: `.github/workflows/keep-alive.yml` MUST configure `push: branches: [main]`, `schedule: cron: '*/15 * * * *'`, and `workflow_dispatch` with GitHub Secrets (`secrets.VITE_SUPABASE_URL` & `secrets.VITE_SUPABASE_ANON_KEY`) so GitHub Actions registers, displays, and executes the keep-alive workflow automatically.
53. **CI/CD ESLint Strict Compilation**: Component functions (`handleToggleTheme`) MUST be declared before `useEffect` hooks that call them, empty `catch` blocks MUST include explicit `/* ignore */` comments, and un-reassigned variables MUST use `const` declarations to ensure `--max-warnings 0` CI pipelines pass cleanly.
54. **PhonePe 0% MDR Payment Gateway & Edge Function Webhook Protocol**: `phonepe-order` and `phonepe-webhook` Deno Edge Functions MUST validate Base64 payload encoding and SHA-256 HMAC `X-VERIFY` headers (`SHA256(responsePayload + saltKey) + "###" + saltIndex`). `phonepe-webhook` MUST automatically mark `unified_invoices.payment_status = 'cleared'`, update `appointments.status = 'confirmed'`, assign OPD token `#TK-XXX`, record idempotency in `vitalsync_pool_settlements`, and dispatch Meta Graph API WhatsApp receipts in <250ms without requiring manual UTR entry or screenshot uploads.
55. **Primary Clinic UPI VPA Handle Standardization**: All direct dynamic UPI links, QR code generators, WhatsApp payment messages, and DDL database triggers MUST standardize on `vitalsync@axl` (or dynamic `localStorage.getItem('clinic_upi_vpa')`) with 0% MDR platform fees.
56. **Paytm PG Primary Integration & Legacy Gateway Pruning Protocol**: Paytm PG (`0% MDR`) MUST be configured as the primary live payment gateway across `paymentService.ts`, `BillHubTab.tsx`, `paytm-order`, and `paytm-webhook`. Payment selection lists MUST display Paytm PG (`paytm`), Zero-Fee Direct UPI (`vitalsync@axl`), and Cash Counter (`cash`).
57. **Sequential Platform Fee & Commission Pool Refill Protocol**: When invoices containing Pharmacy or Pathology fees are cleared via Paytm, UPI, or QR, `BillingService.clearInvoice` MUST execute a strict 2-step sequence: STEP 1 deducts the 3% Platform Fee to VitalSync (`platformAmt = invoiceAmount * 0.03`); STEP 2 takes the net remaining amount (`invoiceAmount - platformAmt`) to refill the clinic's Commission Pool (`vitalsync_pool_settlements`) up to the **₹1,000 Safety Buffer**.
58. **Counter Doctor Consultation Fee Immunity Protocol**: Pure Doctor Consultation fees booked at the counter by the Compounder (`pharmacyFee === 0 && labFee === 0 && source !== 'whatsapp'`) MUST go 100% to the Doctor with 0% platform fee and 0 pool deduction. Counter doctor consultation fees MUST NEVER refill the commission pool.
59. **WhatsApp Online Booking Platform Convenience Fee Protocol**: Online appointment bookings initiated via WhatsApp Chatbot MUST generate invoices for **₹515.00** (`₹500 Doctor Consultation Fee + ₹15 3% Convenience Platform Fee`), paid directly by the online patient and credited to the platform.
60. **Counter QR Standee & Partial Cash Split Settlement Protocol**: `BillHubTab.tsx` MUST provide a `Print Fixed Counter Table QR Standee` button generating a printable clinic table QR card (`vitalsync@axl`), and a `Partial Cash Paid` input field allowing split cash + digital QR settlements while maintaining accurate midnight cash audit logs.
61. **Action Button Error Handling & Module Import Immunity Protocol**: ALL interactive action buttons and form submit handlers across all dashboards (`CompounderDashboard`, `DoctorDashboard`, `LabDashboard`, `PharmacyDashboard`, `PatientMobileDashboard`, `BillHubTab`) MUST be wrapped in explicit `try-catch` blocks with synchronous fallback paths to prevent frozen UI states. Furthermore, any component using external services (`PaymentService`, `BillingService`, `RealtimeSyncService`, `api`) MUST include explicit top-level ES module import statements to ensure strict TypeScript compilation (`tsc -b --force`) and Vercel CI/CD builds pass with 0 errors.
74. **Live User Zero-State Baseline & Strict Demo Account Identity Protocol**: `PatientService`, `BillingService`, `PharmacyService`, `LabService`, `WhatsAppService`, and `api.ts` MUST evaluate `isDemoAccount` using strict explicit demo account identity matching (`email === 'demo@mediflow.com' || email === 'doctor@mediflow.com' || id === 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101' || isDemo === true`). Broad substring matching on `"demo"` is STRICTLY PROHIBITED so live user accounts containing "demo" anywhere in their email or name never trigger mock data fallback loops.
75. **Automatic Browser Storage Purge on Authenticated Sign-In**: `handleAuthSuccess` in `App.tsx` MUST automatically purge all pre-seeded demo keys (`patients`, `saas_appointments`, `financial_ledgers`, `patient_registry`, `medicine_bills`) from browser `localStorage` upon authentication of any non-demo live account, guaranteeing new live accounts initialize with a 100% clean zero-state baseline (`[]`).
76. **Pod Context Isolation for Unassigned Live User Profiles**: `resolvePodContext()` in `podContext.ts` MUST NOT default `podId` to `FALLBACK_POD_ID` (`dfb2a1a8-8e68-4f8a-929e-4a6c8e317001`) when a live user account's profile has `entity_id = NULL`. It MUST generate a user-isolated pod ID (`pod-USER_ID`) to prevent new accounts from ever querying or inheriting the demo clinic's data.
77. **Realtime CDC Multi-Console Event Propagation Protocol**: All 5 active consoles (Doctor EMR, Compounder Desk, Pharmacy POS, Pathology Lab, SaaS Admin Cockpit) MUST subscribe to `RealtimeSyncService.subscribeToLiveClinicUpdates` listening for events across all 13 CDC tables (`appointments`, `unified_invoices`, `financial_ledgers`, `patient_registry`, `medicine_bills`, `lab_requisitions`, `whatsapp_sessions`, `vitalsync_pool_settlements`, `clinic_sops`, `inventory_holds`, `pathology_reports`, `saas_invoices`, `saas_prescriptions`) with sub-300ms latency.
78. **Zero-Hardcoding & Dynamic Identity Binding Mandate**: Hardcoded clinic names ("Patna", "Kankarbagh", "Apex Care Clinic"), mock doctor names ("Doctor Vivek", "Dr. Amit Arya"), and default fallback phone numbers ("9608032073") are STRICTLY PROHIBITED in component logic, print headers, PDF generators, and WhatsApp templates. All components MUST dynamically resolve `activePod?.name || activeProfile?.clinicName` and `activeProfile?.display_name`.
79. **Enterprise Top-Tier SaaS Aesthetic & Resilience Directives**: All dashboard consoles MUST maintain vibrant dark/light glassmorphic styling, smooth micro-animations, sub-300ms interaction feedback, defensive nullish fallback guards `(field || '')`, and explicit try-catch error boundaries so network interruptions never freeze UI components.
80. **Secure RPC Role Verification Protocol**: All Supabase database RPCs MUST verify caller permissions by looking up the authenticated user's role in the protected `public.profiles` table (`SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid()`). Relying on client-writable `user_metadata` in JWT claims (`auth.jwt() -> 'user_metadata' ->> 'role'`) for security decisions is STRICTLY PROHIBITED to eliminate privilege escalation risks.
81. **Backend Session Validation for Data Syncing**: `syncFromSupabase()` in `api.ts` MUST validate active backend authentication via `await supabase.auth.getSession()` before initiating CDC synchronization or processing WAL queues. Manual scanning of browser `localStorage` keys for arbitrary `-auth-token` strings is STRICTLY PROHIBITED to prevent stale offline state pollution.
82. **Defensive String Nullish Fallback Guard Protocol**: All string operations (`.substring()`, `.toLowerCase()`, `.toUpperCase()`, `.includes()`) on potentially missing object properties (`inv.id`, `entry.destinationEntityId`, `testName`, `patient.name`) MUST use defensive nullish fallbacks `(field || '')` across all dashboard consoles (`BillingDashboard`, `PatientMobileDashboard`, `DoctorDashboard`) to prevent white-screen `TypeError` runtime crashes.
83. **Synchronous Payment Simulation & Form Submission Locks**: Interactive payment action handlers (`handleConfirmUpiPayment`, `handleSimulatePayment`) MUST evaluate a synchronous state guard `if (isPaying || isSimulatingPayment) return;` at the top of the handler function before launching asynchronous operations or timeouts to prevent spam-click race conditions and duplicate ledger settlements.
84. **Strict Zero-Regression Bug Fix Integrity Protocol**: All bug audits, diagnostics, and repairs MUST NEVER introduce new operational bugs, visual regression artifacts, or layout disruptions to active dashboard modules. Every bug fix must be implemented with maximum defensive programming techniques to ensure the issue can never recur:
   - **Zero-Bypass Policy**: Do not modify core business rules, active specialization pathways (`SpecializationContext`), or the 7 Core USPs.
   - **Defensive Type Safety**: Always use fallback empty strings `(value || '')`, default numeric safety limits `(value || 0)`, and optional chains `?.` rather than rewriting functional logic.
   - **TypeScript Strictness**: Every code change must be statically typed and keep compiler error check constraints intact.
   - **Verification Compliance**: Fixes must be validated against null, undefined, empty database rows, network connection failures, and offline database caching routines.
85. **Zero-Collapsing Icon Ligature & Bundled SVG Architecture Protocol**: High-frequency navigation bars (mobile bottom nav docks, dashboard tab headers, metric cards) MUST use bundled SVG components (`lucide-react`) rather than raw external CDN font ligatures to guarantee 0ms offline/PWA rendering immunity. All `<link>` tags loading essential web fonts in `index.html` MUST use synchronous `rel="stylesheet"` with `preconnect` origins rather than dynamic inline JS `onload` handlers on `rel="preload"`. Global CSS rules for `.material-symbols-outlined` MUST enforce strict OpenType ligature features (`font-feature-settings: 'liga'`, `max-width: 1.2em`, `max-height: 1.2em`, `overflow: hidden`, `display: inline-block`) and MUST NEVER include generic font fallbacks (`sans-serif`, `serif`) that permit raw ligature string expansion.
86. **Military-Grade Clinic Code Immutability & Pod-Id Invariant Protocol**: All components and state managers MUST resolve clinic codes deterministically through `ClinicContext` (`activePod?.clinicCode || activeProfile?.clinic_code || activeProfile?.clinicCode || 'MF-APEX'`). Client-side pseudo-random generation of clinic codes (`Math.random()`, `.slice(0, 5)` UUID fragments) is STRICTLY PROHIBITED. All database mutations across `patient_registry`, `encounters`, `lab_requisitions`, `medicine_bills`, and `unified_invoices` MUST explicitly include `pod_id` from the resolved pod context to guarantee 100% interconnected multi-tenant isolation across Doctor EMR, Compounder Desk, Pharmacy Counter, and Pathology Lab.
87. **Chatbot Template Immutability & Multi-Scenario Technical Debugging Protocol**: All WhatsApp chatbot templates (message texts, button labels, fee breakdowns, and step sequences) are strictly FROZEN and IMMUTABLE. Under NO circumstances should AI agents alter, rewrite, shorten, or add unapproved options/texts (e.g. 'Option 3: Counter Payment') to the chatbot templates unless the user explicitly requests a template modification. When debugging issues (such as payment failures or workflow hangs), agents MUST focus purely on resolving the underlying technical mechanics (Edge Function payloads, RPC errors, database constraints, auth headers, network retries, webhook signature verifications) across multiple scenarios without ever altering the approved chatbot templates.
88. **Modal React Portal Viewport Anchoring Protocol**: ALL modal dialogs, drawers, and popups MUST be rendered using `React.createPortal(modalContent, document.body)` with `fixed inset-0 z-[9999] overflow-y-auto` and an unconditional body scroll lock cleanup `useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, [isOpen])`. Rendering modals directly inside inline scrollable component hierarchies or transformed container trees is STRICTLY PROHIBITED to eliminate scroll offset and off-screen rendering bugs.
89. **15-Second Edge Function & Meta API Network Timeout Protocol**: Client-side `fetch` calls targeting Deno Edge Functions or Meta Graph API endpoints (`whatsapp-onboard`, `meta-webhook`, `razorpay-order`) MUST enforce a minimum timeout of **15,000ms (15 seconds)** with AbortControllers to account for Edge Function cold starts and API gateway delays. Furthermore, all Edge Functions MUST return HTTP 200 OK to both `HEAD` and `OPTIONS` CORS preflight requests.
90. **Pod-Scoped Database Hydration for Persistent Channel State Protocol**: Integration connection states (such as Meta WABA connections in `waba_connections`, Cashfree vendor accounts in `cashfree_vendors`, or payment configs) MUST NOT rely exclusively on browser `localStorage`. Components MUST query Supabase DB on mount (`.eq('pod_id', currentPodId).eq('is_active', true)`) to auto-hydrate React state and sync `localStorage` across devices and reloads.
91. **Dual-Storage CDC Realtime Appointment Propagation Protocol**: `RealtimeSyncService.ts` MUST map Postgres CDC `appointments` table events to both `['saas_appointments', 'appointments']` storage keys synchronously. Furthermore, `BillingService.getAppointments()` demo filters MUST NOT drop legitimate live user appointments (matching `currentPodId`) even if `patient_name` is temporarily set to `"Unknown Patient"`.
92. **Atomic Inventory & FEFO Anti-Overselling Lock Protocol**: All pharmacy batch stock decrements MUST execute server-side conditional checks (`WHERE stock_quantity >= quantity_to_deduct`) or atomic Supabase RPCs. Client-side optimistic state MUST NEVER permit batch stock levels to drop below `0` to prevent concurrent double-dispensing across sibling counters.
93. **Floating Promise & Unhandled Rejection Immunity Protocol**: EVERY asynchronous background operation (`.then()`, `fetch()`, `supabase.from()`, thermal receipt printing, background telemetry logging, and out-of-band WhatsApp notifications) MUST attach an explicit `.catch(err => ...)` handler or be wrapped in a `try-catch` block with safe fallback behavior to prevent `UnhandledPromiseRejection` errors from silently freezing React components.
94. **IST (UTC+5:30) Clinical Date & Midnight Token Rollover Contract**: All clinical appointments, OPD token sequence resets (`#TK-001`), vitals timestamps, and financial ledger groupings MUST normalize to Indian Standard Time (IST, UTC+5:30) using `new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })` or explicit timezone offsets to prevent early 18:30 UTC / 05:30 AM date rollovers on client devices with misconfigured clocks.
95. **Telemetry PII & ABHA Data Sanitization Protocol**: Telemetry dispatchers, error loggers, and Auto-Healer incident collectors MUST sanitize payload fields prior to transmission to Supabase `system_health_telemetry` or external APMs, masking patient phone numbers (`XXXXXX1234`), stripping raw passwords/tokens, and removing unmasked ABHA wallet credentials to guarantee 100% NDHM/ABDM healthcare compliance.
96. **Multi-Tab LocalStorage & Sibling Window Event Sync Protocol**: All shared dashboard state managers MUST maintain active window listeners for `storage` and custom `mediflow-*-change` events, ensuring that actions taken in one browser tab (such as token calls, billing settlements, or patient status transitions) synchronize across sibling tabs and windows in <50ms without requiring manual page refreshes.
97. **Offline WAL Outbox Idempotency Key Protocol**: Every mutation payload queued in the offline Write-Ahead Log (`vitalsync_wal_outbox`) MUST carry a deterministic client-generated `id` or `idempotency_key` (UUID). Backend tables and RPC replay handlers MUST enforce `ON CONFLICT (id) DO NOTHING` or `upsert` semantics to guarantee that network reconnect replays never generate duplicate invoices, duplicate appointments, or redundant WhatsApp messages.
98. **PromptGuard Live Daemon Bridge & Visual DOM Grounding Protocol**: Whenever the user requests UI modifications, layout tweaks, or component bug fixes (even with brief prompts like "fix this" or "change color"):
    - The AI Agent MUST first attempt to query the live PromptGuard daemon bridge at `http://localhost:9000/context` to pull the active visual component selection (exact DOM selector, component chain, computed styles, inner text, and source file line mapping).
    - If the bridge is offline or unreachable on port 9000, the AI Agent MUST alert the user with a helpful reminder: `⚠️ PromptGuard DevServer Bridge is offline. Run: cmd /c "npm run dev 2>&1 | node devserver_bridge.js"` while proceeding via standard AST grep search.
    - The AI Agent MUST ground its edits directly in the visual DOM metadata, applying surgical pinpoint line diffs that strictly preserve adjacent JSX properties and avoid layout regressions.
