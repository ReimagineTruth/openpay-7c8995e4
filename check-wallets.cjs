const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server("https://api.testnet.minepi.com");

// Wallet addresses from the generated keypairs
const ISSUER_PUBLIC_KEY = "GBWVO2DIFE27V3FBSX6K7MOW3IZJCFMP7BP4CCDIWFQAVXZWYYH3PDYZ";
const DISTRIBUTOR_PUBLIC_KEY = "GDTFWTOTMVXMU7BHKWFCTDVUZ5Z2V3LZYMRZVDD2ZOBU7IHH2JVGKDSB";

async function checkWalletActivation() {
  try {
    console.log("🔍 Checking wallet activation status on Pi Testnet...");
    
    // Check issuer wallet
    console.log("\n📋 Issuer Wallet Status:");
    try {
      const issuerAccount = await server.loadAccount(ISSUER_PUBLIC_KEY);
      console.log(`✅ Activated`);
      console.log(`   Balance: ${issuerAccount.balances[0].balance} Pi`);
      console.log(`   Sequence: ${issuerAccount.sequence}`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`❌ Not activated`);
        console.log(`   Public Key: ${ISSUER_PUBLIC_KEY}`);
        console.log(`   Action: Activate this wallet in Pi Wallet app`);
      } else {
        console.log(`⚠️  Error checking: ${error.message}`);
      }
    }
    
    // Check distributor wallet
    console.log("\n📋 Distributor Wallet Status:");
    try {
      const distributorAccount = await server.loadAccount(DISTRIBUTOR_PUBLIC_KEY);
      console.log(`✅ Activated`);
      console.log(`   Balance: ${distributorAccount.balances[0].balance} Pi`);
      console.log(`   Sequence: ${distributorAccount.sequence}`);
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log(`❌ Not activated`);
        console.log(`   Public Key: ${DISTRIBUTOR_PUBLIC_KEY}`);
        console.log(`   Action: Activate this wallet in Pi Wallet app`);
      } else {
        console.log(`⚠️  Error checking: ${error.message}`);
      }
    }
    
    console.log("\n📖 Activation Instructions:");
    console.log("1. Open Pi Wallet app on your device");
    console.log("2. Go to Settings → Testnet");
    console.log("3. Select 'Create New Wallet' or 'Import Existing Wallet'");
    console.log("4. Use the private keys provided above");
    console.log("5. Ensure both wallets have some test Pi for transaction fees");
    console.log("6. Re-run the token creation script after activation");
    
  } catch (error) {
    console.error("❌ Error checking wallets:", error.message);
  }
}

// Run wallet check
if (require.main === module) {
  checkWalletActivation();
}

module.exports = { checkWalletActivation };
