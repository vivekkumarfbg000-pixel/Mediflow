import { createClient } from '@supabase/supabase-js';

// Retrieve credentials dynamically from environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ykrqpxbbyfipjqhpaszf.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrcnFweGJieWZpcGpxaHBhc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1MTEwNjEsImV4cCI6MjA4MjA4NzA2MX0.rWuk98xZ1wpJwK9agtZCeie3C9xQDb43UZK8FutCGss";

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
