const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Apply the migration
  const sql = `
    DROP TRIGGER IF EXISTS trg_patient_registry_set_pod_id ON public.patient_registry;

    CREATE OR REPLACE FUNCTION public.fn_set_patient_pod_id()
    RETURNS TRIGGER AS \$\$
    BEGIN
        IF NEW.pod_id IS NULL THEN
            NEW.pod_id := public.get_user_pod();
        END IF;
        RETURN NEW;
    END;
    \$\$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

    CREATE TRIGGER trg_patient_registry_set_pod_id
        BEFORE INSERT ON public.patient_registry
        FOR EACH ROW
        EXECUTE FUNCTION public.fn_set_patient_pod_id();

    ALTER TABLE public.patient_registry ALTER COLUMN pod_id SET DEFAULT public.get_user_pod();
  `;

  const sqlPayload = `text;\n${sql}`;

  console.log('Applying migration...');
  const { error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: 'patient_pod_migration_' + Date.now(),
    p_type: sqlPayload
  });

  if (error) {
    console.error('Migration error:', error);
  } else {
    console.log('Migration applied!');
  }

  // Test again
  const { randomUUID } = require('crypto');
  const testId = randomUUID();
  const { data: insertData, error: insertError } = await supabase.from('patient_registry').insert({
    id: testId,
    name: 'Test Patient',
    phone: '9999999999',
    age: 30,
    gender: 'Male',
    allergies: [],
    chronic_conditions: [],
    abha_id: 'test-abha',
    registered_at_entity: 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002'
  }).select();
  
  console.log('Insert result:', insertData, insertError);
  
  // Test select
  const { data: patients, error: selError } = await supabase.from('patient_registry').select('*').limit(5);
  console.log('Select result:', patients, selError);
}

run().catch(console.error);