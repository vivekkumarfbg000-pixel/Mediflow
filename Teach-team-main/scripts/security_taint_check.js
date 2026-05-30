import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('──────────────────────────────────────────────────────────────────');
console.log('🛡️  SECOPS SENTRY: RUNNING STATIC TAINT & INJECTION SECURITY AUDIT');
console.log('──────────────────────────────────────────────────────────────────\n');

// 0. Load Universal Tech Team Configuration
const configPath = path.resolve(__dirname, '../tech_team_config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`⚙️  Loaded Universal Configuration: Project [${config.projectName || 'Unnamed'}]`);
  } catch (e) {
    console.warn(`⚠️  Failed parsing tech_team_config.json. Using standard defaults: ${e.message}`);
  }
}

let issuesFound = 0;

// Resolve directories dynamically
const srcDir = config.frontend?.srcDirectory 
  ? path.resolve(__dirname, '..', config.frontend.srcDirectory) 
  : path.resolve(__dirname, '../src');

const migrationsDir = config.database?.migrationsDirectory 
  ? path.resolve(__dirname, '..', config.database.migrationsDirectory) 
  : path.resolve(__dirname, '../supabase/migrations');

// 1. Audit Codebase for Injection Sinks & Advanced Data-Flow Taint Tracking
console.log('\n📂 1. Running Advanced Static Taint & Injection Flow Audit...');
let codeFilesScanned = 0;

