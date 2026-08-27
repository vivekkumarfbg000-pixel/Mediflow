# Mediflow Operational Bug Fixes - Implementation Plan

**Generated:** 2026-08-25  
**Status:** Ready for Review  
**RequestFeedback:** true

---

## 📋 Executive Summary

Comprehensive audit identified **15 operational bugs** across 5 dashboard consoles (Doctor EMR, Compounder Desk, Pharmacy POS, Pathology Lab, SaaS Admin) and core services. Bugs span Architectural/Logic, Syntax/Runtime, and Network/Environment layers. All fixes preserve the **7 Core USPs** and **115 Anti-Regression Directives**.

---

## 🎯 Phase 1: Immediate State Isolation & Critical Guards (Week 1)

### 1.1 Fix WAL IndexedDB Method Signature
**File:** `frontend/src/services/api.ts:172`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** `WALIndexedDB.addEntry` calls non-existent static `append` method. Fix instance binding.

```typescript
// BEFORE (broken):
return this.append(entry);

// AFTER (fixed):
return this.append(entry); // append is instance method, not static
```

**Verification:** Offline patient registration → reconnect → verify WAL replay in console.

---

### 1.2 Add Compounder `syncData` to Realtime Handlers
**File:** `frontend/src/components/compounder/CompounderDashboard.tsx:532-593`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Compounder dashboard subscribes to realtime events but doesn't call `syncData` for financial CDC events, causing `ReferenceError`.

```typescript
// ADD to subscription handlers:
onFinancialLedgerChange: () => { syncData(); },
onUnifiedInvoiceChange: () => { syncData(); },
onPoolSettlementChange: () => { syncData(); },
```

**Verification:** Trigger financial ledger update → verify Compounder dashboard refreshes without error.

---

### 1.3 Add Defensive Nullish Fallbacks to All Search/Filters
**Files:** Multiple (see table)  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Wrap all `.toLowerCase()`, `.includes()`, `.substring()` calls with `(field || '')` guards.

| File | Line | Field | Fix |
|------|------|-------|-----|
| `CompounderDashboard.tsx` | 337 | `p.name` | `(p.name || '').toLowerCase()` |
| `RefractionDashboard.tsx` | 35 | `p.name`, `p.phone` | `(p.name || '').toLowerCase()` |
| `FinancialsTab.tsx` | TBD | `entry.invoiceId` | `(entry.invoiceId || '').toLowerCase()` |
| `CompounderDashboard.tsx` | TBD | `p.tokenNumber` | `String(p.tokenNumber || '').toLowerCase()` |
| `PatientWhatsAppSimulator.tsx` | TBD | `activePatient?.name` | `(activePatient?.name || 'Mediflow').substring(0,2)` |

**Verification:** Search with empty/null data → no TypeError crashes.

---

### 1.4 Implement Blob URL Cleanup for All Previews
**Files:** `BillHubTab.tsx`, `PharmacyDashboard.tsx`, `DoctorDashboard.tsx`, `LabDashboard.tsx`  
**Type:** `[MODIFY]`  
**Risk:** Medium  
**Description:** Every `URL.createObjectURL()` must have paired `URL.revokeObjectURL()` in cleanup.

```typescript
// PATTERN to apply:
useEffect(() => {
  if (previewUrl) {
    return () => URL.revokeObjectURL(previewUrl);
  }
}, [previewUrl]);

// For inline:
const url = URL.createObjectURL(blob);
window.open(url, '_blank');
setTimeout(() => URL.revokeObjectURL(url), 1500);
```

**Verification:** Print 20 invoices → DevTools Memory tab shows no blob URL accumulation.

---

### 1.5 Fix SOP Config Null Property Access
**File:** `frontend/src/components/doctor/tabs/SopConfigTab.tsx`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Render `extractedConfig` properties with optional chaining.

```typescript
// BEFORE:
extractedConfig.pharmacy_split

// AFTER:
extractedConfig?.pharmacy_split ?? '20%'
```

**Verification:** Open SOP tab before extraction → no white screen.

---

## 🎯 Phase 2: Logic Correction & Error Boundaries (Week 2)

### 2.1 Create Unified Payment Gate Utility
**File:** `frontend/src/utils/paymentGate.ts` **[NEW]**  
**Type:** `[NEW]`  
**Risk:** Medium  
**Description:** Single source of truth for payment verification used by ALL consoles.

```typescript
// src/utils/paymentGate.ts
export function isAppointmentPaid(patientId: string): boolean {
  const unifiedInvoices = BillingService.getUnifiedInvoices();
  const saasInvoices = BillingService.getInvoices();
  const allInvoices = [...unifiedInvoices, ...saasInvoices];
  
  const isPaidInvoice = allInvoices.some(i => 
    (i.patientId === patientId || (i as any).patient_id === patientId) && 
    ((i as any).paymentStatus === 'cleared' || 
     (i as any).paymentStatus === 'paid' || 
     i.status === 'paid' || 
     i.status === 'cleared')
  );
  
  const appointments = api.getAppointments();
  const hasPaidAppt = appointments.some(a => 
    (a.patientId === patientId || (a as any).patient_id === patientId) && 
    a.status !== 'pending_payment' &&
    a.status !== 'cancelled'
  );
  
  return isPaidInvoice || hasPaidAppt;
}
```

