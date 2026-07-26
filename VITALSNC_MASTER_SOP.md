# VitalSync Master Architecture & Granular SOP Rulebook

> **Authoritative Specification & Operational Blueprint**
> **Product**: VitalSync / Mediflow Enterprise SaaS Ecosystem
> **Version**: 25.0 (Exhaustive Master Specification)

---

## 1. System Architecture & Realtime CDC Data Flow Contract

### 1.1 Supabase Postgres Realtime Engine
- **Engine Latency**: All Supabase Postgres Change Data Capture (CDC) events MUST be debounced at **`250ms`** in `src/services/api.ts` to ensure sub-300ms live synchronization across all active dashboards.
- **CDC Event Channels**: Every active dashboard console MUST subscribe to `RealtimeSyncService.subscribeToLiveClinicUpdates` listening for changes on:
  - `appointments`
  - `unified_invoices`
  - `financial_ledgers`
  - `patient_registry`
  - `medicine_bills`
  - `lab_requisitions`
  - `whatsapp_sessions`
  - `vitalsync_pool_settlements`
  - `clinic_sops`

### 1.2 Fault-Tolerant Outbox & Circuit Breaker
- **Write-Ahead Log (WAL) Outbox**: Offline operations MUST be queued locally in `vitalsync_wal_outbox` and automatically replayed when network reconnects (`window.addEventListener('online')`).
- **Circuit Breaker State Machine**: If database latency spikes or network drops occur, the circuit breaker (`mediflow-circuit-open`) MUST fall back to local standby buffers without throwing unhandled exceptions or blank screens.

### 1.3 State Synchronization Guardrails
- **Parent-Child Sync**: Parent components (`DoctorDashboard.tsx`, `CompounderDashboard.tsx`) MUST listen for `mediflow-financial-update` and `mediflow-state-change` window events to keep top-level state arrays synchronized with child tab calculations.
- **Dynamic Ledger Synthesis**: `BillingService.getFinancialLedgers()` MUST automatically synthesize missing ledger entries for all paid invoices to ensure 100% mathematical agreement between Overview cards and table rows.

---

## 2. Granular 5 Role Console & Feature Map Specifications

### 2.1 Doctor EMR Console (`DoctorDashboard.tsx`)
1. **Consultation Queue**: OPD patient list displays real-time queue status (`awaiting_vitals`, `awaiting_consultation`, `in_consultation`, `completed`). Includes emergency SOS priority indicator.
2. **CDSS AI Scribe**: Natural language symptom processing powered by Groq Llama-3 70B & Gemini Flash fallback for differential diagnosis and RAG longitudinal patient summaries.
3. **Ophthalmic Refraction Grid**: Standardized visual acuity (RE/LE Sph, Cyl, Axis, VA), IOP (Tonometry), Fundus, and Slit Lamp examination notes.
4. **Digital Prescriptions**: Drug dosage (`1-0-1`), duration, special instructions, FEFO stock validation, instant PDF generation & WhatsApp dispatch.
5. **Financials Tab**: SOP-driven commission pool balance, doctor net earnings (100% consult + 40% lab + 20% pharmacy split), downloadable PDF ledger statements in 100% agreement.
6. **Patients Directory**: Searchable registry, ABHA ID linking (`12-3456-7890-1234`), allergy tracking, chronic condition tags, 360-degree patient timeline.
7. **WhatsApp Chat Tab**: Live patient session messages, automated bot fallback toggle, manual doctor reply overrides.
8. **SOP Config Tab**: Custom clinic fee setup, SOP guidelines editor, doctor/lab/pharmacy referral percentage splits.

### 2.2 Compounder Desk (`CompounderDashboard.tsx`)
1. **OPD Token Generator**: Sequential token assignment (`#TK-001`) with automated queue status update (`awaiting_vitals`).
2. **Vitals Capture**: Blood pressure (Systolic/Diastolic), pulse, SpO2, temp (°F), blood sugar (Fasting/PP/Random), weight (kg), height (cm), and automated BMI calculation (`kg/m²`).
3. **Cash & UPI Payment Counter**: Cash collection logging, UPI QR code display, Cashfree payment status verification.
4. **Eye Dilation Timer**: 15-minute eye dilation countdown timer per patient with automated visual/audio alerts (Blue -> Yellow -> Green).
5. **Emergency SOS Priority Routing**: ₹618.00 priority fee payment instantly moves patient to **Priority #1** with a pulsing red alert banner on Doctor Queue.

### 2.3 Pharmacy Counter (`PharmacyDashboard.tsx`)
1. **FEFO Inventory Tracking**: Automated First-Expiry-First-Out medicine batch management (`BATCH-2026-X1`), expiry date validation, minimum stock alerts.
2. **Dispensing Worklist**: Real-time prescription item queue ready for 1-click counter dispensing.
3. **1-Click Refill Delivery**: Chronic care delivery dispatch with automated Day 7, Month 1, and Month 3 WhatsApp reminders.

