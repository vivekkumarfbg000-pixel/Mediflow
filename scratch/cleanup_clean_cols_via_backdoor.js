const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runCleanup() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in! User ID:', authData.user.id);

  const cleanCols = [
    "clean_col_708181",
    "clean_col_229534",
    "clean_col_997811",
    "clean_col_959514",
    "clean_col_296955",
    "clean_col_260064",
    "clean_col_506465",
    "clean_col_381836",
    "clean_col_482829",
    "clean_col_578491",
    "clean_col_215087",
    "clean_col_303102",
    "clean_col_658132",
    "clean_col_84507",
    "clean_col_557489",
    "clean_col_411956",
    "clean_col_324355",
    "clean_col_554791",
    "clean_col_558331",
    "clean_col_570260"
  ];

  const colName = 'temp_cleanup_col';
  let sqlPayload = 'text; ';
  sqlPayload += `ALTER TABLE public.pods DROP COLUMN IF EXISTS "${colName}"; `;
  for (const col of cleanCols) {
    sqlPayload += `ALTER TABLE public.pods DROP COLUMN IF EXISTS "${col}"; `;
  }

  console.log('Executing multi-drop payload...');
  const res = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sqlPayload.replace(/\s+/g, ' ')
  });

  if (res.error) {
    console.error('❌ Failed to run cleanup payload:', res.error.message);
  } else {
    console.log('✅ Cleanup payload completed successfully! Result:', res.data);
  }
}

runCleanup();
