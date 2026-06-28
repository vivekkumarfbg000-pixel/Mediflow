# Mediflow Care - Developer Context & Brain Map (`brain.md`)

This file serves as the centralized knowledge map for the **Mediflow Care Ecosystem**. AI coding assistants and developers should read this file first to understand the project structure, architecture, database schemas, role flows, security guards, and active work states without needing to recursively scan the entire repository.

---

## 🏥 1. Project Overview & Architecture
Mediflow is a multi-tenant clinical software suite connecting small clinic networks, pharmacies, and pathology labs under a single unified and secure care loop.

### Core Stack
- **Frontend**: React (Vite) + TypeScript + Tailwind CSS (located in `frontend/`)
- **Backend**: Python (FastAPI) (located in `backend/`)
- **Database**: Supabase / PostgreSQL with multi-tenant row-level security (RLS) (located in `supabase/`)
- **Desktop Client**: Rust (Tauri) (located in `desktop/`)
- **Mobile Client**: Expo/React Native (located in `mobile/`)

---

## 🗂️ 2. Codebase Organization

> [!NOTE]
> **Reference Folders & Development Safety**:
> Folders like `Teach-team-main/` and root-level `scratch/` files are kept intact as historical references, policy frameworks, and diagnostic test scripts. They are ignored by active bundlers and compilers, which target only `frontend/`, `backend/`, `supabase/`, `desktop/`, and `mobile/` respectively. Active development paths must follow the map below:

```
├── .agents/                 # Workspace-specific agent rules & skills
│   └── skills/              # Auto-Healer, Resolve Website, Supabase best practices
├── backend/                 # FastAPI backend router, middleware, and engine
├── desktop/                 # Tauri desktop container for wrapper app
├── mobile/                  # Expo/React Native application
├── supabase/                # Database migrations, seed data, and schema definitions
│   └── migrations/          # Incremental SQL migrations defining RLS and triggers
└── frontend/                # Main Vite web application
    ├── public/              # Icons, sw.js, pwa manifest
    └── src/
        ├── assets/          # Static images/vector graphics
        ├── components/      # Role-specific and shared components
        │   ├── admin/       # SaaS Admin and Command Center
        │   ├── billing/     # Bills and invoice generator
        │   ├── compounder/  # Compounder Operations dashboard
        │   ├── doctor/      # Clinical refraction charts, biomarker grids, WhatsApp tab
        │   ├── lab/         # Pathology laboratory dashboard
        │   ├── pharmacy/    # POS system, Seasonal forecast widgets
        │   └── shared/      # AuthGateway, LandingPage, CommandBar, ErrBoundary
        ├── context/         # ClinicContext, SpecializationContext
        ├── services/        # API hooks, WhatsApp, Telemetry, Auto-Healer services
        └── types/           # TS type definitions
```

---

## 🛢️ 3. Database Schema & RLS Gating
Mediflow enforces tenant isolation at the database layer using Postgres Row Level Security (RLS) mapped to a unique `pod_id`.

### Core Entities
1. **`pods`**: Clinical network partitions. Each clinic has a unique `clinic_code` (e.g. `MF-XXXX`).
2. **`profiles`** (in `public.profiles`): Clinician profiles mapped to `auth.users` IDs.
   - Columns: `id` (UUID), `entity_id` (UUID), `role` (`doctor`, `compounder`, `lab_technician`, `pharmacist`, `platform_admin`), `display_name`, `consultation_fee`.
3. **`patients`**: Patient demographics.
4. **`appointments`**: Booked slots. Status: `pending_payment`, `ready_for_consult`, `completed`, `scheduled`.
5. **`invoices`**: Split-payment invoices. Type: `consult`, `lab`, `pharmacy`. Status: `unpaid`, `paid`.
6. **`lab_reports`**: Lab scans and PDFs uploaded by pathology techs.
7. **`prescriptions`**: Structured JSONB medicine list.
8. **`audit_log`**: System auditing logs.

### Multi-Tenancy Resolution
- **Resolver Function**: `public.get_user_pod()` returns the `entity_id` / `pod_id` of the current authenticated user from their profile.
- RLS policies ensure clinicians can only select, insert, or modify data containing their own `pod_id` or `entity_id`.

