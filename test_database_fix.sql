-- ===============================================================
-- Simple Database Fix Test
-- Run this after applying the diagnosis and fix script
-- ===============================================================

-- Test 1: Verify tables exist
SELECT 'TABLES_EXIST' as test_result,
       CASE 
           WHEN COUNT(*) = 3 THEN '✅ ALL TABLES EXIST'
           ELSE '❌ MISSING TABLES'
       END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('merchant_products', 'merchant_checkout_sessions', 'merchant_payments');

-- Test 2: Verify functions exist
SELECT 'FUNCTIONS_EXIST' as test_result,
       CASE 
           WHEN COUNT(*) = 2 THEN '✅ ALL FUNCTIONS EXIST'
           ELSE '❌ MISSING FUNCTIONS'
       END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('upsert_merchant_product', 'create_merchant_checkout_session');

-- Test 3: Test upsert_merchant_product function
SELECT 'PRODUCT_FUNCTION_TEST' as test_result,
       success,
       message
FROM public.upsert_merchant_product(
    'TEST_001',
    'Test Product',
    'Test Description',
    10.00,
    'USD',
    true,
    ARRAY['test'],
    ARRAY['https://example.com/image.jpg'],
    'Test checkout info',
    '{"test": true}',
    'one_time',
    NULL,
    NULL,
    'digital_goods',
    false
);

-- Test 4: Test create_merchant_checkout_session function
SELECT 'CHECKOUT_FUNCTION_TEST' as test_result,
       success,
       message,
       session_token,
       total_amount,
       currency
FROM public.create_merchant_checkout_session(
    'test_key',
    'sandbox',
    'USD',
    '[{"amount": 10.00, "product_id": "00000000-0000-0000-0000-000000000000"}]'::jsonb,
    'Test Customer',
    'test@example.com',
    NULL,
    NULL,
    '{}'::jsonb,
    30
);

-- Test 5: Check permissions
SELECT 'PERMISSIONS_CHECK' as test_result,
       table_name,
       privilege_type,
       grantee
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('merchant_products', 'merchant_checkout_sessions')
  AND grantee IN ('authenticated', 'anon')
ORDER BY table_name, grantee, privilege_type;

-- Test 6: Check RLS policies
SELECT 'RLS_POLICIES_CHECK' as test_result,
       tablename,
       policyname,
       permissive
FROM pg_policies
WHERE tablename IN ('merchant_products', 'merchant_checkout_sessions')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Test 7: Final summary
DO $$
DECLARE
    v_status TEXT := '🟢 READY';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'merchant_products') THEN
        v_status := '🔴 NOT READY - Missing tables';
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'upsert_merchant_product') THEN
        v_status := '🔴 NOT READY - Missing functions';
    ELSE
        v_status := '🟢 READY FOR TESTING';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'DATABASE TEST RESULTS';
    RAISE NOTICE '==============================================================';
    RAISE NOTICE 'Status: %', v_status;
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test product creation in frontend';
    RAISE NOTICE '2. Test checkout session generation';
    RAISE NOTICE '3. Verify payment processing';
    RAISE NOTICE '';
    RAISE NOTICE 'If all tests pass, your database is ready!';
    RAISE NOTICE '==============================================================';
END $$;
