# OpenUSD (OUSD) Token Creation Guide

## Overview
This guide explains how to create the OpenUSD (OUSD) stablecoin token on Pi Network Testnet using the provided script and configuration files.

## Prerequisites

### 1. Testnet Wallets
You need **2 activated Pi Testnet wallets**:
- **Issuer Wallet**: Creates and mints the OUSD tokens
- **Distributor Wallet**: Receives the initial minted tokens

### 2. Private Keys
Extract private keys from Pi Wallet settings:
1. Open Pi Wallet app
2. Go to Settings → Advanced → Export Private Key
3. Copy the private keys for both wallets

### 3. Node.js Environment
Ensure Node.js 16+ is installed on your system.

## Setup Instructions

### Step 1: Install Dependencies
```bash
# Copy package.json to package.json if needed
cp package-token-creation.json package.json

# Install Stellar SDK
npm install
```

### Step 2: Configure Token Creation Script
Edit `create-ousd-token.js` and add your private keys:

```javascript
// Replace these lines with your actual private keys
const ISSUER_SECRET_KEY = "YOUR_ISSUER_PRIVATE_KEY_HERE";
const DISTRIBUTOR_SECRET_KEY = "YOUR_DISTRIBUTOR_PRIVATE_KEY_HERE";
```

### Step 3: Run Token Creation
```bash
npm run create-token
# or
node create-ousd-token.js
```

## Token Configuration

### Token Details
- **Code**: OUSD
- **Name**: OpenUSD
- **Type**: Stablecoin (USD-pegged)
- **Initial Supply**: 100,000,000,000 OUSD (100 billion)
- **Home Domain**: openpy.space

### Customization
You can modify these parameters in the script:
```javascript
const TOKEN_CODE = "OUSD";           // Token code (max 12 chars)
const TOKEN_NAME = "OpenUSD";        // Display name
const MINT_AMOUNT = "100000000000";        // Initial supply (100 billion)
```

## Post-Creation Steps

### 1. Update pi.toml
After token creation, update the `pi.toml` file with your issuer public key:

```toml
[[CURRENCIES]]
code="OUSD"
issuer="YOUR_ISSUER_PUBLIC_KEY_HERE"  # Replace with actual key
name="OpenUSD"
desc="A stablecoin token pegged to USD value on Pi Network..."
image="https://openpy.space/assets/ousd-icon.png"
```

### 2. Host Required Files
Place these files on your web server at `openpy.space`:

- `/.well-known/pi.toml` - Token metadata
- `/assets/ousd-icon.png` - Token icon (256x256 PNG recommended)

### 3. Verify Token Listing
Check if your token is recognized:
```bash
curl "https://api.testnet.minepi.com/assets?asset_code=OUSD&asset_issuer=YOUR_ISSUER_PUBLIC_KEY"
```

## Script Features

### Automated Processes
The script handles:
- ✅ Trustline establishment
- ✅ Token minting
- ✅ Balance verification
- ✅ Home domain setting
- ✅ Error handling and validation

### Error Handling
The script includes comprehensive error handling for:
- Invalid private keys
- Insufficient Pi balance for fees
- Network connectivity issues
- Transaction failures

## Security Considerations

### Private Key Security
- Never commit private keys to version control
- Store keys securely (environment variables recommended)
- Use testnet keys only for this process

### Recommended Security Practice
```bash
# Use environment variables instead of hardcoding keys
export ISSUER_SECRET_KEY="your_key_here"
export DISTRIBUTOR_SECRET_KEY="your_key_here"

# Then modify script to read from process.env
const ISSUER_SECRET_KEY = process.env.ISSUER_SECRET_KEY;
```

## Token Verification

### 1. Check Token on Explorer
Visit: `https://api.testnet.minepi.com/assets?asset_code=OUSD&asset_issuer=ISSUER_PUBLIC_KEY`

### 2. Verify in Pi Wallet
After Pi Server scans your token:
1. Open Pi Wallet app
2. Go to Assets
3. OUSD should appear in your token list

### 3. Test Transactions
- Send OUSD between testnet wallets
- Verify trustline functionality
- Check balance updates

## Troubleshooting

### Common Issues

#### "Trustline already exists"
- This is normal if the token was previously created
- The script will continue to minting step

#### "Insufficient balance"
- Ensure both wallets have test Pi for transaction fees
- Request testnet Pi from Pi Network faucets

#### "Home domain already set"
- This is normal if previously configured
- Token creation will still succeed

#### Token not appearing in Pi Wallet
- Verify pi.toml is accessible via HTTPS
- Check that all required fields are filled
- Wait for Pi Server to scan (can take time)

### Debug Mode
Add additional logging by modifying the script:
```javascript
// Add after each transaction submission
console.log("Transaction details:", JSON.stringify(result, null, 2));
```

## Next Steps After Creation

### 1. Token Distribution
- Set up additional trustlines for other users
- Create airdrop campaigns
- Implement token swap functionality

### 2. Integration
- Add OUSD support to your applications
- Create payment gateways
- Implement smart contract interactions

### 3. Mainnet Preparation
- Plan for mainnet deployment
- Security audits
- Compliance considerations

## Support

For issues related to:
- **Pi Network**: Visit Pi Network documentation
- **Stellar SDK**: Check Stellar documentation
- **Token Creation**: Review this guide and script comments

## Legal Notice
This token is created on Pi Testnet for development purposes only. Ensure compliance with applicable regulations before any mainnet deployment.
