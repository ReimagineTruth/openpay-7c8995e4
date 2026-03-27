-- Merchant Onboarding & POS Double-Crediting Analysis
-- This script analyzes the merchant onboarding process and identifies POS double-crediting issues

-- Step 1: Check merchant onboarding status and wallet setup
SELECT 
    'MERCHANT_ONBOARDING_ANALYSIS' as analysis_type,
    COUNT(DISTINCT u.id) as total_merchants,
    COUNT(DISTINCT w.user_id) as merchants_with_wallets,
    COUNT(DISTINCT CASE WHEN w.balance > 0 THEN w.user_id END) as merchants_with_balance,
    COUNT(DISTINCT mps.user_id) as merchant_profiles,
    COUNT(DISTINCT mak.merchant_user_id) as merchants_with_api_keys
FROM auth.users u
LEFT JOIN public.wallets w ON u.id = w.user_id
LEFT JOIN public.merchant_profiles mps ON u.id = mps.user_id
LEFT JOIN public.merchant_api_keys mak ON u.id = mak.merchant_user_id
WHERE EXISTS (
    SELECT 1 FROM public.merchant_checkout_sessions mcs 
    WHERE mcs.merchant_user_id = u.id
    OR EXISTS (SELECT 1 FROM public.merchant_payments mp2 WHERE mp2.merchant_user_id = u.id)
);

-- Step 2: Analyze POS payment flow and double-crediting patterns
WITH pos_payment_flow AS (
    SELECT 
        pp.id as pos_payment_id,
        pp.session_token,
        pp.merchant_user_id,
        pp.total_amount,
        pp.fee_amount,
        pp.status as pos_status,
        pp.created_at,
        -- Check if merchant checkout session exists
        mcs.id as checkout_session_id,
        mcs.status as checkout_status,
        -- Check if merchant payment record exists
        mp.id as merchant_payment_id,
        mp.status as merchant_payment_status,
        -- Check main transaction
        t.id as transaction_id,
        t.sender_id,
        t.receiver_id,
        t.amount as transaction_amount,
        t.status as transaction_status,
        -- Check wallet balance changes
        w_merchant.balance as merchant_wallet_balance,
        w_payer.balance as payer_wallet_balance
    FROM public.pos_payments pp
    LEFT JOIN public.merchant_checkout_sessions mcs ON pp.session_token = mcs.session_token
    LEFT JOIN public.merchant_payments mp ON mcs.id = mp.session_id
    LEFT JOIN public.transactions t ON mp.transaction_id = t.id
    LEFT JOIN public.wallets w_merchant ON pp.merchant_user_id = w_merchant.user_id
    LEFT JOIN public.wallets w_payer ON t.sender_id = w_payer.user_id
    WHERE pp.created_at >= NOW() - INTERVAL '7 days'
)
SELECT 
    'POS_PAYMENT_FLOW_ANALYSIS' as analysis_type,
    COUNT(*) as total_pos_payments,
    COUNT(CASE WHEN pos_status = 'paid' THEN 1 END) as paid_pos_payments,
    COUNT(CASE WHEN checkout_status = 'paid' THEN 1 END) as paid_checkout_sessions,
    COUNT(CASE WHEN merchant_payment_status = 'succeeded' THEN 1 END) as succeeded_merchant_payments,
    COUNT(CASE WHEN transaction_status = 'completed' THEN 1 END) as completed_transactions,
    COUNT(CASE WHEN merchant_wallet_balance > 0 THEN 1 END) as merchants_with_positive_balance,
    COUNT(CASE WHEN payer_wallet_balance > 0 THEN 1 END) as payers_with_positive_balance
FROM pos_payment_flow;

-- Step 3: Identify double-crediting patterns
WITH double_credit_analysis AS (
    SELECT 
        pp.merchant_user_id,
        pp.total_amount,
        pp.fee_amount,
        COUNT(DISTINCT pp.id) as pos_payment_count,
        COUNT(DISTINCT mp.id) as merchant_payment_count,
        COUNT(DISTINCT t.id) as transaction_count,
        COALESCE(SUM(mp.amount), 0) as total_merchant_payment_amount,
        COALESCE(SUM(t.amount), 0) as total_transaction_amount,
        w.balance as current_wallet_balance
    FROM public.pos_payments pp
    LEFT JOIN public.merchant_checkout_sessions mcs ON pp.session_token = mcs.session_token
    LEFT JOIN public.merchant_payments mp ON mcs.id = mp.session_id
    LEFT JOIN public.transactions t ON mp.transaction_id = t.id
    LEFT JOIN public.wallets w ON pp.merchant_user_id = w.user_id
    WHERE pp.created_at >= NOW() - INTERVAL '7 days'
    GROUP BY pp.merchant_user_id, pp.total_amount, pp.fee_amount, w.balance
)
SELECT 
    'DOUBLE_CREDITING_ANALYSIS' as analysis_type,
    COUNT(*) as merchants_analyzed,
    COUNT(CASE WHEN merchant_payment_count > 1 THEN 1 END) as merchants_with_multiple_payments,
    COUNT(CASE WHEN transaction_count > 1 THEN 1 END) as merchants_with_multiple_transactions,
    COUNT(CASE WHEN total_merchant_payment_amount > total_transaction_amount THEN 1 END) as merchants_with_overpayment,
    COUNT(CASE WHEN current_wallet_balance >= (total_merchant_payment_amount * 2) THEN 1 END) as potential_double_credited_merchants,
    AVG(current_wallet_balance) as average_merchant_balance
FROM double_credit_analysis;

