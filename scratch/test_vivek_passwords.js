const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const passwords = [
  'password123',
  'Password123',
  'PASSWORD123',
  'vivek123',
  'Vivek123',
  'mediflow123',
  'Mediflow123',
  'Mediflow@123',
  'vivekkumar',
  'VivekKumar',
  '123456',
  'password',
  'Password@123',
  'vivek@123',
  'Mediflow@2024',
  'admin123',
  'Admin123',
];

async function run() {
  for (const password of passwords) {
    console.log(`\nTrying password: ${password}`);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'vivekkumarfbg000@gmail.com',
        password
      });
      
      if (error) {
        console.log(`  ❌ ${error.message}`);
      } else {
        console.log(`  ✅ SUCCESS! User ID: ${data.user.id}`);
        console.log('  User Metadata:', JSON.stringify(data.user.user_metadata, null, 2));
        return;
      }
    } catch (err) {
      console.error(`  Error:`, err.message);
    }
  }
  
  console.log('\n❌ All passwords failed');
}

run().catch(console.error);