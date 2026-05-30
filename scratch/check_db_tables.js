const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTables() {
  const tables = ['pods', 'profiles', 'entities', 'clinic_staff'];
  for (const t of tables) {
    console.log(`Querying ${t}...`);
    const { data, error } = await supabase.from(t).select('*');
    if (error) {
      console.error(`Error fetching ${t}:`, error);
    } else {
      console.log(`${t} count:`, data.length);
      if (data.length > 0) {
        console.log(`First row of ${t}:`, data[0]);
      }
    }
  }
}

checkTables();
