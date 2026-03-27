-- Verification script for POS double-crediting bug
-- This script checks if merchants are being credited twice for POS payments

-- Step 1: Check all POS payment related functions
SELECT 
    routine_name,
    routine_type,
    data_type,
    external_language
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name LIKE '%pos%'
    AND routine_name LIKE '%payment%'
ORDER BY routine_name;

-- Step 2: Check recent POS transactions to identify double-crediting patterns
WITH pos_payments_analysis AS (
    SELECT 
        pp.id as pos_payment_id,
        pp.session_token,
        pp.merchant_user_id,
        pp.total_amount,
        pp.fee_amount,
        pp.status as pos_status,
        pp.created_at,
        pt.id as pos_transaction_id,
        pt.transaction_id,
        pt.amount as pos_transaction_amount,
        pt.net_amount,
        pt.status as pos_transaction_status,
        t.sender_id,
        t.receiver_id,
        t.amount as main_transaction_amount,
        t.status as main_transaction_status,
        t.created_at as transaction_created_at
    FROM public.pos_payments pp
    LEFT JOIN public.pos_transactions pt ON pp.id = pt.pos_payment_id
    LEFT JOIN public.transactions t ON pt.transaction_id = t.id
    WHERE pp.created_at >= NOW() - INTERVAL '7 days'
    ORDER BY pp.created_at DESC
    LIMIT 20
)
SELECT 
    ppa.*,
    -- Check for double-crediting indicators
    CASE 
        WHEN ppa.pos_transaction_amount = ppa.main_transaction_amount THEN 'POTENTIAL_DOUBLE_CREDIT'
        WHEN ppa.net_amount = ppa.main_transaction_amount THEN 'NORMAL_SINGLE_CREDIT'
        ELSE 'UNKNOWN_PATTERN'
    END as credit_pattern,
    -- Calculate expected amounts
    ppa.total_amount - ppa.fee_amount as expected_net_amount,
    -- Verify if amounts match expectations
    CASE 
        WHEN ppa.net_amount = (ppa.total_amount - ppa.fee_amount) THEN 'NET_AMOUNT_CORRECT'
        ELSE 'NET_AMOUNT_INCORRECT'
    END as net_amount_check
FROM pos_payments_analysis ppa;

-- Step 3: Check wallet balance changes for merchants involved in POS transactions
WITH merchant_wallet_changes AS (
    SELECT 
        w.user_id as merchant_id,
        w.balance as current_balance,
        COUNT(mp.id) as total_pos_payments,
        COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN mp.amount ELSE 0 END), 0) as total_pos_amount,
        COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN mp.amount ELSE 0 END), 0) as total_net_amount
    FROM public.wallets w
    LEFT JOIN public.merchant_payments mp ON w.user_id = mp.merchant_user_id 
        AND mp.created_at >= NOW() - INTERVAL '7 days'
    WHERE EXISTS (
        SELECT 1 FROM public.pos_payments pp 
        WHERE pp.merchant_user_id = w.user_id 
        AND pp.created_at >= NOW() - INTERVAL '7 days'
    )
    GROUP BY w.user_id, w.balance
)
SELECT 
    mwc.*,
    -- Check if balance suggests double-crediting (using total amount as estimate)
    CASE 
        WHEN mwc.current_balance >= (mwc.total_pos_amount * 2) THEN 'POSSIBLE_DOUBLE_CREDITING'
        WHEN mwc.current_balance >= mwc.total_pos_amount THEN 'NORMAL_CREDITING'
        ELSE 'INSUFFICIENT_CREDITING'
    END as balance_analysis
FROM merchant_wallet_changes mwc;

-- Step 4: Check for duplicate transaction records for same POS session
SELECT 
    pp.session_token,
    pp.merchant_user_id,
    pp.total_amount,
    COUNT(DISTINCT pt.id) as pos_transaction_count,
    COUNT(DISTINCT t.id) as main_transaction_count,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as completed_transaction_count,
    STRING_AGG(DISTINCT t.status, ', ') as transaction_statuses
FROM public.pos_payments pp
LEFT JOIN public.pos_transactions pt ON pp.id = pt.pos_payment_id
LEFT JOIN public.transactions t ON pt.transaction_id = t.id
WHERE pp.created_at >= NOW() - INTERVAL '7 days'
GROUP BY pp.session_token, pp.merchant_user_id, pp.total_amount
HAVING COUNT(DISTINCT t.id) > 1 OR COUNT(DISTINCT pt.id) > 1;

-- Step 5: Verify current POS payment function exists and check its implementation
SELECT 
    routine_name,
    routine_definition IS NOT NULL as has_definition,
    external_language,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name = 'process_pos_payment_wallet';
 