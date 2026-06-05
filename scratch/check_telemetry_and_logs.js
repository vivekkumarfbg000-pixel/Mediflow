const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Authenticating...');
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });

  console.log('Fetching latest 5 telemetry logs...');
  const { data: tel, error: telErr } = await supabase
    .from('system_health_telemetry')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (tel) {
    tel.forEach((t, i) => {
      console.log(`[Telemetry #${i}]`, JSON.stringify(t, null, 2));
    });
  } else {
    console.error(telErr);
  }
}

run();
