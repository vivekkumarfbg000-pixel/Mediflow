const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  console.log('Authenticating...');
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const uniqueCol = 'test_col_' + Math.floor(Math.random() * 1000000);
  const sql = `
    text;
    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id)
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317111', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', 'Dr. Vivek Kumar', 'doctor', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001')
    ON CONFLICT (id) DO UPDATE SET staff_name = EXCLUDED.staff_name;
  `.replace(/\s+/g, ' ');

  console.log(`Running injection with column: ${uniqueCol}`);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: uniqueCol,
    p_type: sql
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    console.log('RPC Result:', data);
    
    // Query table immediately
    console.log('Querying clinic_staff...');
    const { data: staffData, error: staffError } = await supabase.from('clinic_staff').select('*');
    if (staffError) {
      console.error('Query Error:', staffError);
    } else {
      console.log('clinic_staff rows:', staffData);
    }
  }
}

runTest();
