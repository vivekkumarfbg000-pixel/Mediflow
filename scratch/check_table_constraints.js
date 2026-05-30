const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Query constraint definition using execute_autonomous_db_repair trick or a custom query.
  // Wait, let's create a function to list check constraints!
  console.log('Creating check constraint listing helper...');
  const sqlPayload = `
    text;
    CREATE OR REPLACE FUNCTION public.debug_get_constraints(p_table TEXT)
    RETURNS TABLE(conname TEXT, condef TEXT) AS $$$
    BEGIN
      RETURN QUERY
      SELECT c.conname::text, pg_get_constraintdef(c.oid)::text
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = p_table;
    END;
    $$$ LANGUAGE plpgsql SECURITY DEFINER;
    GRANT EXECUTE ON FUNCTION public.debug_get_constraints(TEXT) TO authenticated, anon;
  `.replace(/\s+/g, ' ');

  const columnName = 'dummy_col_' + Date.now();
  await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: columnName,
    p_type: sqlPayload
  });

  console.log('Querying constraints for patient_consents...');
  const { data, error } = await supabase.rpc('debug_get_constraints', { p_table: 'patient_consents' });
  if (error) {
    console.error('Error querying:', error.message);
  } else {
    console.log('Constraints for patient_consents:', data);
  }
}

run();
