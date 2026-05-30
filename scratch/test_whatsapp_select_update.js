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

  const phone = '9999999999';
  const state = 'AWAITING_CONSENT';
  const data = {};

  console.log('Selecting session...');
  const { data: dbSess, error: selError } = await supabase
    .from('whatsapp_sessions')
    .select('session_data')
    .eq('patient_phone', phone)
    .single();

  if (selError) {
    console.error('Select error:', selError);
  } else {
    console.log('Selected session data:', dbSess);
  }

  const mergedData = { ...(dbSess?.session_data || {}), ...data, currentState: state };
  
  const allowed = ['AWAITING_WELCOME', 'AWAITING_CONFIRMATION', 'AWAITING_PAYMENT', 'BOOKING_VIRTUAL', 'COMPLETED', 'INACTIVE'];
  let dbState = state;
  if (!allowed.includes(state)) {
    if (state === 'AWAITING_CONSENT') dbState = 'AWAITING_WELCOME';
    else if (state === 'AWAITING_WELCOME_ACK') dbState = 'AWAITING_CONFIRMATION';
    else if (state === 'MEDICINE_ORDERING') dbState = 'BOOKING_VIRTUAL';
    else if (state === 'MEDICINE_AWAITING_PAYMENT') dbState = 'AWAITING_PAYMENT';
    else if (state === 'MEDICINE_READY_FOR_PICKUP') dbState = 'COMPLETED';
    else if (state === 'FAILED_DELIVERY') dbState = 'INACTIVE';
    else dbState = 'AWAITING_WELCOME';
  }

  console.log('Updating session in Supabase with state:', dbState);
  const { data: updateData, error: updateError } = await supabase
    .from('whatsapp_sessions')
    .update({
      current_state: dbState,
      last_interaction: new Date().toISOString(),
      session_data: mergedData
    })
    .eq('patient_phone', phone)
    .select();

  if (updateError) {
    console.error('Update error:', updateError);
  } else {
    console.log('Updated successfully:', updateData);
  }
}

run();
