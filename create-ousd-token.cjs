const StellarSDK = require("@stellar/stellar-sdk");

// Pi Testnet Configuration
const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");
const NETWORK_PASSPHRASE = "Pi Testnet";

// Token Configuration
const TOKEN_CODE = "OUSD";
const TOKEN_NAME = "OpenUSD";
const TOKEN_DESCRIPTION = "A stablecoin token pegged to USD value on Pi Network testnet";
const TOKEN_IMAGE = "https://openpy.space/assets/ousd-icon.png";

// Replace with your actual testnet wallet private keys
const ISSUER_SECRET_KEY = "SB4YAJDYN7SIKW5YA5SYFHYWCM7Z6X6FTSYSIHDDEYHPM7DEAO536C3Y"; // Issuer wallet secret key
const DISTRIBUTOR_SECRET_KEY = "SAI3CUW3S2JVFBOPS4KBHTATQQNR34ME6NDMGFWQC2GIV4MTE6V625VS"; // Distributor wallet secret key

// Token amount to mint (100 billion OUSD)
const MINT_AMOUNT = "100000000000";

async function createOUSDToken() {
  try {
    console.log("🚀 Starting OpenUSD (OUSD) token creation on Pi Testnet...");
    
    // Validate keys are provided
    if (!ISSUER_SECRET_KEY || !DISTRIBUTOR_SECRET_KEY) {
      throw new Error("Please set ISSUER_SECRET_KEY and DISTRIBUTOR_SECRET_KEY in the script");
    }

    // Prepare keypairs
    const issuerKeypair = StellarSDK.Keypair.fromSecret(ISSUER_SECRET_KEY);
    const distributorKeypair = StellarSDK.Keypair.fromSecret(DISTRIBUTOR_SECRET_KEY);

    console.log(`📋 Issuer Public Key: ${issuerKeypair.publicKey()}`);
    console.log(`📋 Distributor Public Key: ${distributorKeypair.publicKey()}`);

    // Define the OUSD token
    const ousdToken = new StellarSDK.Asset(TOKEN_CODE, issuerKeypair.publicKey());

    // Load distributor account
    console.log("🔄 Loading distributor account...");
    const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());

    // Get current base fee
    const response = await server.ledgers().order("desc").limit(1).call();
    const latestBlock = response.records[0];
    const baseFee = latestBlock.base_fee_in_stroops || 100;

    console.log(`💰 Current base fee: ${baseFee} stroops`);

    // Step 1: Establish trustline from distributor to OUSD token
    console.log("🔗 Creating trustline for OUSD token...");
    const trustlineTransaction = new StellarSDK.TransactionBuilder(distributorAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(StellarSDK.Operation.changeTrust({ 
        asset: ousdToken, 
        limit: "100000000000" // 100 billion OUSD trustline limit
      }))
      .build();

    trustlineTransaction.sign(distributorKeypair);

    try {
      const trustlineResult = await server.submitTransaction(trustlineTransaction);
      console.log("✅ Trustline created successfully!");
      console.log(`📄 Trustline Transaction Hash: ${trustlineResult.hash}`);
    } catch (error) {
      if (error.response && error.response.data.extras.result_codes.transaction === "tx_failed") {
        console.log("ℹ️ Trustline may already exist or token already registered");
      } else {
        throw error;
      }
    }

    // Wait a moment for the trustline to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Mint OUSD tokens by sending from issuer to distributor
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
    console.log(`📄 Minting Transaction Hash: ${paymentResult.hash}`);
    console.log(`💎 Minted Amount: ${MINT_AMOUNT} OUSD`);

    // Step 3: Check balances
    console.log("📊 Checking updated balances...");
    const updatedDistributorAccount = await server.loadAccount(distributorKeypair.publicKey());
    
    console.log("\n📈 Account Balances:");
    updatedDistributorAccount.balances.forEach((balance) => {
      if (balance.asset_type === "native") {
        console.log(`   Pi Balance: ${balance.balance}`);
      } else {
        console.log(`   ${balance.asset_code} Balance: ${balance.balance}`);
        console.log(`   Issuer: ${balance.asset_issuer}`);
      }
    });

    // Step 4: Set home domain for issuer account
    console.log("🌐 Setting home domain for issuer account...");
    const updatedIssuerAccount = await server.loadAccount(issuerKeypair.publicKey());

    const setOptionsTransaction = new StellarSDK.TransactionBuilder(updatedIssuerAccount, {
      fee: baseFee,
      networkPassphrase: NETWORK_PASSPHRASE,
      timebounds: await server.fetchTimebounds(90),
    })
      .addOperation(StellarSDK.Operation.setOptions({ 
        homeDomain: "openpy.space" // Replace with your actual domain
      }))
      .build();

    setOptionsTransaction.sign(issuerKeypair);

    try {
      const setOptionsResult = await server.submitTransaction(setOptionsTransaction);
      console.log("✅ Home domain set successfully!");
      console.log(`📄 Set Options Transaction Hash: ${setOptionsResult.hash}`);
    } catch (error) {
      console.log("⚠️ Home domain may already be set or error occurred:", error.message);
    }

    // Display token information
    console.log("\n🎉 OpenUSD (OUSD) Token Created Successfully!");
    console.log("==========================================");
    console.log(`📛 Token Code: ${TOKEN_CODE}`);
    console.log(`🏷️  Token Name: ${TOKEN_NAME}`);
    console.log(`📝 Description: ${TOKEN_DESCRIPTION}`);
    console.log(`🔑 Issuer Public Key: ${issuerKeypair.publicKey()}`);
    console.log(`💎 Total Supply: ${MINT_AMOUNT} OUSD`);
    console.log(`🌐 Home Domain: openpy.space`);
    console.log(`🔗 Token Explorer: https://api.testnet.minepi.com/assets?asset_code=${TOKEN_CODE}&asset_issuer=${issuerKeypair.publicKey()}`);
    
    console.log("\n📋 Next Steps:");
    console.log("1. Host pi.toml file at https://openpy.space/.well-known/pi.toml");
    console.log("2. Ensure token icon is accessible at https://openpy.space/assets/ousd-icon.png");
    console.log("3. Wait for Pi Server to scan and verify your token");
    console.log("4. Token will appear in Pi Wallet after verification");

  } catch (error) {
    console.error("❌ Error creating OUSD token:", error.message);
    if (error.response && error.response.data) {
      console.error("📄 Error Details:", JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Helper function to check if token exists
async function checkTokenExists(assetCode, assetIssuer) {
  try {
    const response = await server.assets()
      .forCode(assetCode)
      .forIssuer(assetIssuer)
      .call();
    
    return response.records.length > 0;
  } catch (error) {
    return false;
  }
}

// Run the token creation
if (require.main === module) {
  createOUSDToken();
}

module.exports = { createOUSDToken, checkTokenExists };