### 2.4 Pathology Lab (`LabDashboard.tsx`)
1. **LOINC Requisition Queue**: Standardized LOINC test catalog (`4544-3` HbA1c, `2160-0` Creatinine, `3024-7` Lipid Profile, `1975-2` Bilirubin), automatic test pricing from SOP.
2. **Sample Verification**: Sample barcode generation (`BAR-XXXX`), sample collection timestamp, technician verification (Lalit Prasad).
3. **PDF Lab Report Generator**: Instant electronic PDF report creation dispatched directly to patient WhatsApp.

### 2.5 SaaS Admin Console (`SaaSAdminPanel.tsx` & `PodCommandCenter.tsx`)
1. **Pod Command Center**: Live pod operational health, revenue metrics, WABA connections.
2. **System Health Cockpit**: 6-node live pings (Database, Frontend, Network, Sync Queue, Meta Webhooks, CDSS AI), latency metrics, incident telemetry logs.
3. **Auto-Healer Sentinel**: 24/7 autonomous self-healing monitoring with write-permitted GitHub CI/CD PR creation (`auto-heal-on-failure.yml`).
4. **HITL Escalation Cockpit**: Collapsible raw exception stack trace console, 1-click **Copy Error Log 📋** button, and interactive **AI Repair Inspector Modal**.

---

## 3. WhatsApp Engine & 2-Touchpoint Care Loop

### 3.1 WhatsApp Meta Graph API Rules
- **Outbound Dispatch First**: Meta Graph API request executed FIRST (~250ms), async DB logging SECOND.
- **1-Tap Native Reply Buttons (`type: "button"`)**: Main menus, booking dates, slot selection, and lab report downloads MUST use single-tap reply buttons for instant auto-sending.

### 3.2 2-Touchpoint Clinical & Monetization Care Loop
- **Touchpoint 1 (Morning Consult)**: Doctor hears symptoms, registers vitals, prescribes initial lab tests.
- **Touchpoint 2 (Evening Report Review)**: Upon lab report approval, WhatsApp offers 2 buttons:
  - `Physical Review at Clinic 🏥` (**Primary / Default**): Assigns 04:00 PM - 06:00 PM evening slot & reserves prescribed medicines at Clinic Counter Pharmacy.
  - `Virtual Video Review 💻` (**Emergency / Busy Fallback**): Generates Jitsi link for remote video review & dispatches 1-Click home delivery.
- **4 Premium Member Benefits**: Paying medicine/lab bills at clinic counter unlocks 1 Free Virtual Consult (15-20 days), 10% OFF Refills, WhatsApp Daily Reminders + AI Longitudinal Report, and Instant PDF Lab Reports.

### 3.3 B2B Referral Reward Engine
- Referral codes (`REF-XXXX`) unlock 10% OFF for referrer and new patient, automatically deducting from checkup and medicine bills.

---

## 4. Mandatory 7 Core USPs (Anti-Regression Rules)

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

## 5. Database Schema & Query Alignment Rules

- **Strict Column Alignment**: Always query and insert using actual database column names (`consented_at`, `registered_at`, `payment_status`, `data_sharing_consent`).
- **Hardened Filters**: Never include query filters targeting columns that do not exist in the database schema.
- **Local Timestamp Cache**: Always maintain local timestamp caches (`local_consent_timestamps`) to prevent background database sync routines from overwriting active local states.

---

## 6. Design System & UI/UX Standards

- **Theme & Palette**: Curated dark-mode glassmorphism styling (`bg-slate-950/80`, `border-slate-800`, `text-zinc-100`).
- **Typography**: Google Fonts Inter & Outfit typography — no browser defaults.
- **Non-Intrusive Scrolling**: Never use `scrollIntoView()` on container children; manipulate `scrollTop` directly (`container.scrollTop = container.scrollHeight`).

---

## 7. Cashfree Payment Gateway Go-Live Checklist

- **Domain Whitelisting**: `https://app.vitalsync.in` added to Cashfree Merchant Dashboard under *Payment Gateway > Developers > Whitelisting*.
- **API Keys**: Production environment variables set to `PROD_` credentials (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`).
- **Webhook HMAC Verification**: SHA256 signature verification active in `/cashfree-webhook-handler`.
- **Order Re-Verification**: S2S verification active via `/pg/orders/{order_id}`.

---

## 8. Mandatory SQL Script Generation & Edge Function Rules

- **Idempotent DDL Requirement**: Whenever any feature requires database schema changes (new tables, columns, indexes, or RLS policies), AI agents MUST generate idempotent DDL (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- **High-Priority Supabase Editor Warning**: AI agents MUST display a prominent warning directing the user to execute the SQL snippet in the Supabase SQL Editor before running backend or Edge Functions.
- **Zero Secret Exposure**: Secrets and API keys MUST NEVER be committed to Git or exposed in client bundles.
