-- ============================================================
-- Fix Push Notification Tables - Handle Existing Policies
-- ============================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role can manage push notifications outbox" ON public.push_notifications_outbox;

-- Recreate RLS Policies for push_subscriptions
CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Recreate RLS Policies for push_notifications_outbox
CREATE POLICY "Service role can manage push notifications outbox" ON public.push_notifications_outbox
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Verify tables exist
SELECT 'push_subscriptions table exists' as status FROM information_schema.tables 
WHERE table_name = 'push_subscriptions' AND table_schema = 'public';

SELECT 'push_notifications_outbox table exists' as status FROM information_schema.tables 
WHERE table_name = 'push_notifications_outbox' AND table_schema = 'public';
