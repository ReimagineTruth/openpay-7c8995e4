const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSqlFile(filePath) {
  try {
    console.log(`Reading SQL file: ${filePath}`);
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    
    // Split SQL content by semicolons and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty lines
      if (statement.startsWith('--') || statement.length === 0) {
        continue;
      }
      
      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        
        // Execute the SQL statement using rpc
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          // If rpc doesn't exist, try direct SQL execution
          console.log('RPC method failed, trying direct SQL execution...');
          
          // For CREATE TABLE statements, we'll need to use a different approach
          if (statement.toLowerCase().includes('create table')) {
            console.log('CREATE TABLE detected - this requires direct database access');
            console.log('Please run the SQL manually in the Supabase dashboard:');
            console.log('1. Go to https://app.supabase.com');
            console.log('2. Select your project');
            console.log('3. Go to SQL Editor');
            console.log('4. Copy and paste the contents of fix_push_subscriptions_table.sql');
            console.log('5. Click "Run"');
            return;
          }
        }
        
        if (error) {
          console.error(`Error executing statement ${i + 1}:`, error);
        } else {
          console.log(`Statement ${i + 1} executed successfully`);
        }
      } catch (stmtError) {
        console.error(`Error executing statement ${i + 1}:`, stmtError.message);
      }
    }
    
    console.log('SQL execution completed');
    
  } catch (error) {
    console.error('Error reading or executing SQL file:', error);
  }
}

// Main execution
async function main() {
  const sqlFilePath = path.join(__dirname, 'fix_push_subscriptions_table.sql');
  
  console.log('Starting push_subscriptions table fix...');
  console.log('==========================================');
  
  await executeSqlFile(sqlFilePath);
  
  console.log('==========================================');
  console.log('Fix completed!');
  console.log('');
  console.log('If the automatic execution failed, please run the SQL manually:');
  console.log('1. Open fix_push_subscriptions_table.sql');
  console.log('2. Copy the contents');
  console.log('3. Go to Supabase dashboard > SQL Editor');
  console.log('4. Paste and run the SQL');
}

main().catch(console.error);
