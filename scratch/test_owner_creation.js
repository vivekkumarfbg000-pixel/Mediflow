const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testOwner() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sql = `
    text;
    DO $$
    DECLARE
      v_err TEXT;
      v_state TEXT;
    BEGIN
      DELETE FROM public.system_health_telemetry WHERE error_code = 'OWNER_DEBUG';

      BEGIN
        INSERT INTO public.pods (id, name, clinic_code, is_active)
        VALUES (
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
          'Mediflow HQ Operations Pod',
          'MF-HQ99',
          true
        )
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, clinic_code = EXCLUDED.clinic_code;

        INSERT INTO public.entities (id, pod_id, entity_type, name, status, is_active)
        VALUES (
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
          'clinic',
          'Mediflow HQ Operations',
          'approved',
          true
        )
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

        INSERT INTO auth.users (
          id,
          instance_id,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          is_super_admin,
          role,
          aud,
          created_at,
          updated_at
        )
        SELECT
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
          instance_id,
          'owner@mediflow.com',
          encrypted_password,
          NOW(),
          '{"provider": "email", "providers": ["email"]}'::jsonb,
          '{"role": "platform_admin", "display_name": "SaaS Platform Owner"}'::jsonb,
          false,
          'authenticated',
          'authenticated',
          NOW(),
          NOW()
        FROM auth.users
        WHERE email = 'doctor@mediflow.com'
        LIMIT 1
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
        VALUES (
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109',
          'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009',
          'platform_admin',
          0.00,
          'SaaS Platform Owner'
        )
        ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, entity_id = EXCLUDED.entity_id, display_name = EXCLUDED.display_name;

        INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
        VALUES ('database', 'warning', 'OWNER_DEBUG', 'SUCCESS');
      EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT, v_state = RETURNED_SQLSTATE;
        INSERT INTO public.system_health_telemetry (subsystem, severity, error_code, error_stack)
        VALUES ('database', 'warning', 'OWNER_DEBUG', 'SQLState: ' || v_state || ' | Error: ' || v_err);
      END;
    END $$;
  `.replace(/\\s+/g, ' ');

  console.log('Running debug owner creation...');
  const colName = 'dummy_col_owner_dbg_' + Math.floor(Math.random() * 1000000);
  const { data: repairDone, error: repairError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (repairError) {
    console.error('RPC failed:', repairError);
  } else {
    console.log('RPC finished. Fetching debug logs...');
    const { data, error } = await supabase
      .from('system_health_telemetry')
      .select('*')
      .eq('error_code', 'OWNER_DEBUG');
    
    if (error) {
      console.error('Fetch failed:', error);
    } else {
      console.log('Debug Results:');
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

testOwner();
