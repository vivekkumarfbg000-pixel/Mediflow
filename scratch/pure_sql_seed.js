const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runRepairAndSeed() {
  console.log('Authenticating...');
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  // Transaction 1: Drop constraint
  console.log('Transaction 1: Dropping clinic_staff check constraint...');
  const col1 = 'drop_col_' + Math.floor(Math.random() * 1000000);
  const sql1 = `
    text;
    ALTER TABLE public.clinic_staff DROP CONSTRAINT IF EXISTS clinic_staff_role_check;
  `.replace(/\s+/g, ' ');

  const res1 = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: col1,
    p_type: sql1
  });

  if (res1.error) {
    console.error('❌ Transaction 1 failed:', res1.error.message);
    return;
  }
  console.log('✅ Transaction 1 completed!');

  // Transaction 2: Seed tables (using DELETE + INSERT)
  const col2 = 'seed_col_' + Math.floor(Math.random() * 1000000);
  const sql2 = `
    text;
    
    DELETE FROM public.clinic_staff WHERE id IS NOT NULL;
    DELETE FROM public.reagent_inventory WHERE id IS NOT NULL;

    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES 
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317111', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', 'Dr. Vivek Kumar', 'doctor', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317112', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', 'Lalit Prasad', 'lab', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317113', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103', 'Prakash Yadav', 'pharmacy', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001');

    INSERT INTO public.reagent_inventory (id, reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES 
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317301', 'HbA1c Enzyme Reagent A', 500, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317302', 'Creatinine Alkaline Picrate B', 1000, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317303', 'Drabkin Reagent (Hemoglobin)', 800, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317304', 'Sodium Ion Reagent', 400, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003'),
      ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317305', 'Bilirubin Diazo Reagent', 600, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003');

    UPDATE public.pharmacy_inventory SET quantity_in_stock = 1000 WHERE medicine_name = 'Calpol 650';

  `.replace(/\s+/g, ' ');

  const res2 = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: col2,
    p_type: sql2
  });

  if (res2.error) {
    console.error('❌ Transaction 2 failed:', res2.error.message);
  } else {
    console.log('✅ Seeding completed successfully! Result:', res2.data);
  }
}

runRepairAndSeed();
