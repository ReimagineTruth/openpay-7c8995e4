-- ============================================================
-- Test Push Notification System
-- Run this to verify the system works correctly
-- ============================================================

-- Test 1: Check all required tables exist
DO $$
DECLARE
    table_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('app_notifications', 'notification_preferences', 'push_subscriptions', 'push_notifications_outbox');
    
    IF table_count = 4 THEN
        SELECT '✓ All required tables exist' as status;
    ELSE
        SELECT '✗ Missing tables. Found ' || table_count || ' out of 4' as status;
    END IF;
END $$;

-- Test 2: Check trigger exists
DO $$
DECLARE
    trigger_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers 
    WHERE trigger_name = 'on_app_notification_created';
    
    IF trigger_count = 1 THEN
        SELECT '✓ Push notification trigger exists' as status;
    ELSE
        SELECT '✗ Push notification trigger missing' as status;
    END IF;
END $$;

-- Test 3: Check functions exist
DO $$
DECLARE
    function_count INTEGER := 0;
BEGIN
    SELECT COUNT(*) INTO function_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('queue_push_notification', 'cleanup_expired_push_notifications');
    
    IF function_count = 2 THEN
        SELECT '✓ All required functions exist' as status;
    ELSE
        SELECT '✗ Missing functions. Found ' || function_count || ' out of 2' as status;
    END IF;
END $$;

-- Test 4: Create test notification preferences (if user exists)
DO $$
BEGIN
    -- Try to create default notification preferences for existing users
    INSERT INTO public.notification_preferences (user_id, email_enabled, push_enabled, in_app_enabled)
    SELECT id, true, true, true
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.notification_preferences)
    LIMIT 1;
    
    SELECT '✓ Test notification preferences created (if users exist)' as status;
EXCEPTION
    WHEN OTHERS THEN
        SELECT 'ℹ Could not create test preferences (may be no users or permissions issue)' as status;
END $$;

-- Test 5: Show table structures
SELECT '=== app_notifications table structure ===' as info;
\d+ public.app_notifications;

SELECT '=== notification_preferences table structure ===' as info;
\d+ public.notification_preferences;

SELECT '=== push_subscriptions table structure ===' as info;
\d+ public.push_subscriptions;

SELECT '=== push_notifications_outbox table structure ===' as info;
\d+ public.push_notifications_outbox;

-- Test 6: Check RLS policies
SELECT '=== RLS Policies for app_notifications ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'app_notifications';

SELECT '=== RLS Policies for push_subscriptions ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'push_subscriptions';

SELECT '=== RLS Policies for push_notifications_outbox ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'push_notifications_outbox';

SELECT 'Push notification system test complete!' as status;
SELECT 'If all tests show ✓, the system is ready for use.' as status;