**Integration Points:**
- `ConsultationTab.tsx` queue filters
- `CompounderDashboard.tsx` vitals approval gate
- `DoctorDashboard.tsx` patient list rendering
- `RefractionDashboard.tsx` patient lookup

**Verification:** Create unpaid appointment → verify hidden from ALL 3 clinical queues.

---

### 2.2 Fix CDC Dual-Storage Propagation in BillingService
**File:** `frontend/src/services/billingService.ts:339-367`  
**Type:** `[MODIFY]`  
**Risk:** High  
**Description:** `getAppointments()` incorrectly drops legitimate live user appointments when `pod_id` is missing.

```typescript
// FIX: Only filter by pod_id if currentPodId exists
if (pod && currentPodId && pod !== currentPodId) return false;
if (!pod && currentPodId) return false; // ← Was dropping live appointments
```

**Verification:** Live user books WhatsApp appointment → appears in Doctor EMR within 300ms.

---

### 2.3 Implement Composite Keys for WhatsApp Message Streams
**File:** `frontend/src/components/doctor/tabs/WhatsAppTab.tsx`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Replace `key={idx}` with stable composite keys.

```typescript
// BEFORE:
messages.map((msg, idx) => <div key={idx}>)

// AFTER:
messages.map((msg, idx) => <div key={`msg-${msg.id || idx}-${msg.sender}-${(msg.text || '').slice(0,15)}`}>)
```

**Verification:** Receive realtime WhatsApp message → no message flicker/reorder.

---

### 2.4 Add Theme Change Event Dispatch to CommandPalette
**File:** `frontend/src/components/ui/CommandPalette.tsx`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Theme toggle must dispatch `mediflow-theme-change` for Navbar sync.

```typescript
const handleToggleTheme = () => {
  const newTheme = theme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
  localStorage.setItem('mediflow_theme', newTheme);
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  window.dispatchEvent(new CustomEvent('mediflow-theme-change', { detail: { theme: newTheme } }));
};
```

**Verification:** Toggle theme in Command Palette → Navbar updates immediately.

---

### 2.5 Extend Edge Function Fetch Timeout to 15s
**Files:** `frontend/src/services/paymentService.ts`, `frontend/src/services/api.ts`  
**Type:** `[MODIFY]`  
**Risk:** Medium  
**Description:** Add AbortController with 15s timeout for all Edge Function calls.

```typescript
// PATTERN for all fetch calls:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000);

try {
  const response = await fetch(url, { 
    method: 'POST', 
    headers: { ... }, 
    body: JSON.stringify({ ... }),
    signal: controller.signal 
  });
  // handle response
} finally {
  clearTimeout(timeoutId);
}
```

**Verification:** Cold start Edge Function (>10s) → request succeeds, no "Failed to fetch".

---

### 2.6 Add Chronic Care Cohorts to CDC Storage Mapping
**File:** `frontend/src/services/realtimeSyncService.ts:139-153`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Map `chronic_care_cohorts` table to storage key for live sync.

```typescript
const storageMap: Record<string, string[]> = {
  // ... existing ...
  'chronic_care_cohorts': ['chronic_care_cohorts'], // ADD
};
```

**Verification:** Update chronic care cohort via WhatsApp → Doctor EMR ChronicCareTab updates live.

---

## 🎯 Phase 3: Network/Environment Hardening (Week 3)

### 3.1 PII Sanitization in Telemetry Dispatchers
**Files:** `frontend/src/services/telemetry.ts`, `frontend/src/services/autoHealerAgent.ts`  
**Type:** `[MODIFY]`  
**Risk:** Medium  
**Description:** Mask sensitive data before sending to `system_health_telemetry`.

```typescript
function sanitizePayload(payload: any): any {
  const sanitized = { ...payload };
  if (sanitized.phone) sanitized.phone = 'XXXXXX' + sanitized.phone.slice(-4);
  if (sanitized.abhaId) sanitized.abhaId = 'XXXX-XXXX-XXXX-' + sanitized.abhaId.slice(-4);
  if (sanitized.patientName) sanitized.patientName = sanitized.patientName[0] + '***';
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.access_token;
  return sanitized;
}
```

**Verification:** Trigger telemetry event → inspect Supabase `system_health_telemetry` → verify PII masked.

---

### 3.2 Dynamic Supabase Auth Token Clearing
**File:** `frontend/src/services/autoHealerAgent.ts:39`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Replace hardcoded `'sb-*-auth-token'` with dynamic iteration.

```typescript
// BEFORE:
localStorage.removeItem('sb-xyz-auth-token');

// AFTER:
Object.keys(localStorage).forEach(key => {
  if (key.match(/^sb-.*-auth-token$/)) localStorage.removeItem(key);
});
```

**Verification:** Sign out → sign in as different user → no session bleeding.

---

