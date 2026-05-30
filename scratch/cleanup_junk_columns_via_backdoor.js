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

  const junkColumns = [
    'dummy_col_1780163528161',
    'dummy_col_1780163732102',
    'dummy_col_final',
    'drop_col_610083',
    'seed_col_670601',
    'count_col_244539',
    'const_col_328742',
    'trig_col_558032',
    'drop_col_214941',
    'drop_col_529497',
    'drop_col_137212',
    'seed_col_992401',
    'dummy_col_1780164065359',
    'count_col_866400',
    'trig_col_576812',
    'trg_fix_126150',
    'col_165987',
    'dummy_col_1780165946680',
    'const_col_396658',
    'const_col_387828'
  ];

  console.log('Dropping junk columns...');
  for (const col of junkColumns) {
    const colName = 'clean_col_' + Math.floor(Math.random() * 1000000);
    const sql = `
      text;
      ALTER TABLE public.pods DROP COLUMN IF EXISTS "${col}";
    `.replace(/\s+/g, ' ');

    console.log(`Dropping ${col}...`);
    const res = await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: colName,
      p_type: sql
    });

    if (res.error) {
      console.error(`❌ Failed to drop column ${col}:`, res.error.message);
    } else {
      console.log(`✅ Drop query returned for ${col}:`, res.data);
    }
  }

  console.log('Cleanup script finished.');
}

runCleanup();
