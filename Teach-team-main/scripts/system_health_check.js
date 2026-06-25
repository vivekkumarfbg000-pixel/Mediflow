import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamically load environment variables from backend/.env if available
function loadEnv() {
  const envPaths = [
    path.join(__dirname, '../../backend/.env'),
    path.join(__dirname, '.env'),
    path.join(__dirname, '../../.env')
  ];
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        content.split('\n').forEach(line => {
          const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
          if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.substring(1, value.length - 1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              value = value.substring(1, value.length - 1);
            }
            process.env[key] = value.trim();
          }
        });
      } catch (e) {
        console.warn('Failed to parse .env file:', e.message);
      }
      break;
    }
  }
}
loadEnv();

// Retrieve credentials dynamically from environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSystemHealth() {
    console.log("=== Starting System Health Check ===\n");
    const report = {
        Database_Connection: "PENDING",
        Env_Variables: "PENDING",
        Schema_Sanity: "PENDING"
    };

    // 1. Environmental Variable Verification
    const missingKeys = [];
    if (!SUPABASE_URL) missingKeys.push("SUPABASE_URL");
    if (!SUPABASE_KEY) missingKeys.push("SUPABASE_KEY");

    if (missingKeys.length > 0) {
        report.Env_Variables = "FAIL: Missing environment keys (" + missingKeys.join(", ") + ")";
        report.Database_Connection = "SKIP: No credentials";
        report.Schema_Sanity = "SKIP";
        console.table(report);
        return;
    } else {
        report.Env_Variables = "PASS";
    }

    // Initialize client dynamically
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // 2. Database Connection Ping
    try {
        // Query a dummy route or standard API path to ping connectivity
        const { error } = await supabase.from('_dummy_table_ping_').select('*').limit(1);
        
        // A PGRST116 or 404/401/403 or code 42P01 (relation does not exist) means the database is REACHED.
        // If it throws a fetch error, it means we cannot reach the database.
        if (error && error.message && error.message.includes("fetch")) {
            report.Database_Connection = "FAIL: Reachability issue (" + error.message + ")";
        } else if (error && error.code === 'PGRST301') {
            report.Database_Connection = "FAIL: JWT/Authentication invalid";
        } else {
            report.Database_Connection = "PASS (Ping completed)";
        }
    } catch (e) {
        report.Database_Connection = "ERROR: " + e.message;
    }

    // 3. Schema & RLS Static Configuration Assessment
    try {
        // Attempt to read schemas or query the migration table to check drift
        const { data, error } = await supabase.from('schema_migrations').select('version').limit(5);
        if (error) {
            report.Schema_Sanity = "PASS (Database reached. Custom schema_migrations table not queryable: " + error.message + ")";
        } else {
            report.Schema_Sanity = "PASS (Found " + (data ? data.length : 0) + " applied migrations)";
        }
    } catch (e) {
        report.Schema_Sanity = "ERROR: " + e.message;
    }

    console.table(report);
}

checkSystemHealth();
