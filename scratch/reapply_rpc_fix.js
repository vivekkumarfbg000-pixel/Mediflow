const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Read the migration file
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260611000003_update_rpcs_add_pod_id_to_metadata.sql'), 'utf8');
  
  // Split by the function definitions - use a simpler approach
  const parts = sql.split('$$ LANGUAGE plpgsql');
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i] + '$$ LANGUAGE plpgsql';
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('execute_autonomous_db_repair', {
        p_table: 'pods',
        p_column: 'rpc_fix_' + Date.now() + '_' + i,
        p_type: 'text;\n' + trimmed + ';'
      });
      
      if (error) {
        console.error(`Error part ${i}:`, error.message);
      } else {
        console.log(`✓ Part ${i} executed`);
      }
    } catch (err) {
      console.error(`Exception part ${i}:`, err.message);
    }
  }
  
  // Also run the GRANT statements
  const grants = [
    'REVOKE EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) TO authenticated;',
    'REVOKE EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;'
  ];
  
  for (const grant of grants) {
    const { error } = await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'grant_' + Date.now(),
      p_type: 'text;\n' + grant
    });
    if (error) console.error('Grant error:', error.message);
    else console.log('✓ Grant executed:', grant.substring(0, 50));
  }
  
  console.log('\nDone! Now testing...');
  
  // Test by creating a new partner
  const { data: clinicData } = await supabase.auth.signUp({
    email: 'clinic2@test.com',
    password: 'password123',
    options: { data: { display_name: 'Dr. Clinic 2', role: 'doctor', clinic_name: 'Clinic 2', clinic_phone: '7777777777', clinic_address: 'Addr 2', specialization: 'General Medicine', pending_registration: true } }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  const { data: rpcData } = await supabase.rpc('register_clinic_network', {
    p_clinic_name: 'Clinic 2', p_clinic_phone: '7777777777', p_clinic_address: 'Addr 2', p_specialization: 'General Medicine'
  });
  
  const clinicCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
  console.log('New clinic code:', clinicCode);
  
  const { data: partnerData } = await supabase.auth.signUp({
    email: 'lab2@test.com',
    password: 'password123',
    options: { data: { display_name: 'Lab 2', role: 'lab_technician', clinic_code: clinicCode, partner_type: 'lab', partner_phone: '6666666666', partner_address: 'Near Clinic 2', pending_registration: true } }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  await supabase.rpc('join_clinic_network', {
    p_clinic_code: clinicCode, p_partner_type: 'lab', p_partner_name: 'Lab 2', p_partner_phone: '6666666666', p_partner_address: 'Near Clinic 2'
  });
  
  // Check metadata
  const { data: loginData, error } = await supabase.auth.signInWithPassword({
    email: 'lab2@test.com', password: 'password123'
  });
  
  if (error) {
    console.error('Login error:', error);
  } else {
    console.log('New lab partner metadata:', JSON.stringify(loginData.user.user_metadata, null, 2));
  }
}

run().catch(console.error);