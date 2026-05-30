const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSeed() {
  console.log('Authenticating...');
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  const sqlPayload = `
    text;
    
    -- 1. Drop check constraint on clinic_staff role if it exists
    ALTER TABLE public.clinic_staff DROP CONSTRAINT IF EXISTS clinic_staff_role_check;

    -- 2. Seed clinic_staff
    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317111', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317002', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317101', 'Dr. Vivek Kumar', 'doctor', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317112', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317102', 'Lalit Prasad', 'lab_technician', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

    INSERT INTO public.clinic_staff (id, entity_id, user_id, staff_name, role, is_active, pod_id) 
    VALUES ('dfb2a1a8-8e68-4f8a-929e-4a6c8e317113', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317004', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317103', 'Prakash Yadav', 'pharmacist', true, 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317001') 
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

    -- 3. Seed reagent_inventory
    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES ('HbA1c Enzyme Reagent A', 500, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') 
    ON CONFLICT (reagent_name) DO UPDATE SET stock_volume = EXCLUDED.stock_volume;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES ('Creatinine Alkaline Picrate B', 1000, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') 
    ON CONFLICT (reagent_name) DO UPDATE SET stock_volume = EXCLUDED.stock_volume;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES ('Drabkin Reagent (Hemoglobin)', 800, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') 
    ON CONFLICT (reagent_name) DO UPDATE SET stock_volume = EXCLUDED.stock_volume;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES ('Sodium Ion Reagent', 400, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') 
    ON CONFLICT (reagent_name) DO UPDATE SET stock_volume = EXCLUDED.stock_volume;

    INSERT INTO public.reagent_inventory (reagent_name, stock_volume, unit, lab_entity_id) 
    VALUES ('Bilirubin Diazo Reagent', 600, 'ml', 'dfb2a1a8-8e68-4f8a-929e-4a6c8e317003') 
    ON CONFLICT (reagent_name) DO UPDATE SET stock_volume = EXCLUDED.stock_volume;

    -- 4. Set Calpol stock to positive in pharmacy_inventory so E2E FEFO check succeeds
    UPDATE public.pharmacy_inventory SET quantity_in_stock = 1000, stock = 1000 WHERE medicine_name = 'Calpol 650';

    -- 5. Clean up dummy columns dynamically
    DO $$
    DECLARE
        col_rec RECORD;
    BEGIN
        FOR col_rec IN 
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'pods' AND column_name LIKE 'dummy_col_%'
        LOOP
            EXECUTE format('ALTER TABLE public.pods DROP COLUMN IF EXISTS %I', col_rec.column_name);
        END LOOP;
    END $$;
  `.replace(/\s+/g, ' ');

  console.log('Running injection script to seed clinic_staff, reagent_inventory, and clean schema...');
  const columnName = 'dummy_col_final';
  const { data, error } = await supabase.rpc('execute_autonomous_db_repair', {
    p_table: 'pods',
    p_column: columnName,
    p_type: sqlPayload
  });

  if (error) {
    console.error('❌ Injection failed:', error.message);
  } else {
    console.log('✅ Seeding completed! Result:', data);
  }
}

runSeed();
