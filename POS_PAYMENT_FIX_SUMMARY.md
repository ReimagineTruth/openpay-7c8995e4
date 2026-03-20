# POS Payment Double Crediting Fix

## Problem
The POS payment system was causing double crediting issues where:
1. Users were receiving more than the exact payment amount
2. Payments were being credited to both merchant balance system and potentially other places
3. The exact amount wasn't being properly controlled

## Root Cause
The current POS payment function `process_pos_payment_wallet` was:
- Only creating transaction records without proper balance transfers
- Using the merchant balance system instead of direct wallet crediting
- Not ensuring exact amount control

## Solution
Created a new migration `20260320060000_fix_pos_payment_double_crediting.sql` that:

### Key Changes:
1. **Direct Wallet Crediting**: POS payments now credit directly to the merchant's wallet instead of the merchant balance system
2. **Exact Amount Control**: Only the net amount (total - fee) is credited to the merchant wallet
3. **Full Amount Deduction**: The full amount (including fee) is deducted from the payer's wallet
4. **Proper Balance Locking**: Uses `FOR UPDATE` to prevent race conditions
5. **Clear Transaction Records**: Creates proper audit trail with metadata

### Balance Flow:
- **Payer Wallet**: `-total_amount` (full amount including fee)
- **Merchant Wallet**: `+net_amount` (total_amount - fee_amount)
- **Fee**: Handled by the system (not credited to anyone)

### Safety Features:
- Wallet balance validation before processing
- Sufficient balance checks
- Proper error handling
- Transaction atomicity
- Clear status tracking

## Migration Details
The migration:
1. Drops the existing `process_pos_payment_wallet` function
2. Recreates it with proper wallet handling
3. Grants appropriate permissions
4. Includes explanatory comments

## Expected Results
After applying this fix:
- ✅ POS payments will credit only the exact net amount to merchant wallet
- ✅ No more double crediting issues
- ✅ Proper balance control and audit trail
- ✅ Users receive exactly what they should (no more, no less)

## Testing Recommended
1. Test POS payment with various amounts
2. Verify merchant wallet receives exact net amount
3. Verify payer wallet is deducted full amount
4. Check transaction records are correct
5. Test edge cases (insufficient balance, etc.)

## Files Modified
- `supabase/migrations/20260320060000_fix_pos_payment_double_crediting.sql` (new)

## Next Steps
1. Apply the migration using `supabase db push` or manual database update
2. Test the POS payment functionality
3. Monitor for any balance discrepancies
4. Verify merchant dashboard shows correct amounts
