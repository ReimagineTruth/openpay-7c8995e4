-- Test script to verify double crediting fix
-- This script tests that payments are only credited to merchant wallet once

-- Test 1: Verify merchant wallet crediting function
SELECT 
  'Testing merchant wallet verification function...' as test_step;

-- Test the verification function (will return empty if no user is authenticated)
SELECT * FROM public.verify_merchant_wallet_crediting() LIMIT 1;

-- Test 2: Check if functions exist and are properly defined
SELECT 
  'Checking if fixed functions exist...' as test_step;

-- Check virtual card payment function
SELECT 
  proname as function_name,
  pronargs as argument_count
FROM pg_proc 
WHERE proname = 'pay_merchant_checkout_with_virtual_card'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY pronargs DESC;

-- Check public virtual card payment function  
SELECT 
  proname as function_name,
  pronargs as argument_count
FROM pg_proc 
WHERE proname = 'pay_merchant_checkout_public_virtual_card'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Test 3: Verify function permissions
SELECT 
  'Checking function permissions...' as test_step;

SELECT 
  proname as function_name,
  array_to_string(aclexplode(proacl), ', ') as permissions
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN ('pay_merchant_checkout_with_virtual_card', 'pay_merchant_checkout_public_virtual_card', 'verify_merchant_wallet_crediting');

-- Test 4: Check for any remaining settlement wallet references
SELECT 
  'Checking for settlement wallet references...' as test_step;

SELECT 
  proname as function_name,
  prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname LIKE '%checkout%'
  AND prosrc ILIKE '%settlement%'
  AND prosrc ILIKE '%wallet%';

-- Test 5: Sample merchant wallet balance check
SELECT 
  'Sample merchant wallet balance check...' as test_step;

-- This will show current merchant wallet balances (if any)
SELECT 
  w.user_id,
  w.balance as current_balance,
  mp.merchant_user_id,
  COALESCE(SUM(mp.amount), 0) as total_received
FROM wallets w
LEFT JOIN merchant_payments mp ON w.user_id = mp.merchant_user_id AND mp.status = 'succeeded'
WHERE w.user_id IN (SELECT DISTINCT merchant_user_id FROM merchant_payments LIMIT 5)
GROUP BY w.user_id, w.balance, mp.merchant_user_id
LIMIT 3;

-- Test completion message
SELECT 
  'Double crediting fix test completed. Review results above.' as final_status;
