const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");
const NETWORK_PASSPHRASE = "Pi Testnet";

// Wallet configuration
const ISSUER_SECRET_KEY = "SB4YAJDYN7SIKW5YA5SYFHYWCM7Z6X6FTSYSIHDDEYHPM7DEAO536C3Y";
const DISTRIBUTOR_SECRET_KEY = "SAI3CUW3S2JVFBOPS4KBHTATQQNR34ME6NDMGFWQC2GIV4MTE6V625VS";

// Token configuration
const TOKEN_CODE = "OUSD";
const MINT_AMOUNT = "100000000000";

async function updateTrustlineAndMint() {
  try {
    console.log("🔄 Updating trustline and minting OUSD tokens...");
    
    // Prepare keypairs
    const issuerKeypair = StellarSDK.Keypair.fromSecret(ISSUER_SECRET_KEY);
    const distributorKeypair = StellarSDK.Keypair.fromSecret(DISTRIBUTOR_SECRET_KEY);
    
    console.log(`📋 Issuer: ${issuerKeypair.publicKey()}`);
    console.log(`📋 Distributor: ${distributorKeypair.publicKey()}`);
    
    // Define the OUSD token
    const ousdToken = new StellarSDK.Asset(TOKEN_CODE, issuerKeypair.publicKey());
    
    // Load distributor account
    console.log("🔄 Loading distributor account...");
    const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());
    
    // Get current base fee
    const response = await server.ledgers().order("desc").limit(1).call();
    const baseFee = response.records[0].base_fee_in_stroops || 100;
    
    // Update trustline with higher limit
    console.log("🔗 Updating trustline with higher limit...");
    const trustlineTransaction = new StellarSDK.TransactionBuilder(distributorAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(StellarSDK.Operation.changeTrust({ 
        asset: ousdToken, 
        limit: "100000000000" // 100 billion OUSD
      }))
      .build();
    
    trustlineTransaction.sign(distributorKeypair);
    
    try {
      const trustlineResult = await server.submitTransaction(trustlineTransaction);
      console.log("✅ Trustline updated successfully!");
      console.log(`📄 Transaction: ${trustlineResult.hash}`);
    } catch (error) {
      if (error.response && error.response.data.extras.result_codes.operations[0] === "op_no_trustline") {
        console.log("ℹ️ Creating new trustline...");
        // If no trustline exists, create one
        const newTrustlineTransaction = new StellarSDK.TransactionBuilder(distributorAccount, {
          fee: baseFee,
          networkPassphrase: NETWORK_PASSPHRASE,
          timebounds: await server.fetchTimebounds(90),
        })
          .addOperation(StellarSDK.Operation.changeTrust({ 
            asset: ousdToken, 
            limit: "100000000000"
          }))
          .build();
        
        newTrustlineTransaction.sign(distributorKeypair);
        const newTrustlineResult = await server.submitTransaction(newTrustlineTransaction);
        console.log("✅ New trustline created successfully!");
        console.log(`📄 Transaction: ${newTrustlineResult.hash}`);
      } else {
        console.log("ℹ️ Trustline may already have sufficient limit, proceeding to minting...");
      }
    }
    
    // Wait a moment for trustline to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mint OUSD tokens
    console.log("🪙 Minting OUSD tokens...");
    const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());
    
    const paymentTransaction = new StellarSDK.TransactionBuilder(issuerAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(
        StellarSDK.Operation.payment({
          destination: distributorKeypair.publicKey(),
          asset: ousdToken,
          amount: MINT_AMOUNT,
        })
      )
      .build();
    
    paymentTransaction.sign(issuerKeypair);
    
    const paymentResult = await server.submitTransaction(paymentTransaction);
    console.log("✅ OUSD tokens minted successfully!");
    console.log(`📄 Transaction: ${paymentResult.hash}`);
    console.log(`💎 Amount: ${MINT_AMOUNT} OUSD`);
    
    // Check final balances
    console.log("📊 Checking final balances...");
    const updatedDistributorAccount = await server.loadAccount(distributorKeypair.publicKey());
    
    updatedDistributorAccount.balances.forEach((balance) => {
      if (balance.asset_type === "native") {
        console.log(`   Pi Balance: ${balance.balance}`);
      } else {
        console.log(`   ${balance.asset_code} Balance: ${balance.balance}`);
        if (balance.asset_code === TOKEN_CODE) {
          console.log(`   Limit: ${balance.limit}`);
        }
      }
    });
    
    console.log("\n🎉 OpenUSD (OUSD) Token Created Successfully!");
    console.log("==========================================");
    console.log(`📛 Token Code: ${TOKEN_CODE}`);
    console.log(`🔑 Issuer: ${issuerKeypair.publicKey()}`);
    console.log(`💎 Total Supply: ${MINT_AMOUNT} OUSD`);
    console.log(`🔗 Explorer: https://api.testnet.minepi.com/assets?asset_code=${TOKEN_CODE}&asset_issuer=${issuerKeypair.publicKey()}`);
    
    return issuerKeypair.publicKey();
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("📄 Details:", JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Run the process
if (require.main === module) {
  updateTrustlineAndMint().then(issuerPublicKey => {
    if (issuerPublicKey) {
      console.log(`\n📝 Update pi.toml with issuer: ${issuerPublicKey}`);
    }
  }).catch(console.error);
}

module.exports = { updateTrustlineAndMint };
