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



