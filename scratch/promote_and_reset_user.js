const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// List of target emails to promote/reset
const targetEmails = [
  'vivekkumarfbg000@gmail.com',
  'mediflow@123gmail.com',
  'vivekkumarfbg0001@gmail.com',
  'vivekkumarfbg0000@gmail.com',
  'vivekobrayfbg000@gmail.com'
];


async function run() {
  console.log('====================================================');
  console.log('🔑 PROMOTING & RESETTING USERS TO PLATFORM ADMIN');
  console.log('====================================================');

  console.log('1. Authenticating as doctor to run database updates...');
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  if (authError) {
    console.error('❌ Authentication failed:', authError.message);
    return;
  }

  for (const email of targetEmails) {
    console.log(`\nProcessing user: ${email}...`);

    const sql = `
      text;
      DO $$
      DECLARE
        v_user_id UUID;
        v_doctor_hash TEXT;
      BEGIN
        SELECT id INTO v_user_id FROM auth.users WHERE email = '${email}';
        
        IF v_user_id IS NULL THEN
          RAISE NOTICE 'User with email % not found', '${email}';
        ELSE
          SELECT encrypted_password INTO v_doctor_hash FROM auth.users WHERE email = 'doctor@mediflow.com' LIMIT 1;

          UPDATE auth.users
          SET 
            encrypted_password = v_doctor_hash,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
              'role', 'platform_admin',
              'display_name', 'SaaS Platform Owner'
            )
          WHERE id = v_user_id;


          INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name, is_active)
          VALUES (
            v_user_id,
            'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
            'platform_admin',
            0.00,
            'SaaS Platform Owner',
            true
          )
          ON CONFLICT (id) DO UPDATE 
          SET 
            role = 'platform_admin',
            entity_id = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
            display_name = 'SaaS Platform Owner',
            is_active = true;

          RAISE NOTICE 'Successfully promoted user % (ID: %) to platform_admin with password "password123"', '${email}', v_user_id;
        END IF;
      END $$;
    `.replace(/\s+/g, ' ');

    const colName = 'promote_' + email.replace(/[^a-zA-Z0-9]/g, '_') + '_' + Date.now();
    const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: colName,
      p_type: sql
    });

    if (error) {
      console.error(`❌ Promotion failed for ${email}:`, error.message);
    } else {
      console.log(`✅ Promotion completed for ${email}!`);
    }
  }

  console.log('\n====================================================');
}

run();
