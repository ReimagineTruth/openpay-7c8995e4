-- ============================================================
-- Push Notifications Database Setup
-- Adds tables needed for mobile push notifications
-- ============================================================

-- 1. push_subscriptions - Store user push subscription tokens
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

-- 2. push_notifications_outbox - Queue for push notifications to be sent
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_notifications_outbox_user_status ON public.push_notifications_outbox(user_id, status);
CREATE INDEX IF NOT EXISTS idx_push_notifications_outbox_created ON public.push_notifications_outbox(created_at);

-- Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications_outbox ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_subscriptions
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view their own push subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for push_notifications_outbox
DROP POLICY IF EXISTS "Service role can manage push notifications outbox" ON public.push_notifications_outbox;
CREATE POLICY "Service role can manage push notifications outbox" ON public.push_notifications_outbox
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to automatically queue push notifications when app notifications are created
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

-- Trigger to automatically queue push notifications
DROP TRIGGER IF EXISTS on_app_notification_created ON public.app_notifications;
CREATE TRIGGER on_app_notification_created
  AFTER INSERT ON public.app_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_push_notification();

-- Function to clean up expired push notifications
CREATE OR REPLACE FUNCTION public.cleanup_expired_push_notifications()
RETURNS void AS $$
BEGIN
  UPDATE public.push_notifications_outbox 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_notifications_outbox TO service_role;
GRANT EXECUTE ON FUNCTION public.queue_push_notification() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_push_notifications() TO service_role;

-- Add realtime for push subscriptions (so users can manage their subscriptions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'push_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
  END IF;
END $$;
