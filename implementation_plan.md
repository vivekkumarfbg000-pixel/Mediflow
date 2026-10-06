# 🏛️ J.A.R.V.I.S. CTO Implementation Plan: Phase 21 — Military-Grade Hardware & IoT Ambient Sync

## 📌 Executive Summary
**Phase 21** elevates the VitalSync Mediflow Clinic OS into a true **Zero-Data-Entry hardware-integrated clinical ecosystem** (Rule Zero). By engineering a native Web Bluetooth API (`navigator.bluetooth`) and WebSerial API hardware driver layer, compounders and nurses no longer need to manually type vitals into forms. Digital Blood Pressure Monitors, Pulse Oximeters, Glucometers, and Smart Weighing Scales stream their IEEE-11073 / GATT telemetry directly into the patient profile, syncing across the 250ms debounced Postgres CDC mesh to Doctor EMR consoles in real-time.

---

## 🎯 Target Files & Blast Radius Audit

| File | Role | Changes | Blast Radius / Consuming Files |
| :--- | :--- | :--- | :--- |
| `frontend/src/services/iotDeviceService.ts` | **NEW** Core IoT Hardware Driver | • Web Bluetooth GATT drivers for BP (`0x1810`), SpO2 (`0x1822`), Glucose (`0x1808`), Scale (`0x181D`)<br>• WebSerial ASCII stream parser for multi-parameter clinical monitors<br>• Autonomous hardware simulator for instant test runs without physical devices<br>• Event subscriber architecture for ambient stream distribution | Consumed by `CompounderDashboard.tsx`, `ConsultationTab.tsx`, `military-grade-suite.cjs` |
| `frontend/src/types/index.ts` | Type Definitions | • Add `IoTDeviceReading`, `IoTDeviceType`, `IoTConnectionStatus` interfaces<br>• Enrich `PatientVitals` with optional `deviceSource`, `bmi`, and `bloodSugarContext` | Consumed across frontend services (fully backwards-compatible) |
| `frontend/src/components/compounder/CompounderDashboard.tsx` | Compounder Operations & Desk | • Add non-intrusive Ambient IoT Peripheral Dock widget inside Vitals & Intake section<br>• 1-Tap Bluetooth connection buttons with real-time signal status<br>• Instant auto-fill into Vitals intake states (`instantBpSys`, `instantBpDia`, `pulse`, `spo2`, `sugar`, `weight`)<br>• Zero autonomous popups or modals (Rule 1.3 invariant) | `App.tsx` (blast radius 1, protected by Rule 1.1) |
| `frontend/src/services/patientService.ts` | Patient & Vitals Data Engine | • Add helper method `ingestIoTVitals(patientId, reading)` to atomically update local cache, trigger audit log, and dispatch dual-write to Supabase `patient_registry` | `App.tsx`, `CompounderDashboard.tsx`, `DoctorDashboard.tsx` |
| `frontend/scripts/military-grade-suite.cjs` | Military Grade Test Suite | • Add **SECTION 11: Hardware & IoT GATT Protocol Telemetry Engine (Phase 21)**<br>• Test binary GATT packet decoding for BP, SpO2, Glucose, Weight<br>• Test WebSerial parser and IEEE-11073 SFLOAT conversions | Standalone CI/CD test runner |
| `supabase/migrations/20261007000001_iot_device_telemetry.sql` | Database Migration | • Idempotent table `public.iot_device_events` for audit trail with RLS and pod isolation | Supabase Database |

---

## 🔬 Architecture & Technical Specification

### 1. Web Bluetooth API & GATT Specifications
- **Blood Pressure Service (`0x1810`) / Characteristic (`0x2A35`)**:
  - Flag byte inspection: unit resolution (mmHg vs kPa), timestamp presence, pulse rate presence.
  - Extracts Systolic (mmHg), Diastolic (mmHg), MAP (Mean Arterial Pressure), and Pulse Rate (bpm).
- **Pulse Oximeter Service (`0x1822`) / Characteristic (`0x2A5F` / `0x2A5E`)**:
  - Extracts SpO2 percentage (70–100%) and Pulse Rate.
- **Glucose Service (`0x1808`) / Characteristic (`0x2A18`)**:
  - Parses IEEE-11073 16-bit SFLOAT (mantissa + exponent).
  - Normalizes concentration to mg/dL (1 mmol/L $\times$ 18.0182).
- **Weight Scale Service (`0x181D`) / Characteristic (`0x2A9D`)**:
  - Unit flag handling (resolves kg vs lbs $\times$ 0.453592).
  - Automatic BMI computation if height is recorded.

### 2. WebSerial API Driver for Bench Multipara Monitors
- Connects to USB/UART serial ports (9600 / 115200 baud).
- Reads incoming text stream via `TextDecoderStream` + `TransformStream` (line splitter).
- Regex parser for standard ASCII protocols (`BP:120/80,HR:72,SPO2:98,TEMP:98.4`).

### 3. Hardware Simulator Mode (Zero-Blocking Testing)
- Built-in simulation generator that produces realistic, clinically valid GATT telemetry (`118/78 mmHg`, `74 bpm`, `98% SpO2`, `96 mg/dL`, `68.5 kg`).
- Enables 100% test automation and instant demos on laptops/devices without physical medical Bluetooth peripherals.

### 4. Realtime CDC Synchronization to Doctor Consultation Cockpit
- Telemetry events persist to `patient_registry` via `PatientService`.
- Triggers window event `mediflow-state-change` and Supabase CDC stream.
- Doctor's `ConsultationTab.tsx` immediately reflects the updated vitals badges beside the patient's name in <300ms without compounder typing.

---

## 🛡️ Anti-Regression & Safety Invariants (Rule Zero & Rules 1–100)
1. **Rule Zero (Zero-Data-Entry Doctrine)**: Peripheral readings flow autonomously; manual entry remains available as a secondary fallback.
2. **Rule 1.1 (Clinic OS Fortress Shield)**: No alterations to OCR prescription engine, doctor consultation workflow, or smart queue ordering.
3. **Rule 1.3 (Zero Autonomous Modals)**: Device pairing and data application require explicit user clicks; no surprise popups or forced redirects.
4. **Sub-300ms Performance**: Parsing algorithms execute in <1ms; non-blocking asynchronous event loops.
5. **Database Idempotence**: All SQL migrations use `CREATE TABLE IF NOT EXISTS` and idempotent policy creation.

---

## 🚦 Verification Playbook

1. **GATT Protocol Test (Military-Grade Suite)**:
   - Run `node frontend/scripts/military-grade-suite.cjs`.
   - Verify all 11 sections pass with 100% score (including new IoT GATT Section 11).
2. **TypeScript Compilation Verification**:
   - Run `npx tsc --noEmit` to ensure exit code 0 with 0 errors.
3. **Compounder Desk UI Verification**:
   - Verify non-intrusive IoT status bar mounts in Compounder Dashboard.
   - Click "Test Simulator" or connect BLE device; verify vitals populate and save cleanly.
4. **Doctor EMR Live Sync Verification**:
   - Confirm vitals badges in Doctor `ConsultationTab.tsx` update live for the selected patient.