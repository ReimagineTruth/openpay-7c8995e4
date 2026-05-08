const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");
const NETWORK_PASSPHRASE = "Pi Testnet";

// Issuer wallet configuration
const ISSUER_SECRET_KEY = "SB4YAJDYN7SIKW5YA5SYFHYWCM7Z6X6FTSYSIHDDEYHPM7DEAO536C3Y";

async function setHomeDomain() {
  try {
    console.log("🌐 Setting home domain for OUSD token issuer...");
    
    // Prepare keypair
    const issuerKeypair = StellarSDK.Keypair.fromSecret(ISSUER_SECRET_KEY);
    console.log(`📋 Issuer: ${issuerKeypair.publicKey()}`);
    
    // Load issuer account
    console.log("🔄 Loading issuer account...");
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    
    // Get current base fee
    const response = await server.ledgers().order("desc").limit(1).call();
    const baseFee = response.records[0].base_fee_in_stroops || 100;
    
    // Set home domain
    console.log("🏠 Setting home domain to openpy.space...");
    const setOptionsTransaction = new StellarSDK.TransactionBuilder(issuerAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(StellarSDK.Operation.setOptions({ 
        homeDomain: "openpy.space"
      }))
      .build();
    
    setOptionsTransaction.sign(issuerKeypair);
    
    const setOptionsResult = await server.submitTransaction(setOptionsTransaction);
    console.log("✅ Home domain set successfully!");
    console.log(`📄 Transaction: ${setOptionsResult.hash}`);
    
    // Verify the home domain was set
    console.log("🔍 Verifying home domain...");
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for transaction to process
    
    const updatedAccount = await server.loadAccount(issuerKeypair.publicKey());
    
    // Check if home domain is now set
    const tokenInfo = await server.assets()
      .forCode("OUSD")
      .forIssuer(issuerKeypair.publicKey())
      .call();
    
    if (tokenInfo.records.length > 0) {
      const token = tokenInfo.records[0];
      console.log("📋 Token Information:");
      console.log(`   Code: ${token.asset_code}`);
      console.log(`   Issuer: ${token.asset_issuer}`);
      console.log(`   TOML Link: ${token._links.toml.href}`);
      
      if (token._links.toml.href.includes("openpy.space")) {
        console.log("✅ Home domain is properly configured!");
        console.log("🔗 Pi Wallet should now be able to discover the OUSD token");
        console.log("⏳ Note: Pi Server may need time to scan and verify the token");
      } else {
        console.log("⚠️ Home domain may not be fully updated yet");
      }
    }
    
    console.log("\n🎉 Home domain configuration complete!");
    console.log("📝 Next steps:");
    console.log("1. Wait for Pi Server to scan the token (can take time)");
    console.log("2. Check Pi Wallet for OUSD token appearance");
    console.log("3. Token should appear once verification is complete");
    
  } catch (error) {
    console.error("❌ Error setting home domain:", error.message);
    if (error.response) {
      console.error("📄 Details:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the home domain setting
if (require.main === module) {
  setHomeDomain();
}

module.exports = { setHomeDomain };
