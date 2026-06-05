const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('1. Reading WABA SQL migration file...');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260605000004_fix_waba_connections_rls.sql');
  const rawSql = fs.readFileSync(migrationPath, 'utf8');

  // Format the SQL to be executed inside the text payload
  const formattedSql = `text;\n${rawSql}`;

  console.log('2. Authenticating as doctor...');
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  console.log('3. Applying WABA RLS migration via execute_autonomous_db_repair...');
  const runId = 'waba_rls_' + Date.now();
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: runId,
    p_type: formattedSql
  });

  if (error) {
    console.error('❌ Migration application failed:', error.message);
  } else {
    console.log('✅ Migration applied successfully! Return value:', data);
  }
}

run();