---

## 🔐 4. Core Gating & Security Policies

### Registration Gating (DevContext Prompt Guard)
*The signup and login pages are completely hidden from the landing page by default under a secure locked clinician portal teaser card.*
- **Teaser Lock Card**: Initially renders a "Clinician Portal Locked" card containing quick CTAs. Replaces the inputs until unlocked.
- **Unlocking Gating**: 
  - Clicking "Sign In" (header nav or placeholder card) sets `showAuthGate` to `true` and reveals the Sign In form.
  - Clicking "Get Started" (header nav, bottom CTA, or placeholder card) initiates the **Eligibility Check Modal**.
- **Eligibility Check Modal**:
  1. **Age verification**: Checked box confirming user is 18+.
  2. **Format/Account Check**: Enforces valid email formats and blocks default demo credentials (`doctor@mediflow.com`, etc.).
  3. **Regulatory compliance check**: Confirms agreement to HIPAA, GDPR, CCPA, and database isolation rules.
  4. **Encryption environment**: Enforces HTTPS in production (redirects HTTP requests to secure SSL).
- **Form unlocking**: Upon successful validation, state `isSignupUnlocked` and `showAuthGate` both become `true`, and the corresponding Doctor Signup or Partner Register form is displayed.
- **Dynamic menu rendering**: If `allowSignup` is false, `Doctor Signup` and `Partner Join: New Registration` options are completely hidden from the active tab selector, and manual switches fall back safely to `signin`.

### Security & Secrets Protection (Rule `AGENTS.md`)
- **NO API keys, access tokens, or credentials** (like `.env`, `.env.local`) may be committed to Git.
- Verify that `.gitignore` maintains rules to exclude credentials.

---

## 🎭 5. Clinical Roles & Dashboards

- **Doctor (`doctor`)**: Prescribes medicine, views patient diagnostic history, schedules vitals, and communicates via the Simulated WhatsApp Tab.
- **Compounder (`compounder`)**: Handles patient registrations, schedules clinic visits, prints invoices, and schedules dispatches.
- **Lab Technician (`lab_technician`)**: Receives pathology requisitions, uploads report PDFs, and injects diagnostic summaries directly into patient histories.
- **Pharmacist (`pharmacist`)**: Dispenses prescriptions, processes billing POS transactions, and reviews seasonal inventory forecasting.
- **SaaS Platform Admin (`platform_admin` / `admin`)**: Manages pod system health metrics, approves clinic bank accounts, and views SaaS scaling safeguards.

### Mobile Responsiveness & Optimization
- **Dynamic Mobile Header**: The global `Navbar` renders a dynamic, role-aware top header navigation showing the current clinician name and active dashboard module title.
- **Doctor Mobile Navigation**: The Doctor dashboard leverages a touch-friendly bottom tab bar navigation and swipe-gesture horizontal tab switching.
- **Clinical Dashboard Tabs**: The Compounder, Lab, and Pharmacy dashboards use horizontally scrollable, non-wrapping tab navigation selectors that are fully responsive and touch-enabled, allowing seamless module section transitions on smaller viewports.
- **Layouts & Forms**: Clinical forms, diagnostic summaries, and patient registries collapse into single-column grids (`grid-cols-1`) on mobile and scale to multi-column layouts on larger screen widths.

---

## 📈 6. Project History & Evolutionary Roadmap (Supabase Migrations)

Mediflow's database has evolved through a structured migration roadmap. Key architectural changes include:

### Phase 1: Tenancy, Telemetry, and Core Operations (`2026-05-25` to `2026-05-27`)
- **Pod Partitioning & WABA Schemas**: Set up multi-tenant partitions for WABA connections and core user structures (`20260525000000`, `20260525000001`).
- **Agentic Task Pipeline & Telemetry**: Initialized triggers and logs to monitor query performance and background automation health (`20260526000001`, `20260526000002`).
- **Commission & Medicine Billing**: Added transaction logic for pharmacy split-billing, clinician revenue cuts, and platform low-value protections (`20260526000003` to `20260526000005`).
- **Walk-in & Pod Health**: Created clinic status trackers and automated walk-in lab integrations (`20260527000001`).

