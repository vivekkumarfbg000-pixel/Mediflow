const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testRegister() {
  console.log('Attempting to sign up user vivekobrayfbg000@gmail.com...');
  try {
    const { data, error } = await supabase.auth.signUp({
      email: 'vivekobrayfbg000@gmail.com',
      password: 'password@123',
      options: {
        data: {
          display_name: 'Dr. Vivek Obray',
          role: 'doctor'
        }
      }
    });

    if (error) {
      console.log('Sign up failed/error:', error.message);
    } else {
      console.log('Sign up response:', JSON.stringify(data, null, 2));
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        console.log('\nNOTE: identities array is empty. This means the user is ALREADY registered in auth.users!');
      } else {
        console.log('\nNOTE: Sign up succeeded. The user did not exist before and has been newly created.');
      }
    }
  } catch (err) {
    console.error('Exception during sign up:', err.message);
  }
}

testRegister();
