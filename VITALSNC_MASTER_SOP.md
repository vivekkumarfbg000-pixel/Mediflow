# VitalSync Google/Meta Big Tech Engineering Master SOP Directive

> **Executive Engineering Standard & Operational Blueprint**
> **Product**: VitalSync / Mediflow Enterprise SaaS Ecosystem
> **Authority**: Senior Full-Stack Lead & Big Tech Engineering Council
> **Version**: 30.0 (Big Tech Engineering Directive)

---

## 1. Executive Engineering Charter & Simulated Roles

All AI agents acting on this repository MUST operate as a senior Big Tech engineering team following 6 specialized roles:

- **Developer**: Implements clean, non-duplicated, highly performant code following exact style guidelines.
- **Architect**: Prevents system-wide regressions, verifies file dependencies, and enforces data flow contracts.
- **CTO**: Evaluates overall architecture, performance scalability, security compliance, and long-term stability.
- **SecOps**: Enforces strict Supabase RLS policies, zero secret exposure in Git/bundles, and HMAC signature verification.
- **GitOps**: Manages pristine git workflow status, CI/CD pipeline triggers, and clean commit hygiene.
- **QA**: Designs edge-case validation plans and ensures zero regressions across all 5 clinical consoles.

---

## 2. System Architecture & Realtime CDC Protocol (Google/Meta Standard)

### 2.1 Ultra-Low Latency CDC Streaming Engine
- **Engine Latency**: All Supabase Postgres Change Data Capture (CDC) events MUST be debounced at **`250ms`** in `src/services/api.ts` to ensure sub-300ms live synchronization across all active dashboards.
- **CDC Event Subscriptions**: Every active dashboard console MUST subscribe to `RealtimeSyncService.subscribeToLiveClinicUpdates` listening for changes on:
  - `appointments`, `unified_invoices`, `financial_ledgers`, `patient_registry`, `medicine_bills`, `lab_requisitions`, `whatsapp_sessions`, `vitalsync_pool_settlements`, `clinic_sops`.

### 2.2 Fault-Tolerant Outbox & Circuit Breaker State Machine
- **Write-Ahead Log (WAL) Outbox**: Offline operations MUST be queued locally in `vitalsync_wal_outbox` and automatically replayed when network reconnects (`window.addEventListener('online')`).
- **Circuit Breaker Fallback**: If database latency spikes or network drops occur, the circuit breaker (`mediflow-circuit-open`) MUST fall back to local standby buffers without throwing unhandled exceptions or blank screens.

### 2.3 Cross-Subdomain Session Management & Isolation
- Domain isolation MUST be enforced across `vitalsync.in` (Landing Page), `app.vitalsync.in` (Clinical Consoles), and `admin.vitalsync.in` (SaaS Admin Console).
- Single-session guardrails (`mediflow_sw_auto_reloaded` in `pwa.ts`) MUST prevent infinite page refresh loops.

---

## 3. Exhaustive Module-by-Module Technical Specification

### 3.1 Doctor EMR Suite (`DoctorDashboard.tsx`)
1. **Consultation Queue State Machine**: Manages patient status transitions (`awaiting_vitals`, `awaiting_consultation`, `in_consultation`, `completed`) with Emergency SOS priority banner triggers.
2. **CDSS AI Scribe**: Groq Llama-3 70B primary model with Gemini 2.5 Flash fallback for real-time symptom extraction, differential diagnosis, and RAG longitudinal patient summaries.
3. **Ophthalmic Refraction Grid**: Standardized visual acuity (RE/LE Sph, Cyl, Axis, VA), IOP (Tonometry), Fundus, and Slit Lamp examination notes.
4. **Digital Prescriptions Engine**: Drug dosage (`1-0-1`), duration, special instructions, FEFO stock validation, instant PDF generation & WhatsApp dispatch.
5. **Financials Tab & Split Calculator**: SOP-driven commission pool balance, doctor net earnings (100% consult + 40% lab + 20% pharmacy split), downloadable PDF ledger statements in 100% agreement.
6. **Patients Directory**: Searchable registry, ABHA ID linking (`12-3456-7890-1234`), allergy tracking, chronic condition tags, 360-degree patient timeline.
7. **WhatsApp Care Console**: Live patient session messages, automated bot fallback toggle, manual doctor reply overrides.
8. **SOP Configuration Center**: Custom clinic fee setup, SOP guidelines editor, doctor/lab/pharmacy referral percentage splits.

