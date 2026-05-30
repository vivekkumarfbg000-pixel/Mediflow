const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchemaDetails() {
  const tables = ['reagent_inventory', 'pharmacy_inventory', 'master_test_catalog'];

  for (const t of tables) {
    console.log(`Checking columns for table: ${t}...`);
    // Querying PostgreSQL information_schema via RPC or raw query if possible.
    // Wait, let's query via RPC if there's any. If not, we can trigger a table load check or insert mock.
    // Wait, let's do a simple SELECT to check if we can query pg_catalog.
    // If not, we can write a quick SQL query using Supabase client to fetch from a custom function or execute.
    // Wait, let's try calling a quick select on information_schema.columns.
    // Wait, Supabase client cannot query system tables directly unless we have an RPC or we use Postgres REST.
    // Let's check if we can do an insert with a dummy column and read the error message!
    // Supabase will return the exact list of valid columns in the error message!
    const { error } = await supabase.from(t).insert({ dummy_nonexistent_column: 'test' });
    if (error) {
      console.log(`Table ${t} error description:`, error.message || error.details);
    }
  }
}

checkSchemaDetails();
