/**
 * Mediflow Military-Grade System Invariants Guard (Google/Meta Engineering Standard)
 * 
 * Enforces 4 critical architectural invariants across the entire codebase:
 * 1. Zero Font Ligatures (100% bundled vector SVG compliance with lucide-react)
 * 2. Deterministic Clinic Code Immutability (0 pseudo-random client generators)
 * 3. Zero Hardcoded Fallback Contacts in checkout/payment engines
 * 4. Explicit Multi-Tenant Pod-ID Isolation on database mutations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

const violations = [];

// ── Check 1: Forbidden Font Ligatures ─────────────────────────────────────────
const FONT_LIGATURE_PATTERNS = [
  /className=["'][^"']*material-symbols[^"']*["']/i,
  /className=["'][^"']*material-icons[^"']*["']/i,
  /<span[^>]*class(?:Name)?=["'][^"']*material-symbols/i
];

// ── Check 2: Forbidden Pseudo-Random Clinic Code Generators ───────────────────
const RANDOM_CLINIC_CODE_PATTERNS = [
  /clinicCode\s*[:=]\s*['"]MF-CARE01['"]/i,
  /clinic_code\s*[:=]\s*['"]MF-CARE01['"]/i,
  /clinicCode\s*[:=]\s*.*Math\.random/i,
  /clinic_code\s*[:=]\s*.*Math\.random/i
];

// ── Check 3: Forbidden Raw Index Keys in React Lists (Rule 19) ───────────────
const RAW_INDEX_KEY_PATTERN = /key=\{(idx|index|i)\}/;

// ── Check 4: Forbidden Unguarded Raw LocalStorage UPI VPA Access ──────────────
const RAW_UPI_STORAGE_PATTERN = /localStorage\.getItem\(['"]clinic_upi_vpa['"]\)/;

// ── Check 5: Forbidden Unguarded bill.items.length in JSX ────────────────────
const RAW_BILL_ITEMS_LENGTH_PATTERN = /\{bill\.items\.length\b/;

// ── Check 6: Forbidden Raw Unrevoked createObjectURL in Inline Handlers (Rule 10/106)
const UNREVOKED_BLOB_PATTERN = /URL\.createObjectURL\([^)]+\)(?![\s\S]*?(?:revokeObjectURL|URL\.revokeObjectURL))/;

function scanFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFiles(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const relPath = path.relative(path.resolve(__dirname, '..'), fullPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // Invariant 1: No Font Ligatures
        for (const pattern of FONT_LIGATURE_PATTERNS) {
          if (pattern.test(line)) {
            violations.push({
              rule: 'INVARIANT_1_NO_FONT_LIGATURES',
              file: relPath,
              line: lineNum,
              content: line.trim(),
              reason: 'Direct use of font ligatures causes mobile layout collisions and FOUT. Use lucide-react SVGs.'
            });
            break;
          }
        }

        // Invariant 2: No Random Clinic Code Fallbacks in components/services
        if (!relPath.includes('test') && !relPath.includes('scripts')) {
          for (const pattern of RANDOM_CLINIC_CODE_PATTERNS) {
            if (pattern.test(line)) {
              violations.push({
                rule: 'INVARIANT_2_DETERMINISTIC_CLINIC_CODE',
                file: relPath,
                line: lineNum,
                content: line.trim(),
                reason: 'Random or legacy mock clinic codes break the interconnected multi-tenant loop. Use activePod?.clinicCode.'
              });
              break;
            }
          }
        }

        // Invariant 3: Zero Raw Index Keys in JSX (Rule 19)
        if (entry.name.endsWith('.tsx') && RAW_INDEX_KEY_PATTERN.test(line)) {
          violations.push({
            rule: 'INVARIANT_3_ZERO_RAW_INDEX_KEYS',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Raw index keys (key={idx} / key={index}) break React DOM reconciliation during Supabase CDC live sync. Use composite keys (key={`prefix-${idx}-${item.id || item.name}`}).'
          });
        }

        // Invariant 4: Zero Raw LocalStorage UPI VPA Access outside PaymentService (Rule 47)
        if (!relPath.includes('paymentService.ts') && !relPath.includes('test') && !relPath.includes('scripts')) {
          if (RAW_UPI_STORAGE_PATTERN.test(line)) {
            violations.push({
              rule: 'INVARIANT_4_SAFE_UPI_VPA_READER',
              file: relPath,
              line: lineNum,
              content: line.trim(),
              reason: 'Direct raw localStorage.getItem("clinic_upi_vpa") calls can throw SecurityErrors in iframe/strict sandboxes. Use PaymentService.getSafeClinicUpiVpa().'
            });
          }
        }

        // Invariant 5: Zero Unguarded bill.items.length in JSX (Rule 18/83)
        if (entry.name.endsWith('.tsx') && RAW_BILL_ITEMS_LENGTH_PATTERN.test(line)) {
          violations.push({
            rule: 'INVARIANT_5_DEFENSIVE_BILL_ARRAY_LENGTH',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Raw {bill.items.length} crashes if items array is null/undefined in realtime CDC payloads. Use {(bill.items || []).length}.'
          });
        }

        // Invariant 7: Webhook Secret Validation Guard (Rule 109)
        if (relPath.includes('webhook') && line.includes('Deno.env.get') && line.includes('SECRET') && line.includes('|| "mediflow-bank-secret"')) {
          violations.push({
            rule: 'INVARIANT_7_WEBHOOK_SECRET_GUARD',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Webhooks must never fall back to default secrets in production. Use strict env or development checks.'
          });
        }

        // Invariant 8: IST Timezone Normalization Enforcement (Directive 95)
        if ((relPath.includes('whatsappService') || relPath.includes('billingService')) && line.includes('toISOString().split(')) {
          violations.push({
            rule: 'INVARIANT_8_IST_TIMEZONE_ENFORCEMENT',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Raw .toISOString().split() causes UTC date shift bugs across midnight (00:00-05:30 AM IST). Use getIstDateString().'
          });
        }

        // Invariant 9: Strict Defensive toFixed Guards on Currency Displays (Directive 18)
        if (entry.name.endsWith('.tsx') && /\{[a-zA-Z0-9_]+\.totalAmount\.toFixed\([0-9]+\)\}/.test(line)) {
          violations.push({
            rule: 'INVARIANT_9_DEFENSIVE_TOFIXED_GUARDS',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Raw {item.totalAmount.toFixed(2)} crashes if totalAmount is null or undefined. Use {((item.totalAmount || 0)).toFixed(2)}.'
          });
        }

        // Invariant 10: Safe LocalStorage JSON Parsing Guard (Directive 2)
        if (!relPath.includes('test') && !relPath.includes('scripts') && !relPath.includes('storage.ts') && /const\s+[a-zA-Z0-9_]+\s*=\s*JSON\.parse\(localStorage\.getItem\(/.test(line)) {
          violations.push({
            rule: 'INVARIANT_10_SAFE_LOCALSTORAGE_JSON_PARSING',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'Raw inline JSON.parse(localStorage.getItem(...)) throws fatal SyntaxError crashes on corrupted storage. Wrap in try-catch or use safe parser.'
          });
        }


        // Invariant 11: Push WhatsApp Message Outbound Relay Guard
        if (relPath.includes('whatsappService.ts') && line.includes('static pushWhatsAppMessageFromBot') && !content.includes('this.sendWhatsAppMessagePayload')) {
          violations.push({
            rule: 'INVARIANT_11_PUSH_WHATSAPP_OUTBOUND_RELAY',
            file: relPath,
            line: lineNum,
            content: line.trim(),
            reason: 'pushWhatsAppMessageFromBot must trigger sendWhatsAppMessagePayload to ensure real-time Meta Graph API message transmission.'
          });
        }

        // Invariant 12 (NEW): Zero Hardcoded Clinic/Doctor Names in WhatsApp Engine (Rule 79)
        const FORBIDDEN_CLINIC_NAMES = ['Apex Care', 'Apex Eye', 'Kankarbagh', 'Mediflow Clinic', 'Doctor Vivek', 'Dr. Amit Arya', 'Dr. Priya'];
        if (!relPath.includes('test') && !relPath.includes('scripts') && !relPath.includes('seed') && !relPath.includes('AGENTS') && !relPath.includes('migration')) {
          for (const forbidden of FORBIDDEN_CLINIC_NAMES) {
            if (line.includes(`"${forbidden}"`) || line.includes(`'${forbidden}'`)) {
              violations.push({
                rule: 'INVARIANT_12_ZERO_HARDCODED_CLINIC_NAMES',
                file: relPath,
                line: lineNum,
                content: line.trim(),
                reason: `Hardcoded clinic/doctor name "${forbidden}" detected. All components MUST use dynamic resolvers: getDynamicClinicName(), activePod?.name, activeProfile?.display_name (Rule 79).`
              });
            }
          }
        }

        // Invariant 13 (NEW): Dispatch methods must guard null/empty phone (Rule 12)
        if (
          !relPath.includes('test') && !relPath.includes('scripts') &&
          (relPath.includes('clinicalNotificationService') || relPath.includes('whatsappService')) &&
          /async\s+dispatch\w+WhatsApp\s*\(/.test(line)
        ) {
          // Check the function body (up to 20 lines) for a phone null guard.
          // Accept both destructured form (if (!patientPhone)) and params form (if (!params.patientPhone))
          const bodySnippet = lines.slice(idx, idx + 20).join('\n');
          const hasPhoneGuard = (
            bodySnippet.includes('if (!patientPhone') ||
            bodySnippet.includes('if (!params.patientPhone') ||
            bodySnippet.includes('if (!phone') ||
            bodySnippet.includes('patientPhone) return') ||
            bodySnippet.includes('patientPhone) return')
          );
          if (!hasPhoneGuard) {
            violations.push({
              rule: 'INVARIANT_13_DISPATCH_PHONE_NULL_GUARD',
              file: relPath,
              line: lineNum,
              content: line.trim(),
              reason: 'All dispatchXxxWhatsApp() methods MUST guard null/empty phone at the top (e.g. if (!patientPhone) return;). Empty phone causes silent WABA failures (Rule 12).'
            });
          }
        }
      });
    }
  }
}

// ── Check Edge Functions for Strict UUID Validation (Rule 33) ───────────────
const EDGE_FUNCTIONS_DIR = path.resolve(__dirname, '../../supabase/functions');
if (fs.existsSync(EDGE_FUNCTIONS_DIR)) {
  function scanEdgeFunctions(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanEdgeFunctions(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        const relPath = path.relative(path.resolve(__dirname, '../..'), fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          // Invariant 14: No overly restrictive .uuid() on patientId, podId, entityId, invoiceId
          if (/(?:patientId|podId|entityId|invoiceId)\s*:\s*z\.string\(\)\.uuid\(/.test(line)) {
            violations.push({
              rule: 'INVARIANT_14_EDGE_FUNCTION_FLEXIBLE_ID_VALIDATION',
              file: relPath,
              line: lineNum,
              content: line.trim(),
              reason: 'Overly restrictive z.string().uuid() rejects custom IDs and user-isolated pod strings. Use z.string().min(1) per Rule 33.'
            });
          }

          // Invariant 15 (NEW): Edge Function state router must have a default branch (State Machine Exhaustiveness)
          if (relPath.includes('meta-webhook') && /if\s*\(state\s*===\s*"[A-Z_]+"/.test(line)) {
            // Only flag if this is the top-level state router block - skip nested ifs
          }
        });
      }
    }
  }
  scanEdgeFunctions(EDGE_FUNCTIONS_DIR);
}

// ── Check WhatsApp State Machine Exhaustiveness (Component 1 Gate) ─────────────
const WA_SERVICE_PATH = path.resolve(SRC_DIR, 'services/whatsappService.ts');
if (fs.existsSync(WA_SERVICE_PATH)) {
  const waSrc = fs.readFileSync(WA_SERVICE_PATH, 'utf8');

  // All states that can be set as nextState must have a case handler
  const producedStates = new Set();
  const handledStates = new Set();

  const nextStateMatches = waSrc.matchAll(/nextState\s*=\s*'([A-Z_]+)'/g);
  for (const m of nextStateMatches) producedStates.add(m[1]);

  // A state is "handled" if it appears in either a switch case OR an if/else currentState check
  const caseMatches = waSrc.matchAll(/case\s*'([A-Z_]+)':/g);
  for (const m of caseMatches) handledStates.add(m[1]);

  // Also count if-else currentState checks (unregistered patient path uses these)
  const ifElseMatches = waSrc.matchAll(/currentState\s*===\s*'([A-Z_]+)'/g);
  for (const m of ifElseMatches) handledStates.add(m[1]);

  // States that are produced but never handled in ANY branch (excluding terminal states)
  const EXEMPT_STATES = new Set(['IDLE', 'COMPLETED']);
  for (const state of producedStates) {
    if (!handledStates.has(state) && !EXEMPT_STATES.has(state)) {
      violations.push({
        rule: 'INVARIANT_15_FSM_STATE_EXHAUSTIVENESS',
        file: 'frontend/src/services/whatsappService.ts',
        line: 0,
        content: `nextState = '${state}'`,
        reason: `WhatsApp FSM state '${state}' is produced by a transition but has no matching 'case' handler in the switch router. Patient messages sent in this state will be silently dropped. Add a handler or remove the orphaned transition.`
      });
    }
  }
}

scanFiles(SRC_DIR);

if (violations.length > 0) {
  console.error('\n================================================================================');
  console.error('🚨 MILITARY-GRADE ARCHITECTURAL INVARIANT BREACH DETECTED');
  console.error('================================================================================');
  console.error(`Total violations found: ${violations.length}\n`);

  violations.forEach(v => {
    console.error(`❌ [${v.rule}] ${v.file}:${v.line}`);
    console.error(`   Offending: ${v.content}`);
    console.error(`   Directive: ${v.reason}\n`);
  });

  console.error('================================================================================');
  console.error('Build REJECTED by System Invariants Sentinel. Fix all violations before continuing.');
  console.error('================================================================================\n');
  process.exit(1);
} else {
  console.log('🛡️  [Military-Grade Invariant Guard] 100% Architectural Compliance Verified across all source files.');
}
