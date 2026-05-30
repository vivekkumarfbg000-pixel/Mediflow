const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listTables() {
  console.log('Querying existing database tables from system schema...');
  // We can call an RPC or run a select query on pg_catalog via raw SQL,
  // or simply query a few expected tables and see if they exist.
  // Wait, let's query the supabase API or run a simple RPC to check schema.
  // Alternatively, let's execute a raw query if we have an RPC like 'execute_sql' or similar,
  // or check if we can query some known tables.
  const tables = [
    'pods', 'entities', 'profiles', 'clinic_staff', 'patient_registry', 
    'encounters', 'lab_requisitions', 'lab_reports', 'reagent_inventory', 
    'inventory_holds', 'unified_invoices', 'financial_ledgers', 'whatsapp_sessions',
    'master_test_catalog', 'pharmacy_inventory'
  ];

  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST204' || error.code === '42P01') {
        console.log(`❌ Table '${t}' DOES NOT exist (Error: ${error.message})`);
      } else {
        console.log(`⚠️ Table '${t}' exists but returned error: ${error.message} (Code: ${error.code})`);
      }
    } else {
      console.log(`✅ Table '${t}' EXISTS!`);
    }
  }
}

listTables();
