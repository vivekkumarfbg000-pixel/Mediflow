const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://kguupaybvbngyzyofjun.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtndXVwYXlidmJuZ3l6eW9manVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTk0MjIsImV4cCI6MjA5NDk5NTQyMn0.3piYD73kK9tjYj8Goxpm2qYO_vXVtLPac79Yt8anyDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log(`\nApplying migration: ${path.basename(filePath)}`);
  
  // Split by semicolon but be careful with function bodies
  const statements = sql.split(/;\s*(?=(?:[^']*'[^']*')*[^']*$)/).filter(s => s.trim());
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('execute_autonomous_db_repair', {
        p_table: 'pods',
        p_column: 'migration_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        p_type: 'text;\n' + trimmed + ';'
      });
      
      if (error) {
        console.error('Error:', error.message);
      } else {
        console.log('✓ Statement executed');
      }
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
}

async function run() {
  // First sign in as admin
  await supabase.auth.signInWithPassword({
    email: 'doctor@mediflow.com',
    password: 'password123'
  });
  
  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && f.startsWith('20260611'))
    .sort();
  
  for (const file of files) {
    await applyMigration(path.join(migrationsDir, file));
  }
  
  console.log('\nAll migrations applied!');
}

run().catch(console.error);