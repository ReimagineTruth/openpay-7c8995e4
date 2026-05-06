-- ============================================================
-- Create Missing Push Notification Tables
-- Simple script to fix the missing push_subscriptions table
-- ============================================================

-- Create push_subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Create push_notifications_outbox table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.push_notifications_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES public.app_notifications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create app_notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'transaction', 'mining', 'stake', 'support')),
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create notification_preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT false,
  in_app_enabled BOOLEAN DEFAULT true,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_outbox_user_status ON public.push_notifications_outbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_outbox_created ON public.push_notifications_outbox(created_at);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_read ON public.app_notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_app_notifications_created ON public.app_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_type ON public.app_notifications(type);

-- Enable Row Level Security
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for push_subscriptions
CREATE POLICY IF NOT EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for push_notifications_outbox
CREATE POLICY IF NOT EXISTS "Service role can manage push notifications outbox" ON public.push_notifications_outbox
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create RLS Policies for app_notifications
CREATE POLICY IF NOT EXISTS "Users can view their own notifications" ON public.app_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own notifications" ON public.app_notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own notifications" ON public.app_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own notifications" ON public.app_notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for notification_preferences
CREATE POLICY IF NOT EXISTS "Users can manage their own notification preferences" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_notifications_outbox TO service_role;
GRANT ALL ON public.app_notifications TO authenticated;
GRANT ALL ON public.notification_preferences TO authenticated;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;

-- Verify tables were created
SELECT 'push_subscriptions table created successfully' as status;
SELECT 'push_notifications_outbox table created successfully' as status;
SELECT 'app_notifications table created successfully' as status;
SELECT 'notification_preferences table created successfully' as status;
