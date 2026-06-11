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

  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260611000004_fix_reconcile_update_metadata.sql'), 'utf8');
  
  // Split by semicolon - but be careful with dollar-quoted strings
  // Use a simple approach: split on semicolon followed by newline and not inside $$
  const statements = sql.split(/;\s*(?=(?:[^$]*\$[^$]*\$)*[^$]*$)/).filter(s => s.trim());
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('execute_autonomous_db_repair', {
        p_table: 'pods',
        p_column: 'reconcile_fix_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        p_type: 'text;\n' + trimmed + ';'
      });
      
      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log('✓ Statement executed');
      }
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
  
  console.log('\nDone!');
  
  // Now test reconcile_profile_role as owner
  console.log('\n--- Testing as owner@mediflow.com ---');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'owner@mediflow.com',
    password: 'password123'
  });
  
  if (signInError) {
    console.error('Sign in error:', signInError);
  } else {
    console.log('Signed in as owner');
    
    // Call reconcile_profile_role
    const { data: rpcData, error: rpcError } = await supabase.rpc('reconcile_profile_role');
    if (rpcError) {
      console.error('RPC error:', rpcError);
    } else {
      console.log('reconcile_profile_role result:', rpcData);
    }
    
    // Check metadata again
    const sqlPayload = `
      text;
      INSERT INTO public.activity_logs (action_type, details)
      VALUES (
        'OWNER_METADATA_AFTER',
        (
          SELECT jsonb_build_object(
            'id', id,
            'email', email,
            'user_metadata', raw_user_meta_data
          )
          FROM auth.users
          WHERE email = 'owner@mediflow.com'
        )
      );
    `.replace(/\s+/g, ' ');
  
    await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'owner_meta_after_' + Date.now(),
      p_type: sqlPayload
    });
  
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('action_type', 'OWNER_METADATA_AFTER')
      .order('created_at', { ascending: false })
      .limit(1);
  
    if (error) {
      console.error('Error:', error);
    } else if (data && data.length > 0) {
      console.log('Owner metadata after reconcile:', JSON.stringify(data[0].details, null, 2));
    }
  }
}

run().catch(console.error);