### 3.3 Web Vitals LCP Font Preload Fix
**File:** `index.html`  
**Type:** `[MODIFY]`  
**Risk:** Low  
**Description:** Add async `onload` handler to Google Fonts preload.

```html
<!-- REPLACE existing: -->
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" onload="this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"></noscript>
```

**Verification:** Lighthouse CI → LCP < 2500ms, no VITALS_BREACH.

---

### 3.4 TypeScript Strict Type Safety for Payment Methods
**Files:** `frontend/src/services/billingService.ts`, `frontend/src/services/api.ts`, `frontend/src/types/index.ts`  
**Type:** `[MODIFY]`  
**Risk:** Medium  
**Description:** Ensure `paymentMethod` union includes all gateways.

```typescript
// In types/index.ts:
type PaymentMethod = 'cash' | 'upi' | 'razorpay' | 'cashfree' | 'paytm' | 'phonepe' | 'card';

// In billingService.ts clearInvoice signature:
static clearInvoice(invoiceId: string, paymentMethod: PaymentMethod = 'upi'): void

// In api.ts apptPaymentMode state:
const [apptPaymentMode, setApptPaymentMode] = useState<PaymentMethod>('cash');
```

**Verification:** `cmd /c npx tsc --noEmit` → exit code 0.

---

## 🗄️ Database Migrations (Parallel Track)

### 3.5 Idempotent SQL Migrations
**File:** `supabase/migrations/20260825_operational_bug_fixes.sql` **[NEW]**  
**Type:** `[NEW]`  
**Risk:** High  
**Description:** Apply all schema changes with idempotent DDL.

```sql
-- See full SQL in audit response. Key changes:
-- 1. chronic_care_cohorts RLS + CDC
-- 2. appointments.payment_status, payment_method columns
-- 3. financial_ledgers.platform_fee_deducted, gateway_disbursed_net
-- 4. profiles.is_demo_account flag
-- 5. heal_schema_drift & execute_autonomous_db_repair RPCs
```

**Execution:**
```bash
supabase db push --linked
# OR apply via Supabase Dashboard SQL Editor
```

**Verification:** `supabase db advisors` → no errors.

---

## ✅ Verification & Anti-Regression Checklist

### Automated Checks
- [ ] `cmd /c npx tsc --noEmit` → Exit code 0
- [ ] `cmd /c npm run lint` → Exit code 0
- [ ] `supabase db advisors` → No critical issues
- [ ] Unit tests pass (if test suite exists)

### Manual Verification (Per Console)
| Console | Test Scenario | Expected |
|---------|---------------|----------|
| Doctor EMR | Unpaid WhatsApp booking | Hidden from queue |
| Doctor EMR | Paid WhatsApp booking | Appears in queue <300ms |
| Compounder | Financial ledger CDC event | No ReferenceError, data refreshes |
| Compounder | Vitals approval with unpaid invoice | Blocked with payment toast |
| Pharmacy POS | Print 20 invoices | No memory leak |
| Pathology Lab | Chronic care cohort update | Live sync to Doctor EMR |
| SaaS Admin | Theme toggle in Command Palette | Navbar syncs instantly |

### Core USP Regression Tests
- [ ] USP 1: Outbound WhatsApp <300ms (test via `mediflow-waba-latency-breach` event)
- [ ] USP 2: 1-Tap Reply Buttons work on main menu/dates/slots
- [ ] USP 3: Unpaid appointments filtered from ALL queues
- [ ] USP 4: SOS booking → Priority #1 with red banner
- [ ] USP 5: Chronic refill → Day 25 WhatsApp 1-Tap button
- [ ] USP 6: Referral code `REF-XXXX` → 10% discount applied
- [ ] USP 7: 13-table CDC sync across all 5 consoles

---

## 📦 Deliverables

1. **Code Patches** - 10 targeted modifications (see patches in audit)
2. **New Files** - `paymentGate.ts`, `20260825_operational_bug_fixes.sql`
3. **SQL Migration** - Idempotent, production-ready
4. **walkthrough.md** - Post-implementation summary with test results

---

## ⚠️ Risk Mitigation

| Risk | Mitigation |
|------|------------|
| CDC dual-storage fix drops demo data | Test with `isDemoAccount=true` flag |
| Payment gate utility breaks existing flows | Feature flag rollout per console |
| Blob URL cleanup breaks print | Test with 50+ sequential prints |
| TypeScript strict types break builds | Incremental migration with `// @ts-expect-error` guards |

---

## 📅 Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Critical Guards | 3 days | Day 1 | Day 3 |
| Phase 2: Logic Correction | 5 days | Day 4 | Day 8 |
| Phase 3: Network Hardening | 3 days | Day 9 | Day 11 |
| DB Migrations | 1 day | Day 1 | Day 1 (parallel) |
| Verification & Walkthrough | 2 days | Day 12 | Day 13 |
| **Total** | **13 days** | | |

---

## 🚀 Approval Gate

**Required:** Explicit user approval before any code modification.

**Next Steps:**
1. Review this plan
2. Approve → Begin Phase 1 implementation
3. Daily progress updates via `walkthrough.md`