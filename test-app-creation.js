// Test script to verify app creation API
const { createClient } = require('@supabase/supabase-js');

// Configuration - replace with your actual values
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

async function testAppCreation() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  console.log('Testing app creation API...');
  
  try {
    // Test 1: Check if user can authenticate
    console.log('\n1. Testing authentication...');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('❌ Authentication error:', authError.message);
      return;
    }
    
    if (!session) {
      console.log('❌ No active session found. Please login first.');
      return;
    }
    
    console.log('✅ Authentication successful');
    console.log('User ID:', session.user.id);
    
    // Test 2: Test app creation API
    console.log('\n2. Testing app creation...');
    
    const testData = {
      app_name: 'Test App ' + Date.now(),
      app_description: 'Test app description',
      app_url: 'https://testapp.com',
      app_logo_url: null,
      webhook_url: 'https://testapp.com/webhook'
    };
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/app-payments/create-app`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    if (response.ok && result.success) {
      console.log('✅ App creation successful');
      console.log('App ID:', result.data.app_id);
      console.log('Secret Key:', result.data.app_secret_key);
      console.log('Public Key:', result.data.app_public_key);
    } else {
      console.error('❌ App creation failed');
      console.error('Status:', response.status);
      console.error('Error:', result.error || 'Unknown error');
    }
    
    // Test 3: Test get apps API
    console.log('\n3. Testing get apps...');
    
    const appsResponse = await fetch(`${SUPABASE_URL}/functions/v1/app-payments/get-apps`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    
    const appsResult = await appsResponse.json();
    
    if (appsResponse.ok && appsResult.success) {
      console.log('✅ Get apps successful');
      console.log('Number of apps:', appsResult.data.length);
      appsResult.data.forEach((app, index) => {
        console.log(`  ${index + 1}. ${app.app_name} (${app.status})`);
      });
    } else {
      console.error('❌ Get apps failed');
      console.error('Error:', appsResult.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testAppCreation().then(() => {
  console.log('\nTest completed.');
}).catch(error => {
  console.error('Test script failed:', error);
});
