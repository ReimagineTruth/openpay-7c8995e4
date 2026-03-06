# POS Payment Debugging Guide

## 🔍 Step-by-Step Debugging Process

### **Step 1: Create a POS Session**
1. Go to POS page
2. Enter an amount (e.g., 10.00)
3. Click "Generate QR Code"
4. Note the session token displayed

### **Step 2: Check Session Creation**
Open browser console and look for:
```
QR code generated - Dynamic mode
```

Check the session by clicking **"Check Payment"** button:
- Should show: `Session: open, Payment: none`

### **Step 3: Test Payment Processing**
Click the **"Test Payment"** button to test the payment function directly.

**Expected Results:**
- ✅ Success: `Test payment processed: [transaction_id]`
- ❌ Error: `Payment failed: [error_message]`

### **Step 4: Common Issues & Solutions**

#### **Issue 1: "Merchant cannot pay own checkout"**
**Problem**: Testing with the same account that created the POS session
**Solution**: Use a different user account to make the payment

#### **Issue 2: "Checkout session expired"**
**Problem**: Session has expired (30 min for dynamic, 24h for static)
**Solution**: Create a new POS session

#### **Issue 3: "Insufficient balance"**
**Problem**: User doesn't have enough balance in wallet
**Solution**: Add funds to the user's wallet

#### **Issue 4: "Checkout session not found"**
**Problem**: Session token is invalid or session doesn't exist
**Solution**: Create a new POS session

#### **Issue 5: "Unauthorized"**
**Problem**: User is not logged in
**Solution**: Log in to OpenPay account

### **Step 5: Manual Payment Test**

#### **Option A: Use QR Code**
1. Use a different device/user account
2. Scan the QR code with OpenPay app
3. Complete the payment
4. Check if POS detects the payment

#### **Option B: Direct Payment Function**
1. Copy the session token from POS
2. Use the "Test Payment" button
3. This calls the payment function directly

### **Step 6: Verify Database Records**

After a successful payment, check:

#### **merchant_checkout_sessions table**
```sql
SELECT * FROM merchant_checkout_sessions 
WHERE session_token = 'your_session_token';
```
Should show: `status = 'paid'`

#### **merchant_payments table**
```sql
SELECT * FROM merchant_payments 
WHERE session_id = (SELECT id FROM merchant_checkout_sessions 
                   WHERE session_token = 'your_session_token');
```
Should show: `status = 'succeeded'`

#### **transactions table**
```sql
SELECT * FROM transactions 
WHERE id = (SELECT transaction_id FROM merchant_payments 
           WHERE session_id = (SELECT id FROM merchant_checkout_sessions 
                              WHERE session_token = 'your_session_token'));
```
Should show the transaction record

### **Step 7: Check Payment Detection**

The POS polls every 2 seconds. In the console, you should see:
```
Polling for payment status... [session_id]
Polling results: { sessionData: {...}, paymentData: {...} }
Payment status check: { isPaid: true, ... }
Payment detected as successful!
```

### **Step 8: Thank You Page**

After successful detection, you should be redirected to:
```
/pos-thank-you?session=[session_token]&tx=[transaction_id]&origin=merchant-pos
```

## 🚨 Critical Debug Points

### **1. Same Account Issue**
The payment function prevents merchants from paying their own sessions:
```sql
IF v_session.merchant_user_id = v_buyer_user_id THEN
  RAISE EXCEPTION 'Merchant cannot pay own checkout';
END IF;
```

**Solution**: Always test with a different user account.

### **2. Session Status**
Session must be `open` to accept payment:
```sql
IF v_session.status <> 'open' THEN
  RAISE EXCEPTION 'Checkout session is not open';
END IF;
```

### **3. Session Expiration**
Dynamic sessions expire in 30 minutes, static in 24 hours:
```sql
IF v_session.expires_at < now() THEN
  UPDATE public.merchant_checkout_sessions
  SET status = 'expired'
  WHERE id = v_session.id;
  RAISE EXCEPTION 'Checkout session expired';
END IF;
```

### **4. Wallet Balance**
User must have sufficient balance:
```sql
IF v_sender_balance < v_wallet_amount THEN
  RAISE EXCEPTION 'Insufficient balance';
END IF;
```

## 🔧 Quick Fixes

### **Fix 1: Create Fresh Session**
If payment fails, create a new POS session.

### **Fix 2: Use Different Account**
Always use a separate user account for testing payments.

### **Fix 3: Check Console Logs**
Monitor browser console for detailed error messages.

### **Fix 4: Verify Database**
Check the three key tables for proper records.

### **Fix 5: Test Payment Function**
Use the "Test Payment" button to isolate issues.

## 📊 Expected Flow

1. **Create Session** → `merchant_checkout_sessions.status = 'open'`
2. **Process Payment** → `merchant_payments.status = 'succeeded'`
3. **Update Session** → `merchant_checkout_sessions.status = 'paid'`
4. **Create Transaction** → `transactions.status = 'completed'`
5. **Detect Payment** → POS polling finds status change
6. **Redirect** → Thank you page with transaction details

## 🎯 Success Indicators

- ✅ Console shows "Payment detected as successful!"
- ✅ Status changes to "Payment Successful"
- ✅ Redirect to thank you page
- ✅ Dashboard shows updated totals
- ✅ Transaction appears in history

---

**Follow this guide step-by-step to identify and resolve any POS payment issues!** 🚀
