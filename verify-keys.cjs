const StellarSDK = require("@stellar/stellar-sdk");

// Test the provided private keys
const ISSUER_SECRET_KEY = "SC2CB5I5N57AEW3MOY7WAGDBHGQNTB3A4QZ5F4RSBNXMC7QELWJJFNA";
const DISTRIBUTOR_SECRET_KEY = "SDILUY6GMPHBZFYXJ64P5DK2TPZFNCLEZKHFFS423RACFLKORGP3DPGJ";

function verifyKeypairs() {
  try {
    console.log("🔑 Verifying private keys...");
    
    // Test issuer keypair
    console.log("\n📋 Issuer Wallet:");
    try {
      const issuerKeypair = StellarSDK.Keypair.fromSecret(ISSUER_SECRET_KEY);
      console.log(`✅ Valid keypair`);
      console.log(`   Public Key: ${issuerKeypair.publicKey()}`);
      console.log(`   Secret Key: ${issuerKeypair.secret()}`);
    } catch (error) {
      console.log(`❌ Invalid issuer key: ${error.message}`);
      return false;
    }
    
    // Test distributor keypair
    console.log("\n📋 Distributor Wallet:");
    try {
      const distributorKeypair = StellarSDK.Keypair.fromSecret(DISTRIBUTOR_SECRET_KEY);
      console.log(`✅ Valid keypair`);
      console.log(`   Public Key: ${distributorKeypair.publicKey()}`);
      console.log(`   Secret Key: ${distributorKeypair.secret()}`);
    } catch (error) {
      console.log(`❌ Invalid distributor key: ${error.message}`);
      return false;
    }
    
    console.log("\n🎉 Both keys are valid!");
    return true;
    
  } catch (error) {
    console.error("❌ Error verifying keys:", error.message);
    return false;
  }
}

// Generate new test keypairs if needed
function generateNewKeypairs() {
  console.log("\n🔄 Generating new test keypairs:");
  
  const issuerKeypair = StellarSDK.Keypair.random();
  const distributorKeypair = StellarSDK.Keypair.random();
  
  console.log("\n🆕 New Issuer Wallet:");
  console.log(`   Public Key: ${issuerKeypair.publicKey()}`);
  console.log(`   Secret Key: ${issuerKeypair.secret()}`);
  
  console.log("\n🆕 New Distributor Wallet:");
  console.log(`   Public Key: ${distributorKeypair.publicKey()}`);
  console.log(`   Secret Key: ${distributorKeypair.secret()}`);
  
  console.log("\n⚠️  Save these keys and activate them in Pi Wallet before using!");
}

// Run verification
if (require.main === module) {
  const isValid = verifyKeypairs();
  if (!isValid) {
    console.log("\n🔧 Generating alternative keypairs...");
    generateNewKeypairs();
  }
}

module.exports = { verifyKeypairs, generateNewKeypairs };