-- Step 4: Check merchant wallet vs personal wallet confusion
-- Since the system uses one wallet per user, we need to verify the UI confusion
WITH merchant_wallet_confusion AS (
    SELECT 
        w.user_id,
        w.balance as wallet_balance,
        COUNT(DISTINCT CASE WHEN mps.user_id IS NOT NULL THEN 1 END) as has_merchant_profile,
        COUNT(DISTINCT CASE WHEN mcs.merchant_user_id = w.user_id THEN 1 END) as pos_payments_count,
        COUNT(DISTINCT CASE WHEN mp.merchant_user_id = w.user_id THEN 1 END) as merchant_payments_count,
        -- Calculate expected balance based on payments
        COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN mp.amount ELSE 0 END), 0) as expected_from_payments,
        -- Check if balance suggests double-crediting
        CASE 
            WHEN w.balance >= (COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN mp.amount ELSE 0 END), 0) * 2) 
            THEN 'POTENTIAL_DOUBLE_CREDITING'
            WHEN w.balance >= COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN mp.amount ELSE 0 END), 0)
            THEN 'NORMAL_CREDITING'
            ELSE 'INSUFFICIENT_CREDITING'
        END as credit_pattern
    FROM public.wallets w
    LEFT JOIN public.merchant_profiles mps ON w.user_id = mps.user_id
    LEFT JOIN public.pos_payments pp ON w.user_id = pp.merchant_user_id
    LEFT JOIN public.merchant_checkout_sessions mcs ON pp.id = mcs.id
    LEFT JOIN public.merchant_payments mp ON mcs.id = mp.session_id AND mp.status = 'succeeded'
    WHERE EXISTS (
        SELECT 1 FROM public.pos_payments pp2 
        WHERE pp2.merchant_user_id = w.user_id 
        AND pp2.created_at >= NOW() - INTERVAL '30 days'
    )
    GROUP BY w.user_id, w.balance
)
SELECT 
    'MERCHANT_WALLET_CONFUSION_ANALYSIS' as analysis_type,
    COUNT(*) as total_merchants,
    COUNT(CASE WHEN has_merchant_profile > 0 THEN 1 END) as with_merchant_profile,
    COUNT(CASE WHEN pos_payments_count > 0 THEN 1 END) as with_pos_payments,
    COUNT(CASE WHEN merchant_payments_count > 0 THEN 1 END) as with_merchant_payments,
    COUNT(CASE WHEN credit_pattern = 'POTENTIAL_DOUBLE_CREDITING' THEN 1 END) as potential_double_credited,
    COUNT(CASE WHEN credit_pattern = 'NORMAL_CREDITING' THEN 1 END) as normal_credited,
    COUNT(CASE WHEN credit_pattern = 'INSUFFICIENT_CREDITING' THEN 1 END) as insufficient_credited,
    SUM(wallet_balance) as total_wallet_balance,
    SUM(expected_from_payments) as total_expected_from_payments
FROM merchant_wallet_confusion;

-- Step 5: Verify merchant onboarding completion
SELECT 
    'MERCHANT_ONBOARDING_COMPLETION' as analysis_type,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN w.user_id IS NOT NULL THEN u.id END) as with_wallet,
    COUNT(DISTINCT CASE WHEN mp.user_id IS NOT NULL THEN u.id END) as with_merchant_profile,
    COUNT(DISTINCT CASE WHEN mak.merchant_user_id IS NOT NULL THEN u.id END) as with_api_keys,
    COUNT(DISTINCT CASE WHEN mcs.merchant_user_id IS NOT NULL THEN u.id END) as with_pos_sessions,
    COUNT(DISTINCT CASE WHEN mp2.merchant_user_id IS NOT NULL THEN u.id END) as with_payments,
    -- Calculate onboarding completion percentage
    ROUND(
        (COUNT(DISTINCT CASE WHEN w.user_id IS NOT NULL AND mp.user_id IS NOT NULL THEN u.id END) * 100.0) / 
        NULLIF(COUNT(DISTINCT u.id), 0), 2
    ) as onboarding_completion_percentage
FROM auth.users u
LEFT JOIN public.wallets w ON u.id = w.user_id
LEFT JOIN public.merchant_profiles mp ON u.id = mp.user_id
LEFT JOIN public.merchant_api_keys mak ON u.id = mak.merchant_user_id
LEFT JOIN public.merchant_checkout_sessions mcs ON u.id = mcs.merchant_user_id
LEFT JOIN public.merchant_payments mp2 ON u.id = mp2.merchant_user_id
WHERE u.created_at >= NOW() - INTERVAL '30 days';

-- Step 6: Root cause analysis for double-crediting
SELECT 
    'ROOT_CAUSE_ANALYSIS' as analysis_type,
    'RECOMMENDED_SOLUTION' as problem_type,
    'Fix POS payment to credit only merchant wallet once' as root_cause,
    'Use process_pos_payment_wallet function with merchant-only logic' as current_behavior,
    'Ensure atomic wallet updates: debit payer, credit merchant only' as double_credit_source,
    'Apply fix_pos_merchant_wallet_only.sql' as required_fix;

-- Step 7: Action items
SELECT 
    'ACTION_ITEMS' as analysis_type,
    '1. Apply merchant-wallet-only fix' as immediate_action,
    '2. Run verify_pos_double_crediting_bug.sql' as verification_step,
    '3. Test with sample POS payment' as testing_step,
    '4. Monitor for double-crediting patterns' as monitoring_step,
    '5. Update merchant onboarding to clarify wallet structure' as documentation_step
UNION ALL
SELECT 
    'EXPECTED_OUTCOME' as analysis_type,
    'Merchants receive payments only once' as immediate_action,
    'No confusion between personal/merchant wallets' as verification_step,
    'Clear payment flow: payer → merchant only' as testing_step,
    'Accurate wallet balance tracking' as monitoring_step,
    'Better merchant onboarding experience' as documentation_step;
