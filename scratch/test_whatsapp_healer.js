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

  console.log('Running query to check stale sessions...');
  const checkTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  console.log('Checking sessions created before:', checkTime);

  const { data: staleSessions, error: selectError } = await supabase
    .from('whatsapp_sessions')
    .select('id, patient_phone, current_state')
    .eq('current_state', 'AWAITING_WELCOME')
    .lt('created_at', checkTime);

  if (selectError) {
    console.error('❌ Select failed:', selectError);
    return;
  }

  console.log(`✅ Select succeeded. Found ${staleSessions.length} stale sessions:`, staleSessions);

  if (staleSessions.length > 0) {
    console.log('Attempting to mark them as INACTIVE...');
    const { data: updateData, error: updateError } = await supabase
      .from('whatsapp_sessions')
      .update({ current_state: 'INACTIVE' })
      .in('id', staleSessions.map(s => s.id))
      .select();

    if (updateError) {
      console.error('❌ Update failed:', updateError);
    } else {
      console.log('✅ Update succeeded:', updateData);
    }
  } else {
    console.log('No stale sessions to update.');
  }
}

run();
