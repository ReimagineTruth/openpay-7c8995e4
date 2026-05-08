const StellarSDK = require("@stellar/stellar-sdk");

// New wallet seeds provided by user
const ISSUER_SECRET_KEY = "SB4YAJDYN7SIKW5YA5SYFHYWCM7Z6X6FTSYSIHDDEYHPM7DEAO536C3Y";
const DISTRIBUTOR_SECRET_KEY = "SAI3CUW3S2JVFBOPS4KBHTATQQNR34ME6NDMGFWQC2GIV4MTE6V625VS";

function verifyNewKeypairs() {
  try {
    console.log("🔑 Verifying new wallet seeds...");
    
    // Test issuer keypair
    console.log("\n📋 New Issuer Wallet:");
    try {
      const issuerKeypair = StellarSDK.Keypair.fromSecret(ISSUER_SECRET_KEY);
      console.log(`✅ Valid keypair`);
      console.log(`   Public Key: ${issuerKeypair.publicKey()}`);
    } catch (error) {
      console.log(`❌ Invalid issuer key: ${error.message}`);
      return false;
    }
    
    // Test distributor keypair
    console.log("\n📋 New Distributor Wallet:");
    try {
      const distributorKeypair = StellarSDK.Keypair.fromSecret(DISTRIBUTOR_SECRET_KEY);
      console.log(`✅ Valid keypair`);
      console.log(`   Public Key: ${distributorKeypair.publicKey()}`);
    } catch (error) {
      console.log(`❌ Invalid distributor key: ${error.message}`);
      return false;
    }
    
    console.log("\n🎉 Both new keys are valid!");
    return true;
    
  } catch (error) {
    console.error("❌ Error verifying keys:", error.message);
    return false;
  }
}

// Run verification
if (require.main === module) {
  const isValid = verifyNewKeypairs();
  if (isValid) {
    console.log("\n🚀 Ready to create OUSD token with new keys!");
    console.log("Run: node create-ousd-token.cjs");
  }
}

module.exports = { verifyNewKeypairs };
