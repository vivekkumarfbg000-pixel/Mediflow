/**
 * Mediflow — Website Not Loading Diagnostic Script
 * Run with: node .agents/skills/resolve-website-not-loading/diagnose.js
 *
 * This script checks for the most common reasons the Mediflow frontend
 * fails to load and prints a ranked list of likely causes.
 */

const fs   = require('fs');
const path = require('path');

const FRONTEND_SRC = path.join(__dirname, '../../../frontend/src');

console.log('\n🔍 MEDIFLOW WEBSITE DIAGNOSTIC\n' + '='.repeat(50));

let issuesFound = 0;

// ── 1. Check for Circular Imports ──────────────────────────────────────────────
console.log('\n[1/5] Checking for circular import chains...');

function findImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const imports = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/);
      if (match && match[1].startsWith('.')) {
        imports.push(match[1]);
      }
    }
    return imports;
  } catch {
    return [];
  }
}

const apiFile     = path.join(FRONTEND_SRC, 'services/api.ts');
const healerFile  = path.join(FRONTEND_SRC, 'services/autoHealerAgent.ts');
const teleFile    = path.join(FRONTEND_SRC, 'services/telemetry.ts');

const apiImports    = findImports(apiFile);
const healerImports = findImports(healerFile);

const apiImportsHealer  = apiImports.some(i => i.includes('autoHealerAgent'));
const healerImportsApi  = healerImports.some(i => i.includes('/api'));

if (apiImportsHealer && healerImportsApi) {
  console.log('  ❌ CRITICAL: Circular import detected!');
  console.log('     api.ts ↔ autoHealerAgent.ts are importing each other.');
  console.log('     FIX: Remove the unused import from one of these files,');
  console.log('     or use dynamic import(): const { api } = await import("./api")');
  issuesFound++;
} else {
  console.log('  ✅ No api.ts ↔ autoHealerAgent.ts circular import detected.');
}

// Check telemetry circular chain
const apiImportsTelemetry    = apiImports.some(i => i.includes('telemetry'));
const teleImportsHealer      = findImports(teleFile).some(i => i.includes('autoHealerAgent'));

if (apiImportsTelemetry && teleImportsHealer) {
  console.log('  ⚠️  WARNING: api.ts → telemetry.ts → autoHealerAgent.ts chain detected.');
  console.log('     If autoHealerAgent imports api.ts, this is a 3-way circular chain!');
  issuesFound++;
} else {
  console.log('  ✅ No api.ts → telemetry.ts → autoHealerAgent.ts circular chain.');
}

// ── 2. Check Dev Server ─────────────────────────────────────────────────────────
console.log('\n[2/5] Checking dev server configuration...');

const viteConfig = path.join(__dirname, '../../../frontend/vite.config.ts');
if (fs.existsSync(viteConfig)) {
  console.log('  ✅ vite.config.ts found.');
} else {
  console.log('  ❌ vite.config.ts missing!');
  issuesFound++;
}

const packageJson = path.join(__dirname, '../../../frontend/package.json');
if (fs.existsSync(packageJson)) {
  const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
  const hasDevScript = pkg.scripts && pkg.scripts.dev;
  console.log(`  ${hasDevScript ? '✅' : '❌'} "dev" script in package.json: ${pkg.scripts?.dev || 'MISSING'}`);
  if (!hasDevScript) issuesFound++;
} else {
  console.log('  ❌ frontend/package.json missing!');
  issuesFound++;
}

const nodeModules = path.join(__dirname, '../../../frontend/node_modules');
if (fs.existsSync(nodeModules)) {
  console.log('  ✅ node_modules exists.');
} else {
  console.log('  ❌ node_modules missing! Run: npm install');
  issuesFound++;
}

// ── 3. Check Supabase Client ────────────────────────────────────────────────────
console.log('\n[3/5] Checking Supabase client configuration...');

const supabaseClient = path.join(FRONTEND_SRC, 'lib/supabaseClient.ts');
if (fs.existsSync(supabaseClient)) {
  const content = fs.readFileSync(supabaseClient, 'utf8');
  const hasUrl  = content.includes('VITE_SUPABASE_URL') || content.includes('supabase.co');
  const hasKey  = content.includes('VITE_SUPABASE_ANON_KEY') || content.includes('eyJhbGci');
  console.log(`  ${hasUrl ? '✅' : '❌'} Supabase URL configured`);
  console.log(`  ${hasKey ? '✅' : '❌'} Supabase Anon Key configured`);
  if (!hasUrl || !hasKey) issuesFound++;
} else {
  console.log('  ❌ supabaseClient.ts missing!');
  issuesFound++;
}

// ── 4. Check Main Entry Files ───────────────────────────────────────────────────
console.log('\n[4/5] Checking main entry files...');

const criticalFiles = [
  'main.tsx',
  'App.tsx',
  'index.css',
  'services/api.ts',
  'services/whatsappService.ts',
  'context/ClinicContext.tsx',
  'lib/supabaseClient.ts',
  'components/shared/AuthGateway.tsx',
];

for (const file of criticalFiles) {
  const fullPath = path.join(FRONTEND_SRC, file);
  const exists = fs.existsSync(fullPath);
  console.log(`  ${exists ? '✅' : '❌'} src/${file}`);
  if (!exists) issuesFound++;
}

// ── 5. Check for Dead/Unused Imports in Key Files ────────────────────────────────
console.log('\n[5/5] Checking for dead imports in api.ts...');

if (fs.existsSync(apiFile)) {
  const content = fs.readFileSync(apiFile, 'utf8');

  const imports = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^import\s+\{\s*([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (match) {
      const names = match[1].split(',').map(n => n.trim().split(' ')[0]);
      const source = match[2];
      imports.push({ names, source });
    }
  }

  // Check for known dead imports
  for (const imp of imports) {
    for (const name of imp.names) {
      if (!name) continue;
      const regex = new RegExp(`\\b${name}\\b`);
      // Count occurrences (subtract 1 for the import line itself)
      const occurrences = (content.match(regex) || []).length - 1;
      if (occurrences === 0) {
        console.log(`  ⚠️  Possibly unused import: "${name}" from "${imp.source}"`);
      }
    }
  }
  console.log('  ✅ Import audit complete.');
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
if (issuesFound === 0) {
  console.log('✅ ALL CHECKS PASSED — Frontend should load correctly.');
  console.log('   If still having issues, check browser DevTools console for runtime errors.\n');
} else {
  console.log(`❌ FOUND ${issuesFound} ISSUE(S) — Fix the above before the frontend will load.`);
  console.log('   See SKILL.md in this directory for detailed fix instructions.\n');
}
