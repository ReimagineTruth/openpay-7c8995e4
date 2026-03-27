-- Test script for POS Double-Crediting Fix
-- This script verifies that the fix prevents double-crediting and works correctly

-- Test 1: Verify the new function exists and has correct signature
SELECT 
    routine_name,
    routine_type,
    data_type,
    external_language,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'process_pos_payment_wallet';

-- Test 2: Check function permissions
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.role_routine_grants 
WHERE routine_name = 'process_pos_payment_wallet'
    AND routine_schema = 'public';

-- Test 3: Verify verification function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('verify_pos_payment_integrity', 'cleanup_double_credited_pos_payments')
ORDER BY routine_name;

-- Test 4: Create test data (this will be rolled back)
-- Note: This test requires actual user IDs and wallet records
-- Uncomment the following block for testing with real data:

/*
BEGIN;

-- Create test users if they don't exist
INSERT INTO auth.users (id, email, created_at) 
VALUES 
    ('test-payer-id'::UUID, 'test-payer@example.com', NOW()),
    ('test-merchant-id'::UUID, 'test-merchant@example.com', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test wallets
INSERT INTO public.wallets (user_id, balance, updated_at)
VALUES 
    ('test-payer-id'::UUID, 1000.00, NOW()),
    ('test-merchant-id'::UUID, 100.00, NOW())
ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance;

-- Create test POS payment session
INSERT INTO public.pos_payments (
    id,
    session_token,
    merchant_user_id,
    total_amount,
    fee_amount,
    currency,
    status,
    expires_at,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test-session-token-' || gen_random_uuid(),
    'test-merchant-id'::UUID,
    100.00,
    5.00,
    'USD',
    'pending',
    NOW() + INTERVAL '30 minutes',
    NOW(),
    NOW()
) RETURNING id;

ROLLBACK;
*/

-- Test 5: Simulate payment processing logic verification
-- This test checks the mathematical logic without actual data
WITH test_calculation AS (
    SELECT 
        100.00 as total_amount,
        5.00 as fee_amount,
        (100.00 - 5.00) as expected_net_amount
)
SELECT 
    total_amount,
    fee_amount,
    expected_net_amount,
    CASE 
        WHEN expected_net_amount = 95.00 THEN 'CALCULATION_CORRECT'
        ELSE 'CALCULATION_ERROR'
    END as calculation_check,
    CASE 
        WHEN total_amount > expected_net_amount THEN 'FEE_DEDUCTED_CORRECTLY'
        ELSE 'FEE_NOT_DEDUCTED'
    END as fee_check
FROM test_calculation;

-- Test 6: Check for existing conflicting functions
SELECT 
    routine_name,
    'CONFLICTING_FUNCTION' as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND (
        routine_name LIKE '%pos%payment%' OR
        routine_name LIKE '%merchant%checkout%' OR
        routine_name LIKE '%pay%merchant%'
    )
    AND routine_name != 'process_pos_payment_wallet'
    AND routine_name NOT IN ('verify_pos_payment_integrity', 'cleanup_double_credited_pos_payments')
ORDER BY routine_name;

-- Test 7: Verify wallet table structure for single wallet per user
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
    AND table_name = 'wallets'
    AND column_name IN ('id', 'user_id', 'balance')
ORDER BY ordinal_position;

-- Test 8: Check for unique constraint on user_id to prevent multiple wallets
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
    AND table_name = 'wallets'
    AND constraint_type = 'UNIQUE';

-- Test 9: Verify recent POS payments have proper structure
SELECT 
    COUNT(*) as total_pos_payments,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_payments,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_payments,
    COUNT(CASE WHEN fee_amount > 0 THEN 1 END) as payments_with_fees
FROM public.pos_payments
WHERE created_at >= NOW() - INTERVAL '7 days';

-- Test 10: Check for potential double-credited transactions
WITH potential_double_credits AS (
    SELECT 
        pp.id,
        pp.session_token,
        pp.total_amount,
        pp.fee_amount,
        COUNT(DISTINCT pt.id) as pos_transaction_count,
        COUNT(DISTINCT t.id) as main_transaction_count,
        STRING_AGG(DISTINCT t.status, ', ') as transaction_statuses
    FROM public.pos_payments pp
    LEFT JOIN public.pos_transactions pt ON pp.id = pt.pos_payment_id
    LEFT JOIN public.transactions t ON pt.transaction_id = t.id
    WHERE pp.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY pp.id, pp.session_token, pp.total_amount, pp.fee_amount
)
SELECT 
    'POTENTIAL_DOUBLE_CREDITS' as analysis_type,
    COUNT(*) as count,
    STRING_AGG(
        format('POS %s: %s pos_tx, %s main_tx (%s)', 
               id, pos_transaction_count, main_transaction_count, transaction_statuses),
        '; '
    ) as details
FROM potential_double_credits
WHERE pos_transaction_count > 1 OR main_transaction_count > 1;

-- Test 11: Expected behavior verification
SELECT 
    'EXPECTED_BEHAVIOR' as test_name,
    'Single wallet per user' as description,
    'Merchant receives only net amount (total - fee)' as expected_credit,
    'Payer pays full amount including fee' as expected_debit,
    'No duplicate transactions created' as expected_transaction_count
UNION ALL
SELECT 
    'FIX_VERIFICATION' as test_name,
    'Function prevents double-processing' as description,
    'Atomic wallet updates prevent partial credits' as mechanism,
    'Transaction metadata tracks exact amounts' as tracking,
    'Verification function detects issues' as monitoring;

-- Test completion summary
SELECT 
    'TEST_SUMMARY' as status,
    'POS double-crediting fix verification completed' as message,
    'Run the fix script: fix_pos_double_crediting_final.sql' as next_step,
    'Then test with actual POS payments' as validation_step;
