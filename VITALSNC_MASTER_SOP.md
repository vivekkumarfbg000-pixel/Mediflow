# VitalSync Master Architecture & SOP Rulebook

> **Authoritative Specification & Operational Blueprint**
> **Product**: VitalSync / Mediflow Enterprise SaaS Ecosystem
> **Version**: 24.0 (Production Master)

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

## 2. 5 Role Console Specifications

### 2.1 Doctor EMR Console (`DoctorDashboard.tsx`)
- **Tabs**: Consultation, Financials, Patients Directory, WhatsApp, SOP Config.
- **CDSS AI Scribe**: Groq Llama-3 70B primary model with Gemini Flash fallback for real-time symptom analysis.
- **Refraction Grid**: Standardized visual acuity (RE/LE Sph, Cyl, Axis, VA), IOP, and Fundus documentation.
- **Financial Overview**: SOP-driven commission pool balance, 100% consult fee + lab referral split + medicine referral split.

### 2.2 Compounder Desk (`CompounderDashboard.tsx`)
- **OPD Token Generator**: Sequential token assignment (`#TK-001`) with automated queue status update (`awaiting_vitals`).
- **Vitals Capture**: Blood pressure, pulse, SpO2, temperature, blood sugar, BMI logging.
- **Emergency SOS Routing**: ₹618.00 priority fee payment instantly moves patient to **Priority #1** with a pulsing red alert banner.
- **Dilation Timer**: 15-minute eye dilation timer with automated visual/audio alerts.

### 2.3 Pharmacy Counter (`PharmacyDashboard.tsx`)
- **FEFO Inventory Engine**: First-Expiry-First-Out batch tracking (`BATCH-2026-X1`).
- **Dispensing Worklist**: Real-time prescription item queue ready for 1-click counter dispensing.
- **1-Click Refill Delivery**: Chronic care delivery dispatch with automated Day 7, Month 1, and Month 3 WhatsApp reminders.

### 2.4 Pathology Lab (`LabDashboard.tsx`)
- **LOINC Requisition Queue**: Standardized LOINC test catalog (`4544-3` HbA1c, `2160-0` Creatinine).
- **Sample Verification**: Barcode sample collection verification by lab technician.
- **PDF Report Generation**: Instant electronic lab report PDF dispatch to patient WhatsApp.

### 2.5 SaaS Admin Console (`SaaSAdminPanel.tsx` & `PodCommandCenter.tsx`)
- **Pod Command Center**: Live pod operational health, revenue metrics, WABA connections.
- **Auto-Healer Sentinel**: 24/7 self-healing monitor with write-permitted GitHub CI/CD PR creation (`auto-heal-on-failure.yml`).
- **HITL Escalation Cockpit**: Collapsible raw traceback log containers, 1-click **Copy Error Log 📋** button, and interactive **AI Repair Inspector Modal**.

---

## 3. Mandatory 7 Core USPs (Anti-Regression Rules)

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

## 4. Database Schema & Query Alignment Rules

- **Strict Column Alignment**: Always query and insert using actual database column names (`consented_at`, `registered_at`, `payment_status`, `data_sharing_consent`).
- **Hardened Filters**: Never include query filters targeting columns that do not exist in the database schema.
- **Local Timestamp Cache**: Always maintain local timestamp caches (`local_consent_timestamps`) to prevent background database sync routines from overwriting active local states.

---

## 5. Design System & UI/UX Aesthetics

- **Theme & Palette**: Curated dark-mode glassmorphism styling (`bg-slate-950/80`, `border-slate-800`, `text-zinc-100`).
- **Typography**: Google Fonts Inter & Outfit typography — no browser defaults.
- **Non-Intrusive Scrolling**: Never use `scrollIntoView()` on container children; manipulate `scrollTop` directly (`container.scrollTop = container.scrollHeight`).

---

## 6. Cashfree Payment Gateway Go-Live Checklist

- **Domain Whitelisting**: `https://app.vitalsync.in` added to Cashfree Merchant Dashboard under *Payment Gateway > Developers > Whitelisting*.
- **API Keys**: Production environment variables set to `PROD_` credentials (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`).
- **Webhook HMAC Verification**: SHA256 signature verification active in `/cashfree-webhook-handler`.
- **Order Re-Verification**: S2S verification active via `/pg/orders/{order_id}`.
