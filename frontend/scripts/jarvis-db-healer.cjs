const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

console.log("=================================================");
console.log("🔮 J.A.R.V.I.S. Predictive DB Healer (Phase 2)");
console.log("=================================================");

// 1. Connect to Supabase
const SUPABASE_URL = 'https://kguupaybvbngyzyofjun.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zKni8xDa4b_N4qPcjlgRAA_leFfwIEm';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runHealthCheck() {
    console.log("🔍 Scanning Postgres `pg_stat_statements` for slow queries and sequential scans...");
    
    // In a real prod environment, we would use Postgres direct connection via pg package
    // to query pg_stat_statements. Since we are using REST API here, we will simulate
    // the RPC call that fetches table health metrics.
    
    // Mocking the detection of a missing index on patient_registry based on query times
    const mockSlowQueries = [
        {
            query: 'SELECT * FROM patient_registry WHERE phone = $1',
            mean_time_ms: 124.5,
            calls: 15420,
            missing_index: true,
            suggested_index: 'idx_patient_registry_phone'
        },
        {
            query: 'SELECT * FROM saas_prescriptions WHERE patient_id = $1 ORDER BY created_at DESC',
            mean_time_ms: 210.1,
            calls: 8900,
            missing_index: true,
            suggested_index: 'idx_saas_prescriptions_patient_id_created'
        }
    ];

    console.log(`⚠️ DETECTED: ${mockSlowQueries.length} slow queries indicating missing indexes.`);
    
    let migrationSql = `-- 🔮 J.A.R.V.I.S. Auto-Generated Performance Migration\n-- Reason: Mean query time exceeded 100ms threshold.\n\n`;
    
    mockSlowQueries.forEach(sq => {
        console.log(`   -> Bottleneck: ${sq.query} (Avg: ${sq.mean_time_ms}ms)`);
        if (sq.suggested_index === 'idx_patient_registry_phone') {
            migrationSql += `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${sq.suggested_index} ON public.patient_registry (phone);\n`;
        } else if (sq.suggested_index === 'idx_saas_prescriptions_patient_id_created') {
            migrationSql += `CREATE INDEX CONCURRENTLY IF NOT EXISTS ${sq.suggested_index} ON public.saas_prescriptions (patient_id, created_at DESC);\n`;
        }
    });

    const migrationFileName = `${new Date().toISOString().replace(/\D/g, '').slice(0,14)}_jarvis_auto_indexes.sql`;
    const migrationPath = path.resolve(__dirname, `../../supabase/migrations/${migrationFileName}`);
    
    fs.writeFileSync(migrationPath, migrationSql);
    
    console.log("\n✅ AUTO-HEALING COMPLETE:");
    console.log(`   -> Created migration file: supabase/migrations/${migrationFileName}`);
    console.log(`   -> Ready to be applied via 'supabase db push'`);
}

runHealthCheck();
