// VAPID Key Generator for Web Push Notifications
// Run this once to generate your VAPID key pair
// Usage: node generate_vapid_keys.cjs

const webpush = require('web-push');

function generateVapidKeys() {
  // Generate VAPID keys
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('=== VAPID Keys Generated ===');
  console.log('');
  console.log('Public Key (add to frontend):');
  console.log(vapidKeys.publicKey);
  console.log('');
  console.log('Private Key (add to backend secrets):');
  console.log(vapidKeys.privateKey);
  console.log('');
  console.log('Subject (your email or website):');
  console.log('mailto:your-email@example.com');
  console.log('');
  console.log('=== Environment Variables to Set ===');
  console.log('VAPID_PUBLIC_KEY=' + vapidKeys.publicKey);
  console.log('VAPID_PRIVATE_KEY=' + vapidKeys.privateKey);
  console.log('VAPID_SUBJECT=mailto:your-email@example.com');
  console.log('');
  console.log('=== Supabase Secrets ===');
  console.log('Add these as secrets in your Supabase project:');
  console.log('- VAPID_PUBLIC_KEY');
  console.log('- VAPID_PRIVATE_KEY');
  console.log('- VAPID_SUBJECT');
  
  return vapidKeys;
}

// Generate keys when this script is run
generateVapidKeys();

module.exports = { generateVapidKeys };