function scanForInjections(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanForInjections(fullPath);
      }
    } else if (/\.(ts|js|tsx|jsx)$/.test(file)) {
      codeFilesScanned++;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      const taintedVariables = new Set();
      
      // Pass 1: Identify Sources and Propagate Taints
      lines.forEach((line) => {
        const directSourceMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:req\.body|req\.query|params|payload|formData|userInput|user_input)/i);
        if (directSourceMatch) {
          taintedVariables.add(directSourceMatch[1]);
        }
        
        taintedVariables.forEach(taintedVar => {
          const propagationMatch = new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*.*${taintedVar}`, 'i').exec(line);
          if (propagationMatch && propagationMatch[1] !== taintedVar) {
            taintedVariables.add(propagationMatch[1]);
          }
        });
      });
      
      // Pass 2: Verify Sinks for Unsanitized Taints
      lines.forEach((line, index) => {
        if (line.includes('`select') || line.includes('`insert') || line.includes('`update') || line.includes('`delete')) {
          if (line.includes('${') && !line.includes('sanitize') && !line.includes('parameterize') && !line.includes('parseInt')) {
            console.warn(`   ⚠️  [Taint Alert] Unsanitized string interpolation in SQL query in ${path.relative(__dirname, fullPath)} (line ${index + 1}).`);
            console.warn(`      Code: ${line.trim()}`);
            issuesFound++;
          }
        }
        
        taintedVariables.forEach(taintedVar => {
          const sinkMatches = [
            `eval\\(.*${taintedVar}`,
            `execute_raw\\(.*${taintedVar}`,
            `execute\\(.*${taintedVar}`,
            `query\\(.*${taintedVar}`
          ];
          
          sinkMatches.forEach(sinkPattern => {
            const regex = new RegExp(sinkPattern, 'i');
            if (regex.test(line) && !line.includes('//') && !line.includes('sanitize') && !line.includes('parameterize')) {
              console.warn(`   ⚠️  [Taint Vulnerability] Tainted variable "${taintedVar}" passed directly into sink in ${path.relative(__dirname, fullPath)} (line ${index + 1}).`);
              console.warn(`      Code: ${line.trim()}`);
              issuesFound++;
            }
          });
        });
        
        if (line.includes('eval(') && !line.includes('//')) {
          console.warn(`   ⚠️  [Critical Sink] Unsafe dynamic evaluation 'eval()' detected in ${path.relative(__dirname, fullPath)} (line ${index + 1}).`);
          issuesFound++;
        }
      });
    }
  });
}
scanForInjections(srcDir);
console.log(`   Checked ${codeFilesScanned} source code file(s).`);

// 2. Audit SQL Migration Scripts for RLS & SECURITY DEFINER Policies
console.log('\n📂 2. Auditing SQL Migrations for Security Hardening & Tenant Leakage...');
let migrationsAudited = 0;

if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  
  const tenantCol = config.database?.tenantIdColumn || 'tenant_id';
  const tenantFnRaw = config.database?.tenantResolverFunction || 'public.get_user_tenant_id()';
  const tenantFnEscaped = tenantFnRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  files.forEach(file => {
    migrationsAudited++;
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if new tables are created without enabling RLS
    const tableMatches = [...content.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)/gi)];
    tableMatches.forEach(match => {
      const tableName = match[1];
      const rlsEnabled = new RegExp(`alter\\s+table\\s+${tableName}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(content) ||
                         new RegExp(`alter\\s+table\\s+public\\.${tableName.split('.').pop()}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(content);
      if (!rlsEnabled && !tableName.includes('schema_migrations')) {
        console.warn(`   ⚠️  [RLS Vulnerability] Table "${tableName}" created in ${file} without an explicit ENABLE ROW LEVEL SECURITY statement.`);
        issuesFound++;
      }
    });

    // Check if dynamic functions use SECURITY DEFINER without revoking execution from public
    if (content.toLowerCase().includes('security definer')) {
      const hasRevoke = content.toLowerCase().includes('revoke execute on function') || 
                        content.toLowerCase().includes('revoke all on function');
      if (!hasRevoke) {
        console.warn(`   ⚠️  [Privilege Leak] "SECURITY DEFINER" function in ${file} does not revoke execute access from public.`);
        issuesFound++;
      }
    }

    // Verify policies filter strictly by tenant configuration
    const policyMatches = content.match(/create\s+policy\s+["']?\w+["']?\s+on\s+\w+\.?\w*/gi) || [];
    policyMatches.forEach(policyMatch => {
      const hasTenantFilter = new RegExp(`${tenantCol}\\s*=\\s*${tenantFnEscaped}`, 'i').test(content) || 
                              new RegExp(`${tenantFnEscaped}\\s*=\\s*${tenantCol}`, 'i').test(content);
      if (!hasTenantFilter && !content.toLowerCase().includes('using (true)') && !content.toLowerCase().includes('using (false)')) {
        console.warn(`   ⚠️  [RLS Multi-Tenancy Alert] RLS policy in ${file} might not partition data strictly by "${tenantCol}" using "${tenantFnRaw}".`);
        issuesFound++;
      }
    });
  });
  console.log(`   Checked ${migrationsAudited} migration file(s).`);
} else {
  console.log('   ℹ️  No migrations directory found. Skipping SQL audits.');
}

// 3. Scan for Hardcoded Secrets
console.log('\n📂 3. Scanning Code for Committed API Credentials or Secrets...');
let secretIssues = 0;

function scanForSecrets(dir) {
  if (!fs.existsSync(dir)) return;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        scanForSecrets(fullPath);
      }
    } else if (/\.(ts|js|tsx|jsx|json|yml|yaml|md)$/.test(file)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (fullPath.includes('system_health_check.js') || fullPath.includes('diagnose_telemetry.js') || fullPath.includes('security_taint_check.js')) return;
        
        const hasSecretPattern = /[\s="'](sk_live_[a-zA-Z0-9]{24}|AIzaSy[a-zA-Z0-9-_]{35}|eyJhbGciOi[a-zA-Z0-9-_=.]{40,})/gi.test(line);
        if (hasSecretPattern) {
          console.warn(`   ⚠️  [Credential Leak] Potential hardcoded API secret or JWT committed in ${path.relative(__dirname, fullPath)} (line ${index + 1}).`);
          secretIssues++;
          issuesFound++;
        }
      });
    }
  });
}
scanForSecrets(srcDir);
if (secretIssues === 0) {
  console.log('   ✅ No hardcoded API keys or secrets detected in code assets.');
}

console.log('\n──────────────────────────────────────────────────────────────────');
if (issuesFound === 0) {
  console.log('🎉 SECURITY SCAN COMPLETE: 100% HEALTHY. ZERO LEAKS OR SINK INJECTIONS DETECTED.');
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(0);
} else {
  console.warn(`🛑 SECURITY AUDIT ALERT: ${issuesFound} vulnerabilities or style risks require remediation.`);
  console.log('──────────────────────────────────────────────────────────────────');
  process.exit(1);
}
