const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkFunction() {
  console.log('Authenticating...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in. Querying pg_proc...');

  // Use execute_autonomous_db_repair to run an arbitrary select query and return it
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'dummy_col_check_func',
    p_type: `
      DO $$
      DECLARE
        v_lang TEXT;
        v_src TEXT;
      BEGIN
        SELECT l.lanname, p.prosrc INTO v_lang, v_src
        FROM pg_proc p
        JOIN pg_language l ON p.prolang = l.oid
        WHERE p.proname = 'get_user_pod';
        
        RAISE NOTICE 'Function language: %, src: %', v_lang, v_src;
      END $$;
    `
  });

  if (error) {
    console.error('Error running RPC:', error.message);
  } else {
    console.log('RPC succeeded, check logs or notices:', data);
  }
}

checkFunction();
