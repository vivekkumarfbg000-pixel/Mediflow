const fs = require('fs');
const path = require('path');

// 🛡️ VITALSYNC CLINIC OS: IMMUTABLE INVARIANTS VERIFIER 🛡️
// This script runs in CI/CD and enforces "Rule Zero: The Immutable Clinic OS Manifesto".
// It statically analyzes the codebase to ensure no AI or developer bypasses the core architecture.

console.log('🔍 Running VitalSync Clinic OS Invariants Verification...');

const SRC_DIR = path.join(__dirname, '../src');

// 1. Enforce Realtime CDC Engine Integrity
function verifyNoManualPolling() {
  const filesToCheck = [
    'components/doctor/DoctorDashboard.tsx',
    'components/compounder/CompounderDashboard.tsx',
    'components/lab/LabDashboard.tsx',
  ];

  for (const file of filesToCheck) {
    const fullPath = path.join(SRC_DIR, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Using setInterval for data polling is strictly forbidden in favor of Realtime CDC.
      if (content.match(/setInterval\([^)]*api\.get|setInterval\([^)]*fetch/)) {
        console.error(`❌ INVARIANT VIOLATION: Manual setInterval polling detected in ${file}. Use RealtimeSyncService CDC instead.`);
        process.exit(1);
      }
    }
  }
}

// 2. Enforce Smart Queue Inviolability
function verifySmartQueueFlow() {
  const labDashboardPath = path.join(SRC_DIR, 'components/lab/LabDashboard.tsx');
  if (fs.existsSync(labDashboardPath)) {
    const content = fs.readFileSync(labDashboardPath, 'utf8');
    // Ensure Lab Reports are routed to the Compounder and do not bypass it.
    if (content.match(/dispatchLabReportWhatsApp/)) {
      console.error(`❌ INVARIANT VIOLATION: Direct WhatsApp dispatch detected in LabDashboard. Reports MUST flow through the Compounder Evening Slot queue.`);
      process.exit(1);
    }
  }
}

// 3. Enforce 1-Tap WhatsApp Protocol
function verifyWhatsAppTemplates() {
  const notificationServicePath = path.join(SRC_DIR, 'services/clinicalNotificationService.ts');
  if (fs.existsSync(notificationServicePath)) {
    const content = fs.readFileSync(notificationServicePath, 'utf8');
    // Ensure templates use explicit buttons (interactive messages via Meta API)
    // For this check, we just ensure the service exists and hasn't been stripped.
    if (!content.includes('pushWhatsAppMessageFromBot')) {
      console.error(`❌ INVARIANT VIOLATION: The pushWhatsAppMessageFromBot function is missing from clinicalNotificationService.ts.`);
      process.exit(1);
    }
  }
}

try {
  verifyNoManualPolling();
  verifySmartQueueFlow();
  verifyWhatsAppTemplates();
  console.log('✅ All Clinic OS Invariants Verified. Rule Zero is intact.');
  process.exit(0);
} catch (error) {
  console.error('❌ Verification failed due to an error:', error);
  process.exit(1);
}
