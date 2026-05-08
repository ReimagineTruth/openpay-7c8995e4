const StellarSDK = require("@stellar/stellar-sdk");

// Test script to verify Pi Network connection and token setup
const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");
const NETWORK_PASSPHRASE = "Pi Testnet";

async function testConnection() {
  try {
    console.log("🔗 Testing Pi Network Testnet connection...");
    
    // Test basic connection
    const response = await server.ledgers().order("desc").limit(1).call();
    const latestLedger = response.records[0];
    
    console.log("✅ Connection successful!");
    console.log(`📊 Latest Ledger: ${latestLedger.sequence}`);
    console.log(`💰 Base Fee: ${latestLedger.base_fee_in_stroops} stroops`);
    
    // Test if we can query assets (this will work even without a specific token)
    console.log("\n🔍 Testing asset query...");
    const assets = await server.assets().limit(5).call();
    console.log(`📋 Found ${assets.records.length} assets on testnet`);
    
    console.log("\n🎉 Setup test completed successfully!");
    console.log("You're ready to create the OUSD token.");
    
  } catch (error) {
    console.error("❌ Connection test failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("1. Check your internet connection");
    console.log("2. Verify Pi Testnet is accessible");
    console.log("3. Ensure @stellar/stellar-sdk is installed: npm install");
  }
}

// Test keypair generation (for creating new test wallets)
function generateTestKeypairs() {
  console.log("\n🔑 Generating test keypairs (for reference):");
  
  const issuerKeypair = StellarSDK.Keypair.random();
  const distributorKeypair = StellarSDK.Keypair.random();
  
  console.log("Issuer Wallet:");
  console.log(`  Public Key: ${issuerKeypair.publicKey()}`);
  console.log(`  Secret Key: ${issuerKeypair.secret()}`);
  
  console.log("\nDistributor Wallet:");
  console.log(`  Public Key: ${distributorKeypair.publicKey()}`);
  console.log(`  Secret Key: ${distributorKeypair.secret()}`);
  
  console.log("\n⚠️  Save these keys securely and activate them in Pi Wallet!");
}

// Run tests
if (require.main === module) {
  testConnection().then(() => {
    generateTestKeypairs();
  });
}

module.exports = { testConnection, generateTestKeypairs };
