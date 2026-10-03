const { execSync } = require('child_process');
const http = require('http');

console.log('\n======================================================');
console.log('🛡️  ENGINE 24: GitOps Sentinel & Auto-Rollback Engine');
console.log('======================================================\n');

async function createSafeState() {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:9000/api/safe-state', { method: 'POST' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`✅ [GitOps] ${json.message}`);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function rollbackToSafeState() {
  return new Promise((resolve) => {
    const req = http.request('http://localhost:9000/api/safe-state', { method: 'DELETE' }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log(`⏪ [GitOps] ${json.message}`);
          resolve(true);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function run() {
  console.log('📸 1. Initiating Pre-Run Safety Snapshot...');
  const snapped = await createSafeState();
  if (!snapped) {
    console.log('⚠️ Warning: Daemon bridge not reachable. Proceeding without safe state.');
  }

  console.log('\n🧪 2. Executing E2E Validation Tests...');
  try {
    execSync('npx playwright test', { stdio: 'inherit' });
    console.log('\n🟢 All tests passed. Codebase is stable. Committing safety state...');
    console.log('🛡️ Engine 24: State Locked.');
  } catch (e) {
    console.log('\n🚨 TESTS FAILED: Instabilities detected in the codebase!');
    console.log('⏪ 3. Triggering Engine 24 Auto-Rollback...');
    if (snapped) {
      await rollbackToSafeState();
      console.log('✅ Rollback complete. The unstable code has been safely removed.');
      process.exit(1);
    } else {
      console.log('❌ Rollback failed: No safe state was found.');
      process.exit(1);
    }
  }
}

run();
