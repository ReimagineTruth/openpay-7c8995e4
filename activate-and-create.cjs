const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");
const NETWORK_PASSPHRASE = "Pi Testnet";

// Wallet addresses
const ISSUER_PUBLIC_KEY = "GBWVO2DIFE27V3FBSX6K7MOW3IZJCFMP7BP4CCDIWFQAVXZWYYH3PDYZ";
const DISTRIBUTOR_PUBLIC_KEY = "GDTFWTOTMVXMU7BHKWFCTDVUZ5Z2V3LZYMRZVDD2ZOBU7IHH2JVGKDSB";

// Token configuration
const TOKEN_CODE = "OUSD";
const MINT_AMOUNT = "100000000000";

async function waitForWalletActivation(maxAttempts = 30, delayMs = 5000) {
  console.log("⏳ Waiting for wallet activation...");
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`\n🔄 Attempt ${attempt}/${maxAttempts} - Checking wallet status...`);
      
      let issuerActivated = false;
      let distributorActivated = false;
      
      // Check issuer wallet
      try {
        await server.loadAccount(ISSUER_PUBLIC_KEY);
        issuerActivated = true;
        console.log("✅ Issuer wallet activated");
      } catch (error) {
        console.log("❌ Issuer wallet not yet activated");
      }
      
      // Check distributor wallet
      try {
        await server.loadAccount(DISTRIBUTOR_PUBLIC_KEY);
        distributorActivated = true;
        console.log("✅ Distributor wallet activated");
      } catch (error) {
        console.log("❌ Distributor wallet not yet activated");
      }
      
      if (issuerActivated && distributorActivated) {
        console.log("🎉 Both wallets are now activated!");
        return true;
      }
      
      if (attempt < maxAttempts) {
        console.log(`⏱️  Waiting ${delayMs/1000} seconds before next check...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
    } catch (error) {
      console.log(`⚠️  Error during check ${attempt}: ${error.message}`);
    }
  }
  
  console.log("⏰ Timeout: Wallets not activated within the time limit");
  return false;
}

async function createTokenAfterActivation() {
  try {
    console.log("🚀 Starting OUSD token creation...");
    
    // Wait for activation
    const activated = await waitForWalletActivation();
    if (!activated) {
      console.log("❌ Cannot proceed - wallets not activated");
      return;
    }
    
    // Load accounts
    console.log("📋 Loading accounts...");
    const issuerKeypair = StellarSDK.Keypair.fromSecret("SBCE2GI44IVYP63IKFXZTE4APHAU4ZLYSQQCEDJHGMGXG3H3M7EWEJP5");
    const distributorKeypair = StellarSDK.Keypair.fromSecret("SDLXWGOIJ3GKBZYSNLPEWFGTLQMBKWFC7XADYDKE2LXK5AGWCD5GOJ3Q");
    
    const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());
    
    // Get base fee
    const response = await server.ledgers().order("desc").limit(1).call();
    const baseFee = response.records[0].base_fee_in_stroops || 100;
    
    // Create trustline
    console.log("🔗 Creating trustline...");
    const ousdToken = new StellarSDK.Asset(TOKEN_CODE, issuerKeypair.publicKey());
    
    const trustlineTransaction = new StellarSDK.TransactionBuilder(distributorAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(StellarSDK.Operation.changeTrust({ 
        asset: ousdToken, 
        limit: "1000000000" 
      }))
      .build();
    
    trustlineTransaction.sign(distributorKeypair);
    const trustlineResult = await server.submitTransaction(trustlineTransaction);
    console.log("✅ Trustline created successfully!");
    console.log(`📄 Transaction: ${trustlineResult.hash}`);
    
    // Mint tokens
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
    
    // Check balances
    console.log("📊 Checking final balances...");
    const updatedAccount = await server.loadAccount(distributorKeypair.publicKey());
    
    updatedAccount.balances.forEach((balance) => {
      if (balance.asset_type === "native") {
        console.log(`   Pi Balance: ${balance.balance}`);
      } else {
        console.log(`   ${balance.asset_code} Balance: ${balance.balance}`);
      }
    });
    
    console.log("\n🎉 OpenUSD (OUSD) Token Created Successfully!");
    console.log(`🔗 Explorer: https://api.testnet.minepi.com/assets?asset_code=${TOKEN_CODE}&asset_issuer=${issuerKeypair.publicKey()}`);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.response) {
      console.error("📄 Details:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the process
if (require.main === module) {
  createTokenAfterActivation();
}

module.exports = { createTokenAfterActivation, waitForWalletActivation };
