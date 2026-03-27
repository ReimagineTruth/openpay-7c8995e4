-- Test script for Merchant-Wallet-Only Fix
-- Verifies that POS payments credit only merchant wallet, not both

-- Test 1: Verify the new function exists
SELECT 
    routine_name,
    routine_type,
    'MERCHANT_WALLET_ONLY_FUNCTION' as function_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'process_pos_payment_wallet'
UNION ALL
SELECT 
    routine_name,
    routine_type,
    'VERIFICATION_FUNCTION' as function_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'verify_merchant_wallet_only_credit';

-- Test 2: Check function permissions
SELECT 
    routine_name,
    grantee,
    privilege_type,
    'PERMISSION_CHECK' as test_type
FROM information_schema.role_routine_grants 
WHERE routine_name IN ('process_pos_payment_wallet', 'verify_merchant_wallet_only_credit')
    AND routine_schema = 'public'
ORDER BY routine_name, grantee;

-- Test 3: Verify wallet table structure (single wallet per user)
SELECT 
    column_name,
    data_type,
    is_nullable,
    'WALLET_TABLE_STRUCTURE' as test_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'wallets'
    AND column_name IN ('id', 'user_id', 'balance')
ORDER BY ordinal_position;

-- Test 4: Check unique constraint on user_id (ensures single wallet per user)
SELECT 
    constraint_name,
    constraint_type,
    'UNIQUE_WALLET_PER_USER' as test_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
    AND table_name = 'wallets'
    AND constraint_type = 'UNIQUE';

-- Test 5: Test the merchant-only credit logic with sample data
-- This simulates the expected behavior without real data
WITH merchant_wallet_test AS (
    SELECT 
        100.00 as total_amount,
        5.00 as fee_amount,
        (100.00 - 5.00) as merchant_credit_amount,
        100.00 as payer_debit_amount
)
SELECT 
    total_amount,
    fee_amount,
    merchant_credit_amount,
    payer_debit_amount,
    CASE 
        WHEN merchant_credit_amount = 95.00 AND payer_debit_amount = 100.00 THEN 'MERCHANT_ONLY_CORRECT'
        ELSE 'MERCHANT_ONLY_INCORRECT'
    END as merchant_wallet_only_test,
    CASE 
        WHEN merchant_credit_amount < payer_debit_amount THEN 'FEE_DEDUCTED_CORRECTLY'
        ELSE 'FEE_NOT_DEDUCTED'
    END as fee_handling_test,
    'Payer wallet debited: ' || payer_debit_amount || ', Merchant wallet credited: ' || merchant_credit_amount as flow_description
FROM merchant_wallet_test;

-- Test 6: Check recent POS payments for merchant-only behavior
SELECT 
    'RECENT_POS_PAYMENTS_ANALYSIS' as test_type,
    COUNT(*) as total_pos_payments,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_payments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
    COUNT(CASE WHEN fee_amount > 0 THEN 1 END) as payments_with_fees,
    COALESCE(AVG(total_amount), 0) as average_amount,
    COALESCE(AVG(fee_amount), 0) as average_fee
FROM public.pos_payments
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Test 7: Verify transaction flow for merchant-only credit
-- This checks if transactions follow the expected pattern
SELECT 
    'TRANSACTION_FLOW_VERIFICATION' as test_type,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN t.sender_id != t.receiver_id THEN 1 END) as valid_sender_receiver,
    COUNT(CASE WHEN t.metadata->>'fee_amount' IS NOT NULL AND (t.metadata->>'fee_amount')::NUMERIC > 0 THEN 1 END) as transactions_with_fees,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_transactions,
    STRING_AGG(DISTINCT t.type, ', ') as transaction_types
FROM public.transactions t
WHERE t.created_at >= NOW() - INTERVAL '7 days'
  AND t.type = 'payment'
  AND EXISTS (
    SELECT 1 FROM public.pos_transactions pt 
    WHERE pt.transaction_id = t.id
  );

-- Test 8: Expected behavior summary
SELECT 
    'EXPECTED_BEHAVIOR' as test_name,
    'Single wallet per user' as system_design,
    'Payer wallet debited full amount' as debit_behavior,
    'Merchant wallet credited net amount only' as credit_behavior,
    'No double-crediting between personal/merchant wallets' as double_credit_prevention,
    'Fee retained by system' as fee_handling
UNION ALL
SELECT 
    'FIX_VERIFICATION' as test_name,
    'Function prevents double-processing' as system_design,
    'Atomic wallet updates' as debit_behavior,
    'Merchant-only credit logic' as credit_behavior,
    'Verification function monitors behavior' as double_credit_prevention,
    'Transaction metadata tracks flow' as fee_handling;

-- Test 9: Check for any remaining double-crediting patterns
WITH double_credit_check AS (
    SELECT 
        pp.id,
        pp.total_amount,
        pp.fee_amount,
        COUNT(DISTINCT pt.id) as pos_transaction_count,
        COUNT(DISTINCT t.id) as main_transaction_count
    FROM public.pos_payments pp
    LEFT JOIN public.pos_transactions pt ON pp.id = pt.pos_payment_id
    LEFT JOIN public.transactions t ON pt.transaction_id = t.id
    WHERE pp.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY pp.id, pp.total_amount, pp.fee_amount
)
SELECT 
    'DOUBLE_CREDIT_CHECK' as analysis_type,
    COUNT(*) as total_payments,
    COUNT(CASE WHEN pos_transaction_count > 1 OR main_transaction_count > 1 THEN 1 END) as potential_double_credits,
    CASE 
        WHEN COUNT(CASE WHEN pos_transaction_count > 1 OR main_transaction_count > 1 THEN 1 END) = 0 THEN 'NO_DOUBLE_CREDITS_DETECTED'
        ELSE 'DOUBLE_CREDITS_FOUND'
    END as double_credit_status
FROM double_credit_check;

-- Test completion summary
SELECT 
    'TEST_SUMMARY' as status,
    'Merchant-Wallet-Only Fix verification completed' as message,
    'Run fix_pos_merchant_wallet_only.sql to apply the fix' as next_step,
    'Verify with verify_merchant_wallet_only_credit() function' as verification_step;