### Phase 2: Dynamic Predictions & Integrations (`2026-05-28` to `2026-05-31`)
- **Report Storage & Forecaster Models**: Implemented pathology file buckets and structured drug inventory forecasting parameters (`20260528092924`, `20260528150000`).
- **Cashfree Split-Billing**: Integrated the `cashfree_order_id` references and bank onboarding mechanisms for clinician payouts (`20260530000001`, `20260530000002`).
- **Performance Indexing & Interconnects**: Added cross-pod queries and composite indices to cache RLS queries and avoid recursive evaluation bottlenecks (`20260531000000` to `20260531000020`).
- **Vitals Synchronization**: Created DB synchronization rules to push patient vitals from offline caches to central stores (`20260531000003`).

### Phase 3: SaaS Scaling, Auto-Healing, & Gating (`2026-06-04` to `2026-06-25`)
- **Scaling Safeguards & Analytics**: Implemented automated constraints to block abusive platform usage and added admin dashboards (`20260604000003`, `20260604000004`).
- **Self-Healing Phase 2**: Upgraded the Auto-Healer to repair corrupted profiles, restore truncated fields, and automatically fix authentication triggers (`20260605000005`, `20260605000006`).
- **RLS & Security Hardening**: Addressed RLS recursion bugs, locked public policies to authenticated roles, isolated profiles self-access, and hardened Search Paths (`20260605000000` to `20260607000001`).
- **Login Sentry & Audit Log**: Deployed security log monitors and client rate-limiting via the database check function `check_login_sentry` (`20260625000003`).

---

## ⚡ 7. Edge Functions & Payment Integrations (`supabase/functions/`)

All Supabase edge functions utilize the `_shared/` modules for rate-limiting and standard CORS headers.

1. **`cashfree-order`**: Handles invoice validation and calls the Cashfree payment gateway APIs to initiate secure billing orders.
2. **`cashfree-vendor-sync`**: Synchronizes pharmacy and lab vendor bank credentials to Cashfree for automated split payouts.
3. **`cashfree-webhook`**: Consumes transaction callbacks from Cashfree to mark invoices as `paid` and activate prescription/report dispatches.
4. **`meta-webhook`**: Receives WhatsApp status changes and customer message responses, piping them into the clinical database.
5. **`notify-developer-webhook`**: Automated webhook notifier that posts critical platform failures and telemetry alerts directly to support channels.
6. **`whatsapp-dispatch`**: Dispatches outbound clinical updates, token notifications, and report PDFs to patient numbers using WhatsApp business APIs.

---

## 🔬 8. Core Workflows & Services (`frontend/src/services/`)

- **Billing (`billingService.ts`)**: Integrates split-billing rules and coordinates Cashfree payment cycles for pharmacy, consultation, and lab tickets.
- **Diagnostics (`labService.ts`)**: Manages diagnostic upload workflows and coordinates direct lab-to-doctor reports.
- **Refraction & Specialization (`encounterService.ts` / `SpecializationContext.tsx`)**: Coordinates specialized clinical forms (e.g. Ophthalmology refraction grids, Cardiology biomarker inputs) and manages vitals sync.
- **Inventory Forecasts (`forecastService.ts` / `SeasonalForecastWidget.tsx`)**: Processes pharmaceutical inventory data through a client-side seasonal forecasting engine to project stocking levels.
- **Self-Healing Core (`autoHealerAgent.ts` / `telemetry.ts`)**: Coordinates proactive telemetry audits. Automatically triggers database reconciliations if profile issues are encountered.
- **WhatsApp Sandbox (`whatsappService.ts`)**: Models and simulates patient conversations and outbound templates in the sandbox environment.

---

## 🛠️ 9. Commands and Operations Guide

To avoid Windows terminal sandboxing/ACL issues (which block write streams to NUL under certain automated runners), execute the following commands manually on your local console for testing:

- **Vite Development Server**: `npm run dev` (run from `frontend/`)
- **TypeScript Compilation Check**: `npx tsc --noEmit` (run from `frontend/`)
- **Vite Build Bundle Check**: `npm run build` (run from `frontend/`)
- **E2E UI Test Runner**: `node scripts/verify_ui_e2e.js` (run from workspace root)
- **Supabase Local Testing**: CLI commands to sync databases should target local development containers.