### 3.2 Compounder Desk (`CompounderDashboard.tsx`)
1. **Sequential OPD Token Generator**: Token assignment (`#TK-XXXX`) with automated queue status update (`awaiting_vitals`).
2. **Multi-Parameter Vitals Matrix**: Blood pressure (Systolic/Diastolic), pulse, SpO2, temp (°F), blood sugar (Fasting/PP/Random), weight (kg), height (cm), and automated BMI calculation (`kg/m²`).
3. **Cash & UPI Payment Counter**: Cash collection logging, UPI QR code display, Cashfree payment status verification.
4. **Eye Dilation Timer Engine**: 15-minute eye dilation countdown timer per patient with automated visual/audio cues (Blue -> Yellow -> Green).
5. **Emergency SOS Priority Routing**: ₹618.00 priority fee payment instantly moves patient to **Priority #1** with a pulsing red alert banner on Doctor Queue.

### 3.3 Pharmacy Fulfillment Engine (`PharmacyDashboard.tsx`)
1. **FEFO Batch Inventory Engine**: Automated First-Expiry-First-Out medicine batch management (`BATCH-2026-X1`), expiry date validation, minimum stock alerts.
2. **Dispensing Worklist**: Real-time prescription item queue ready for 1-click counter dispensing.
3. **1-Click Refill Delivery Engine**: Chronic care delivery dispatch with automated Day 7, Month 1, and Month 3 WhatsApp reminders.

### 3.4 Pathology Diagnostic Lab (`LabDashboard.tsx`)
1. **LOINC Requisition Queue**: Standardized LOINC test catalog (`4544-3` HbA1c, `2160-0` Creatinine, `3024-7` Lipid Profile, `1975-2` Bilirubin), automatic test pricing from SOP.
2. **Sample Verification**: Sample barcode generation (`BAR-XXXX`), sample collection timestamp, technician verification (Lalit Prasad).
3. **Electronic PDF Lab Report Dispatcher**: Instant electronic PDF report creation dispatched directly to patient WhatsApp.

### 3.5 SaaS Executive Admin Console (`SaaSAdminPanel.tsx` & `PodCommandCenter.tsx`)
1. **Pod Command Center**: Live pod operational health, revenue metrics, WABA connections.
2. **System Health Cockpit**: 6-node live pings (Database, Frontend, Network, Sync Queue, Meta Webhooks, CDSS AI), latency metrics, incident telemetry logs.
3. **Autonomous Auto-Healer Sentinel**: 24/7 self-healing monitoring with write-permitted GitHub CI/CD PR creation (`auto-heal-on-failure.yml`).
4. **HITL Escalation Panel**: Collapsible raw exception stack trace console, 1-click **Copy Error Log 📋** button, and interactive **AI Repair Inspector Modal**.

---

## 4. Meta WhatsApp Graph API Engine & 2-Touchpoint Care Loop

### 4.1 WhatsApp Meta Graph API Protocol
- **Outbound Dispatch First**: Meta Graph API request executed FIRST (~250ms), async DB logging SECOND.
- **1-Tap Native Reply Buttons (`type: "button"`)**: Main menus, booking dates, slot selection, and lab report downloads MUST use single-tap reply buttons for instant auto-sending.

### 4.2 2-Touchpoint Clinical & Monetization Care Loop
- **Touchpoint 1 (Morning Consult)**: Doctor hears symptoms, registers vitals, prescribes initial lab tests.
- **Touchpoint 2 (Evening Report Review)**: Upon lab report approval, WhatsApp offers 2 buttons:
  - `Physical Review at Clinic 🏥` (**Primary / Default**): Assigns 04:00 PM - 06:00 PM evening slot & reserves prescribed medicines at Clinic Counter Pharmacy.
  - `Virtual Video Review 💻` (**Emergency / Busy Fallback**): Generates Jitsi link for remote video review & dispatches 1-Click home delivery.
