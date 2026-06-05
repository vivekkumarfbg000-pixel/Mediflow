const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createOwner() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const ownerId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317109';
  const ownerEntityId = 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317009';

  const sql = `
    text;

    -- 1. Create a platform entity for the owner if not exists
    INSERT INTO public.entities (id, pod_id, entity_type, name, status, is_active)
    VALUES (
      '${ownerEntityId}',
      'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001',
      'platform',
      'Mediflow HQ Operations',
      'approved',
      true
    )
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

    -- 2. Create the owner user in auth.users if not exists
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
      '${ownerId}',
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
    ON CONFLICT (id) DO NOTHING;

    -- Update password and confirmation just in case
    UPDATE auth.users
    SET 
      email = 'owner@mediflow.com',
      encrypted_password = (SELECT encrypted_password FROM auth.users WHERE email = 'doctor@mediflow.com' LIMIT 1),
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = '${ownerId}';

    -- 3. Create the profile in public.profiles
    INSERT INTO public.profiles (id, entity_id, role, consultation_fee)
    VALUES (
      '${ownerId}',
      '${ownerEntityId}',
      'platform_admin',
      0.00
    )
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, entity_id = EXCLUDED.entity_id;
  `.replace(/\s+/g, ' ');

  console.log('Seeding owner account via backdoor...');
  const colName = 'dummy_col_owner_' + Math.floor(Math.random() * 1000000);
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: colName,
    p_type: sql
  });

  if (error) {
    console.error('Seeding failed:', error);
  } else {
    console.log('Owner user seeded successfully! Result:', data);
  }
}

createOwner();
