const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkInventorySchemas() {
  const tables = ['reagent_inventory', 'pharmacy_inventory', 'master_test_catalog'];

  for (const t of tables) {
    console.log(`Checking ${t} schema...`);
    // Attempting to select 1 row to get columns from object keys
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.error(`Error querying ${t}:`, error.message);
    } else {
      console.log(`Table ${t} columns:`, data.length > 0 ? Object.keys(data[0]) : 'No rows, let us try an insert/error or check metadata');
    }
  }
}

checkInventorySchemas();
