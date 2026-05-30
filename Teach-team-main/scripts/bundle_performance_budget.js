import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('──────────────────────────────────────────────────────────────────');
console.log('⚡ GITOPS GUARDIAN: RUNNING BUNDLE SIZE & PERFORMANCE BUDGET SCAN');
console.log('──────────────────────────────────────────────────────────────────\n');

// 0. Load Universal Tech Team Configuration
const configPath = path.resolve(__dirname, '../tech_team_config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`⚙️  Loaded Universal Configuration: Project [${config.projectName || 'Unnamed'}]`);
  } catch (e) {
    console.warn(`⚠️  Failed parsing tech_team_config.json: ${e.message}`);
  }
}

// 1. Configure dynamic budgets from config parameters
const jsBudgetKB = config.frontend?.singleJsBudgetKB || 250;
const cssBudgetKB = config.frontend?.singleCssBudgetKB || 100;
const totalBudgetKB = config.frontend?.totalBudgetKB || 1000;

const JS_SINGLE_CHUNK_BUDGET_BYTES = jsBudgetKB * 1024;
const CSS_SINGLE_CHUNK_BUDGET_BYTES = cssBudgetKB * 1024;
const TOTAL_BUNDLE_BUDGET_BYTES = totalBudgetKB * 1024;

let issuesFound = 0;

// Resolve distribution folder path dynamically
const distDir = config.frontend?.buildDirectory 
  ? path.resolve(__dirname, '..', config.frontend.buildDirectory)
  : path.resolve(__dirname, '../dist');

if (!fs.existsSync(distDir)) {
  console.log(`\nℹ️  No production "${path.relative(__dirname, distDir)}" directory detected. Please run "npm run build" to check compilation budgets.`);
  console.log('   Enforcing a dry-run local check of src/ directory size instead...');
  
  // Dry run checking the src/ asset size
  let srcSizeBytes = 0;
  const srcDir = config.frontend?.srcDirectory 
    ? path.resolve(__dirname, '..', config.frontend.srcDirectory)
    : path.resolve(__dirname, '../src');

  function walkSrc(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkSrc(fullPath);
      } else {
        srcSizeBytes += stat.size;
      }
    });
  }
  walkSrc(srcDir);
  console.log(`   Local uncompressed src/ size: ${(srcSizeBytes / 1024).toFixed(2)} KB.`);
  console.log('\n──────────────────────────────────────────────────────────────────');
  console.log('🎉 BUDGET DRY-RUN COMPLETED: PENDING BUILD GENERATION.');
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(0);
}

console.log(`\n📂 Auditing Compiled Production Distribution Assets in "${path.relative(__dirname, distDir)}"...`);
let totalJsBytes = 0;
let totalCssBytes = 0;
let totalFilesChecked = 0;

function auditDistFolder(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      auditDistFolder(fullPath);
    } else {
      totalFilesChecked++;
      const sizeKB = (stat.size / 1024).toFixed(2);
      
      if (file.endsWith('.js')) {
        totalJsBytes += stat.size;
        if (stat.size > JS_SINGLE_CHUNK_BUDGET_BYTES) {
          console.warn(`   ⚠️  [Bloat Alert] Single Javascript chunk "${file}" exceeds budget. Size: ${sizeKB} KB (Limit: ${jsBudgetKB} KB).`);
          issuesFound++;
        } else {
          console.log(`   ✅ Javascript chunk: ${file} is healthy (${sizeKB} KB)`);
        }
      } else if (file.endsWith('.css')) {
        totalCssBytes += stat.size;
        if (stat.size > CSS_SINGLE_CHUNK_BUDGET_BYTES) {
          console.warn(`   ⚠️  [Bloat Alert] Single CSS stylesheet "${file}" exceeds budget. Size: ${sizeKB} KB (Limit: ${cssBudgetKB} KB).`);
          issuesFound++;
        } else {
          console.log(`   ✅ CSS stylesheet: ${file} is healthy (${sizeKB} KB)`);
        }
      }
    }
  });
}

auditDistFolder(distDir);

const totalBytes = totalJsBytes + totalCssBytes;
console.log('\n📊 Production Compilation Resource Summary:');
console.log(`   - Checked assets: ${totalFilesChecked} files.`);
console.log(`   - Total compiled Javascript: ${(totalJsBytes / 1024).toFixed(2)} KB (Limit: ${jsBudgetKB} KB / file)`);
console.log(`   - Total compiled CSS: ${(totalCssBytes / 1024).toFixed(2)} KB (Limit: ${cssBudgetKB} KB / file)`);
console.log(`   - Total bundle footprint: ${(totalBytes / 1024).toFixed(2)} KB (Limit: ${totalBudgetKB} KB)`);

if (totalBytes > TOTAL_BUNDLE_BUDGET_BYTES) {
  console.warn(`   ⚠️  [Performance Drift] Total application footprint exceeds combined release budget of ${totalBudgetKB} KB.`);
  issuesFound++;
} else {
  console.log(`   ✅ Bundle foot-print is inside production budget parameters.`);
}

console.log('\n──────────────────────────────────────────────────────────────────');
if (issuesFound === 0) {
  console.log('🎉 PERFORMANCE BUDGET SUCCESS: ALL ASSETS CONFIRMED ULTRA-LIGHTWEIGHT.');
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(0);
} else {
  console.error(`🛑 PERFORMANCE GATES BLOCKED: ${issuesFound} assets exceed production bundle budgets.`);
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(1);
}
