# Pi Testnet Wallet Activation Guide

## 🚨 IMPORTANT: Wallets Must Be Activated First

The OUSD token creation cannot proceed until both testnet wallets are activated on Pi Network.

## 📋 Wallet Information

### Issuer Wallet
- **Public Key**: `GBWVO2DIFE27V3FBSX6K7MOW3IZJCFMP7BP4CCDIWFQAVXZWYYH3PDYZ`
- **Private Key**: `SBCE2GI44IVYP63IKFXZTE4APHAU4ZLYSQQCEDJHGMGXG3H3M7EWEJP5`

### Distributor Wallet
- **Public Key**: `GDTFWTOTMVXMU7BHKWFCTDVUZ5Z2V3LZYMRZVDD2ZOBU7IHH2JVGKDSB`
- **Private Key**: `SDLXWGOIJ3GKBZYSNLPEWFGTLQMBKWFC7XADYDKE2LXK5AGWCD5GOJ3Q`

## 🔧 Step-by-Step Activation

### 1. Open Pi Wallet App
- Download and install Pi Network app if not already installed
- Login to your Pi Network account

### 2. Enable Testnet Mode
- Go to **Settings** in the Pi Wallet app
- Look for **Testnet** or **Developer** options
- Enable testnet mode

### 3. Import the Issuer Wallet
- Select **Import Existing Wallet** or **Add Wallet**
- Choose **Import with Private Key**
- Enter: `SBCE2GI44IVYP63IKFXZTE4APHAU4ZLYSQQCEDJHGMGXG3H3M7EWEJP5`
- Set a nickname (e.g., "OUSD Issuer")

### 4. Import the Distributor Wallet
- Repeat the import process
- Enter: `SDLXWGOIJ3GKBZYSNLPEWFGTLQMBKWFC7XADYDKE2LXK5AGWCD5GOJ3Q`
- Set a nickname (e.g., "OUSD Distributor")

### 5. Fund Both Wallets
- Each wallet needs test Pi for transaction fees
- Request testnet Pi from Pi Network faucets
- Minimum recommended: 1 Pi per wallet

### 6. Verify Activation
- After importing and funding, wallets should appear as "activated"
- You can verify by running: `node check-wallets.cjs`

## ⚡ Quick Activation Commands

### Check Wallet Status
```bash
node check-wallets.cjs
```

### Auto-Wait and Create (After Manual Activation)
```bash
node activate-and-create.cjs
```

### Direct Token Creation (If Already Activated)
```bash
node create-ousd-token.cjs
```

## 🔍 Verification Steps

After activation, you should see:
```
📋 Issuer Wallet Status:
✅ Activated
   Balance: X.XXX Pi

📋 Distributor Wallet Status:
✅ Activated
   Balance: X.XXX Pi
```

## ⚠️ Important Notes

1. **Security**: These are testnet keys only - never use mainnet keys
2. **Backup**: Save the private keys securely
3. **Funding**: Ensure both wallets have sufficient Pi for fees
4. **Network**: Must be Pi Testnet (not mainnet)

## 🚀 Once Activated

After both wallets show as activated:
1. The token creation script will run automatically
2. 100 billion OUSD tokens will be minted
3. Token will be registered on Pi Testnet blockchain
4. You'll receive transaction hashes for verification

## 🆘 Troubleshooting

### "Wallet Not Found" Error
- Ensure wallets are imported correctly
- Check that testnet mode is enabled
- Verify private keys are entered correctly

### "Insufficient Balance" Error
- Add more test Pi to the wallets
- Use Pi Network testnet faucets

### "Network Error"
- Check internet connection
- Verify Pi Network testnet is accessible
- Try again after a few minutes

## 📞 Support

For Pi Network specific issues:
- Check Pi Network documentation
- Contact Pi Network support
- Join Pi Network developer communities

---

**Next Step**: Activate both wallets in Pi Wallet app, then run the token creation script.
