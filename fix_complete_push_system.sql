-- ============================================================
-- Complete Push Notification System Fix
-- Run this script to create all missing tables and fix the database
-- ============================================================

-- First, check if app_notifications table exists and create it if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'app_notifications' AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.app_notifications (
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
    
    -- Indexes for app_notifications
    CREATE INDEX idx_app_notifications_user_read ON public.app_notifications(user_id, read);
    CREATE INDEX idx_app_notifications_created ON public.app_notifications(created_at DESC);
    CREATE INDEX idx_app_notifications_type ON public.app_notifications(type);
    
    -- Enable RLS
    ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies for app_notifications
    CREATE POLICY "Users can view their own notifications" ON public.app_notifications
      FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert their own notifications" ON public.app_notifications
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own notifications" ON public.app_notifications
      FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete their own notifications" ON public.app_notifications
      FOR DELETE USING (auth.uid() = user_id);
    
    -- Grant permissions
    GRANT ALL ON public.app_notifications TO authenticated;
    GRANT SELECT ON public.app_notifications TO service_role;
    
    -- Add to realtime publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.app_notifications;
  END IF;
END $$;

-- Check if notification_preferences table exists and create it if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'notification_preferences' AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.notification_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
      email_enabled BOOLEAN DEFAULT true,
      push_enabled BOOLEAN DEFAULT false,
      in_app_enabled BOOLEAN DEFAULT true,
      preferences JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    
    -- Enable RLS
    ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies for notification_preferences
    CREATE POLICY "Users can manage their own notification preferences" ON public.notification_preferences
      FOR ALL USING (auth.uid() = user_id);
    
    -- Grant permissions
    GRANT ALL ON public.notification_preferences TO authenticated;
  END IF;
END $$;

-- Create push_subscriptions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'push_subscriptions' AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.push_subscriptions (
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
    
    -- Indexes for performance
    CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
    
    -- Enable RLS
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies for push_subscriptions
    CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions
      FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
      FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
      FOR DELETE USING (auth.uid() = user_id);
    
    -- Grant permissions
    GRANT ALL ON public.push_subscriptions TO authenticated;
    
    -- Add to realtime publication
    ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
  END IF;
END $$;

-- Create push_notifications_outbox table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'push_notifications_outbox' AND table_schema = 'public'
  ) THEN
    CREATE TABLE public.push_notifications_outbox (
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
    
    -- Indexes for performance
    CREATE INDEX idx_push_notifications_outbox_user_status ON public.push_notifications_outbox(user_id, status);
    CREATE INDEX idx_push_notifications_outbox_created ON public.push_notifications_outbox(created_at);
    
    -- Enable RLS
    ALTER TABLE public.push_notifications_outbox ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies for push_notifications_outbox
    CREATE POLICY "Service role can manage push notifications outbox" ON public.push_notifications_outbox
      FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
    
    -- Grant permissions
    GRANT ALL ON public.push_notifications_outbox TO service_role;
  END IF;
END $$;

-- Create or replace the function to automatically queue push notifications
CREATE OR REPLACE FUNCTION public.queue_push_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue push notification if user has push enabled and has active subscriptions
  INSERT INTO public.push_notifications_outbox (user_id, notification_id, title, message, data)
  SELECT 
    NEW.user_id,
    NEW.id,
    NEW.title,
    NEW.message,
    NEW.metadata
  FROM public.notification_preferences np
  WHERE np.user_id = NEW.user_id 
    AND np.push_enabled = true
    AND EXISTS (
      SELECT 1 FROM public.push_subscriptions ps 
      WHERE ps.user_id = NEW.user_id
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically queue push notifications
DROP TRIGGER IF EXISTS on_app_notification_created ON public.app_notifications;
CREATE TRIGGER on_app_notification_created
  AFTER INSERT ON public.app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_push_notification();

-- Create function to clean up expired push notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_push_notifications()
RETURNS void AS $$
BEGIN
  UPDATE public.push_notifications_outbox 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for functions
GRANT EXECUTE ON FUNCTION public.queue_push_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_push_notifications() TO service_role;

-- Verify all tables were created
SELECT 'app_notifications table exists' as status FROM information_schema.tables 
WHERE table_name = 'app_notifications' AND table_schema = 'public';

SELECT 'notification_preferences table exists' as status FROM information_schema.tables 
WHERE table_name = 'notification_preferences' AND table_schema = 'public';

SELECT 'push_subscriptions table exists' as status FROM information_schema.tables 
WHERE table_name = 'push_subscriptions' AND table_schema = 'public';

SELECT 'push_notifications_outbox table exists' as status FROM information_schema.tables 
WHERE table_name = 'push_notifications_outbox' AND table_schema = 'public';

-- Show final status
SELECT 'Push notification system setup complete!' as status;
SELECT 'Tables created: app_notifications, notification_preferences, push_subscriptions, push_notifications_outbox' as status;
SELECT 'Functions created: queue_push_notification, cleanup_expired_push_notifications' as status;
SELECT 'Triggers created: on_app_notification_created' as status;
