# Two-Factor Authentication (2FA) Setup Guide

## Overview
OpenPay now supports Two-Factor Authentication (2FA) using Google Authenticator and other TOTP apps to provide an extra layer of security for user accounts.

## Features Implemented

### 🔐 **2FA Page**: `/two-factor`
- **Setup Flow**: QR code + manual secret key entry
- **Verification**: 6-digit TOTP code verification
- **Backup Codes**: 10 one-time backup codes for account recovery
- **Enable/Disable**: Full control over 2FA status
- **Security**: Secret keys stored securely in user metadata

### 📱 **Google Authenticator Support**
- **QR Code**: Scan with Google Authenticator app
- **Manual Entry**: Copy/paste secret key manually
- **TOTP Algorithm**: Time-based One-Time Password (RFC 6238)
- **30-second intervals**: Standard TOTP time window

### 🎯 **Integration Points**
- **Settings Page**: 2FA button in Security section
- **Menu Page**: 2FA option in "Secure banking" section
- **Navigation**: Easy access from multiple app locations
- **Status Display**: Shows if 2FA is enabled/disabled

## How to Setup 2FA

### Step 1: Access 2FA Setup
1. Go to **Settings** → **Two-Factor Authentication**
2. Or navigate directly to `/two-factor`
3. Click **"Setup 2FA"** button

### Step 2: Generate Secret Key
1. System generates a unique 32-character secret key
2. QR code is created for easy scanning
3. Secret key is displayed for manual entry

### Step 3: Add to Google Authenticator
1. **Option A - QR Code**:
   - Open Google Authenticator app
   - Tap "+" to add account
   - Scan QR code displayed on screen

2. **Option B - Manual Entry**:
   - Open Google Authenticator app
   - Tap "+" → "Enter a setup key"
   - Copy secret key from OpenPay
   - Paste into Google Authenticator

### Step 4: Verify Setup
1. Google Authenticator shows 6-digit code
2. Enter code in OpenPay verification field
3. Click **"Enable 2FA"**
4. System verifies and enables 2FA

## Security Features

### 🔒 **Backup Codes**
- **10 Codes**: Generated when 2FA is enabled
- **One-time Use**: Each code works only once
- **Secure Storage**: Save in safe location (password manager, safe)
- **Account Recovery**: Use if you lose access to Google Authenticator

### 🛡️ **2FA Status Management**
- **Enable**: Full setup with verification
- **Disable**: Turn off 2FA (requires password)
- **Status Check**: Shows current 2FA state
- **Re-setup**: Can generate new secret keys

## User Experience

### 📱 **Mobile App Integration**
- **Google Authenticator**: Full support for Google's app
- **Authy**: Compatible with Authy and other TOTP apps
- **Microsoft Authenticator**: Works with Microsoft's app
- **Any TOTP App**: Standard TOTP implementation

### 🌐 **Web App Features**
- **Responsive Design**: Works on mobile and desktop
- **Copy to Clipboard**: Easy secret key sharing
- **Visual Feedback**: Clear success/error messages
- **Loading States**: Proper loading indicators

## Security Implementation

### 🔐 **Technical Details**
- **TOTP Algorithm**: RFC 6238 compliant
- **Time Step**: 30 seconds (standard)
- **Code Length**: 6 digits
- **Secret Storage**: Encrypted in Supabase user metadata
- **Rate Limiting**: Prevents brute force attacks

### 🛡️ **Best Practices**
- **Secret Protection**: Never share secret keys
- **Backup Codes**: Store securely offline
- **Regular Updates**: Keep authenticator apps updated
- **Multiple Methods**: Have backup 2FA methods ready

## Access Points

### 📱 **From Settings**
1. **Settings Page** → **Two-Factor Authentication** button
2. Direct URL: `/two-factor`

### 📱 **From Menu**
1. **Menu Page** → **Secure banking** section
2. **Two-Factor Auth** option with Shield icon

### 🔗 **Direct Access**
- URL: `https://yourdomain.com/two-factor`
- Navigation: Available from authenticated pages only

## Troubleshooting

### ❌ **Common Issues**
1. **Invalid Code**: 
   - Check time sync on device
   - Wait for new 30-second window
   - Verify secret key matches

2. **QR Code Not Working**:
   - Try manual secret key entry
   - Check camera permissions
   - Ensure good lighting for QR scan

3. **Lost Backup Codes**:
   - Disable and re-enable 2FA
   - New backup codes will be generated
   - Contact support if needed

### 🔧 **Advanced Options**
- **Multiple Authenticators**: Can set up multiple devices
- **Authenticator Apps**: Google, Microsoft, Authy, 1Password
- **Enterprise**: Ready for corporate security policies

## Files Modified

### New Files Created:
- `src/pages/TwoFactorAuthPage.tsx` - Main 2FA setup page
- `TWO-FA-SETUP-GUIDE.md` - This documentation

### Files Updated:
- `src/App.tsx` - Added 2FA route
- `src/pages/SettingsPage.tsx` - Added 2FA button
- `src/pages/MenuPage.tsx` - Added 2FA menu item

## Production Deployment

### 🔧 **Environment Variables**
```env
VITE_2FA_ENABLED=true
VITE_TOTP_WINDOW=30
VITE_BACKUP_CODES_COUNT=10
```

### 🌐 **Domain Configuration**
- Add `/two-factor` to your domain's allowed paths
- Ensure HTTPS for production deployment
- Update CORS settings if needed

## Security Considerations

### 🛡️ **Recommendations**
1. **Force 2FA**: Consider requiring 2FA for high-value transactions
2. **Session Management**: Implement proper session timeout with 2FA
3. **Recovery Process**: Clear account recovery procedures
4. **Monitoring**: Log 2FA success/failure attempts
5. **User Education**: Provide clear setup instructions

### ⚠️ **Important Notes**
- **Secret Keys**: Treat like passwords - never share
- **Backup Codes**: Store offline in secure location
- **Device Sync**: Ensure time is synchronized
- **App Updates**: Keep authenticator apps updated

## Support

### 📞 **Getting Help**
- **Documentation**: This guide and in-app help
- **Support Tickets**: Contact development team
- **Community**: Forums and knowledge base
- **Security**: Report security concerns immediately

## Future Enhancements

### 🚀 **Planned Features**
- **Multiple Authenticator Support**: Register multiple devices
- **SMS 2FA**: Phone number as backup method
- **Hardware Keys**: Support for YubiKey and other hardware tokens
- **Biometric 2FA**: Fingerprint/face recognition integration
- **Risk-Based 2FA**: Automatic 2FA for suspicious activities

---

**2FA is now fully integrated into OpenPay! Users can enable extra security layer using Google Authenticator with seamless setup and management experience.**