- **4 Premium Member Benefits**: Paying medicine/lab bills at clinic counter unlocks 1 Free Virtual Consult (15-20 days), 10% OFF Refills, WhatsApp Daily Reminders + AI Longitudinal Report, and Instant PDF Lab Reports.

### 4.3 B2B Referral Reward Engine
- Referral codes (`REF-XXXX`) unlock 10% OFF for referrer and new patient, automatically deducting from checkup and medicine bills.

---

## 5. Mandatory 7 Core USPs (Anti-Regression Rules)

> [!CAUTION]
> AI agents MUST NEVER break, remove, or alter any of the following 7 Core USPs:

1. **Sub-300ms Outbound WhatsApp Response Engine**: Outbound Meta Graph API requests MUST be dispatched FIRST (~250ms latency) before session DB updates or non-blocking activity logs.
2. **1-Tap Native WhatsApp Reply Buttons (`type: "button"`)**: Main menus, dates, and slots MUST use single-tap reply buttons for instant auto-sending.
3. **Cashfree Strict Payment Gate**: Unpaid appointments MUST remain in `status: "pending_payment"` and MUST be filtered out from active Doctor EMR and Compounder queues until Cashfree emits `PAYMENT_SUCCESS`.
4. **Emergency SOS Priority #1 Routing**: SOS bookings charge ₹618.00 and move to Priority #1 position at the top of the Doctor Queue with pulsing red alert banner.
5. **1-Click Pharmacy Delivery & 3 Reminders**: Chronic prescriptions trigger 1-Click delivery orders and schedule 3 reminders (Day 7, Month 1, Month 3).
6. **B2B Referral Reward Engine**: Codes (`REF-XXXX`) unlock 10% OFF for referrer and new patient, automatically deducting from checkup and medicine bills.
7. **360° Realtime Supabase Sync**: `realtimeSyncService.ts` streams live Postgres events to Doctor EMR, Compounder Desk, and Pharmacy Counter without page refreshes.

---

## 6. Database Schemas, DDL Contracts & Query Alignment Rules

- **Strict Column Alignment**: Always query and insert using actual database column names (`consented_at`, `registered_at`, `payment_status`, `data_sharing_consent`).
- **Hardened Filters**: Never include query filters targeting columns that do not exist in the database schema.
- **Local Timestamp Cache**: Always maintain local timestamp caches (`local_consent_timestamps`) to prevent background database sync routines from overwriting active local states.

---

## 7. Design System, UI/UX Standards & Viewport Scrolling Guardrails

- **Theme & Palette**: Curated dark-mode glassmorphism styling (`bg-slate-950/80`, `border-slate-800`, `text-zinc-100`).
- **Typography**: Google Fonts Inter & Outfit typography — no browser defaults.
- **Non-Intrusive Viewport Scrolling**: Never use `scrollIntoView()` on container children; manipulate `scrollTop` directly (`container.scrollTop = container.scrollHeight`).

---

## 8. Cashfree Payment Gateway Go-Live Checklist

- **Domain Whitelisting**: `https://app.vitalsync.in` added to Cashfree Merchant Dashboard under *Payment Gateway > Developers > Whitelisting*.
- **API Keys**: Production environment variables set to `PROD_` credentials (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`).
- **Webhook HMAC Verification**: SHA256 signature verification active in `/cashfree-webhook-handler`.
- **Order Re-Verification**: S2S verification active via `/pg/orders/{order_id}`.

---

## 9. Mandatory SQL Script Generation & Edge Function Rules

- **Idempotent DDL Requirement**: Whenever any feature requires database schema changes (new tables, columns, indexes, or RLS policies), AI agents MUST generate idempotent DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- **High-Priority Supabase Editor Warning**: AI agents MUST display a prominent warning directing the user to execute the SQL snippet in the Supabase SQL Editor before running backend or Edge Functions.
- **Zero Secret Exposure**: Secrets and API keys MUST NEVER be committed to Git or exposed in client bundles.
