const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Update join_clinic_network to include pod_id
  const joinRpc = `
    CREATE OR REPLACE FUNCTION public.join_clinic_network(
      p_clinic_code TEXT,
      p_partner_type TEXT,
      p_partner_name TEXT,
      p_partner_phone TEXT,
      p_partner_address TEXT
    )
    RETURNS TABLE (entity_id UUID)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_pod_id UUID;
      v_entity_id UUID;
      v_role TEXT;
      v_display_name TEXT;
    BEGIN
      SELECT id INTO v_pod_id
      FROM public.pods
      WHERE clinic_code = upper(trim(p_clinic_code)) AND is_active = TRUE
      LIMIT 1;

      IF v_pod_id IS NULL THEN
        RAISE EXCEPTION 'Clinic network code not found or inactive.';
      END IF;

      v_role := CASE
        WHEN p_partner_type = 'pharmacy' THEN 'pharmacist'
        WHEN p_partner_type = 'lab' THEN 'lab_technician'
        ELSE 'compounder'
      END;

      INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
      VALUES (v_pod_id, p_partner_type, p_partner_name, p_partner_address, p_partner_phone, 'pending', TRUE)
      RETURNING id INTO v_entity_id;

      SELECT COALESCE(raw_user_meta_data->>'display_name', p_partner_name)
      INTO v_display_name
      FROM auth.users
      WHERE id = auth.uid();

      INSERT INTO public.profiles (id, entity_id, role, display_name)
      VALUES (auth.uid(), v_entity_id, v_role, COALESCE(v_display_name, p_partner_name))
      ON CONFLICT (id) DO UPDATE
      SET entity_id = EXCLUDED.entity_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_code', p_clinic_code,
        'partner_type', p_partner_type,
        'role', v_role,
        'pod_id', v_pod_id
      )
      WHERE id = auth.uid();

      RETURN QUERY SELECT v_entity_id;
    END;
    $$;
  `;

  console.log('Updating join_clinic_network...');
  const { error: joinError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'join_rpc_' + Date.now(),
    p_type: 'text;\n' + joinRpc
  });

  if (joinError) {
    console.error('Join RPC error:', joinError);
  } else {
    console.log('✓ join_clinic_network updated');
  }

  // Update register_clinic_network to include pod_id
  const registerRpc = `
    CREATE OR REPLACE FUNCTION public.register_clinic_network(
      p_clinic_name TEXT,
      p_clinic_phone TEXT,
      p_clinic_address TEXT,
      p_specialization TEXT
    )
    RETURNS TABLE (clinic_code TEXT)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    DECLARE
      v_pod_id UUID;
      v_entity_id UUID;
      v_clinic_code TEXT;
      v_display_name TEXT;
    BEGIN
      v_clinic_code := 'MF-' || upper(substring(gen_random_uuid()::text, 1, 4));

      WHILE EXISTS (SELECT 1 FROM public.pods WHERE pods.clinic_code = v_clinic_code) LOOP
        v_clinic_code := 'MF-' || upper(substring(gen_random_uuid()::text, 1, 4));
      END LOOP;

      INSERT INTO public.pods (name, clinic_code, is_active)
      VALUES (p_clinic_name, v_clinic_code, TRUE)
      RETURNING id INTO v_pod_id;

      INSERT INTO public.entities (pod_id, entity_type, name, address, phone, status, is_active)
      VALUES (v_pod_id, 'clinic', p_clinic_name, p_clinic_address, p_clinic_phone, 'approved', TRUE)
      RETURNING id INTO v_entity_id;

      SELECT COALESCE(raw_user_meta_data->>'display_name', p_clinic_name)
      INTO v_display_name
      FROM auth.users
      WHERE id = auth.uid();

      INSERT INTO public.profiles (id, entity_id, role, consultation_fee, display_name)
      VALUES (auth.uid(), v_entity_id, 'doctor', 400.00, COALESCE(v_display_name, 'Doctor'))
      ON CONFLICT (id) DO UPDATE
      SET entity_id = EXCLUDED.entity_id, role = EXCLUDED.role, display_name = EXCLUDED.display_name;

      UPDATE auth.users
      SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
        'clinic_name', p_clinic_name,
        'specialization', p_specialization,
        'role', 'doctor',
        'pod_id', v_pod_id
      )
      WHERE id = auth.uid();

      RETURN QUERY SELECT v_clinic_code;
    END;
    $$;
  `;

  console.log('Updating register_clinic_network...');
  const { error: regError } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'reg_rpc_' + Date.now(),
    p_type: 'text;\n' + registerRpc
  });

  if (regError) {
    console.error('Register RPC error:', regError);
  } else {
    console.log('✓ register_clinic_network updated');
  }

  // Grants
  const grants = [
    'REVOKE EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.register_clinic_network(TEXT, TEXT, TEXT, TEXT) TO authenticated;',
    'REVOKE EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;',
    'GRANT EXECUTE ON FUNCTION public.join_clinic_network(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;'
  ];

  for (const grant of grants) {
    await supabase.rpc('execute_autonomous_db_repair', {
      p_table: 'pods',
      p_column: 'grant_' + Date.now(),
      p_type: 'text;\n' + grant
    });
  }

  console.log('\nGrants applied. Testing...');

  // Test new partner signup
  const { data: clinicData } = await supabase.auth.signUp({
    email: 'clinic3@test.com',
    password: 'password123',
    options: { data: { display_name: 'Dr. Clinic 3', role: 'doctor', clinic_name: 'Clinic 3', clinic_phone: '5555555555', clinic_address: 'Addr 3', specialization: 'General Medicine', pending_registration: true } }
  });

  await new Promise(r => setTimeout(r, 1000));

  const { data: rpcData } = await supabase.rpc('register_clinic_network', {
    p_clinic_name: 'Clinic 3', p_clinic_phone: '5555555555', p_clinic_address: 'Addr 3', p_specialization: 'General Medicine'
  });

  const clinicCode = Array.isArray(rpcData) ? rpcData[0]?.clinic_code : rpcData?.clinic_code;
  console.log('New clinic code:', clinicCode);

  const { data: partnerData } = await supabase.auth.signUp({
    email: 'pharmacy3@test.com',
    password: 'password123',
    options: { data: { display_name: 'Pharmacy 3', role: 'pharmacist', clinic_code: clinicCode, partner_type: 'pharmacy', partner_phone: '4444444444', partner_address: 'Near Clinic 3', pending_registration: true } }
  });

  await new Promise(r => setTimeout(r, 1000));

  await supabase.rpc('join_clinic_network', {
    p_clinic_code: clinicCode, p_partner_type: 'pharmacy', p_partner_name: 'Pharmacy 3', p_partner_phone: '4444444444', p_partner_address: 'Near Clinic 3'
  });

  // Check metadata
  const { data: loginData, error } = await supabase.auth.signInWithPassword({
    email: 'pharmacy3@test.com', password: 'password123'
  });

  if (error) {
    console.error('Login error:', error);
  } else {
    console.log('New pharmacy partner metadata:', JSON.stringify(loginData.user.user_metadata, null, 2));
  }
}

run().catch(console.error);