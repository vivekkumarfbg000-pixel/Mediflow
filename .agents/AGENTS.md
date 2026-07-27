# Mediflow Workspace Rules

## 🔒 Security & Secrets Protection
- **NEVER** add, commit, or push any files containing API keys, access tokens, or private secrets (such as `.env`, `.env.local`, `.env.production`, or private configurations) to Git.
- Always ensure that `.gitignore` lists all environment files and credentials.
- Double-check any modified files in Git before staging or suggesting commits to prevent accidental leakage of sensitive tokens.

## 🛠️ Google/Meta Tech Team Debugging & Fix Pipeline
Whenever debugging, resolving errors, or fixing bugs, adopt the mindset and structure of a highly qualified Big Tech (Google/Meta) Engineering Team. You must follow this systematic, multi-role pipeline to resolve issues without introducing regressions or new errors:

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
3. **Cashfree Strict Payment Gate**: Unpaid appointments MUST remain in `status: "pending_payment"` and MUST be filtered out from active Doctor EMR and Compounder queues until Cashfree emits `PAYMENT_SUCCESS`.
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
3. **Cashfree Unpaid Appointment Gate**: `pending_payment` appointments MUST remain hidden from active Doctor EMR and Compounder queues. Filtering maps MUST check both `a.patientId` and `a.patient_id` (`a.patientId || a.patient_id`) so CDC records are never misidentified.
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



