-- DEPLOYMENT SCRIPT: Fix push_subscriptions table
-- 
-- INSTRUCTIONS:
-- 1. Run this script in Supabase SQL Editor
-- 2. Deploy the push-subscriptions function using Supabase CLI
-- 3. Test the push notification system
-- 
-- This script will:
-- - Create the push_subscriptions table with exact requirements
-- - Set up proper RLS policies
-- - Create helper functions for subscription management
-- - Add necessary indexes and permissions

-- First, ensure the table exists with correct schema
DO $$
BEGIN
  -- Drop existing table to ensure clean state
  DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
  
  -- Create table with exact requirements
  CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  
  -- Create performance indexes
  CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);
  CREATE INDEX idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);
  
  -- Enable RLS
  ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
  
  -- Create RLS policies
  CREATE POLICY "Users can view own push subscriptions" 
    ON public.push_subscriptions FOR SELECT 
    TO authenticated 
    USING (user_id = auth.uid() OR user_id IS NULL);
    
  CREATE POLICY "Users can insert own push subscriptions" 
    ON public.push_subscriptions FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
    
  CREATE POLICY "Users can update own push subscriptions" 
    ON public.push_subscriptions FOR UPDATE 
    TO authenticated 
    USING (user_id = auth.uid() OR user_id IS NULL)
    WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
    
  CREATE POLICY "Users can delete own push subscriptions" 
    ON public.push_subscriptions FOR DELETE 
    TO authenticated 
    USING (user_id = auth.uid() OR user_id IS NULL);
  
  -- Grant permissions
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;
  
  -- Add to realtime
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'push_subscriptions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions';
  END IF;
  
  RAISE NOTICE 'push_subscriptions table created successfully';
END $$;

-- Create helper functions for subscription management
CREATE OR REPLACE FUNCTION public.save_push_subscription(
  p_user_id UUID,
  p_endpoint TEXT,
  p_p256dh TEXT,
  p_auth TEXT,
  p_device TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_result JSON;
BEGIN
  -- Check if subscription already exists
  SELECT id INTO v_existing_id
  FROM public.push_subscriptions
  WHERE endpoint = p_endpoint;
  
  IF v_existing_id IS NOT NULL THEN
    -- Update existing subscription
    UPDATE public.push_subscriptions
    SET 
      user_id = COALESCE(p_user_id, user_id),
      p256dh = p_p256dh,
      auth = p_auth,
      device = p_device
    WHERE id = v_existing_id;
    
    v_result := json_build_object(
      'success', true,
      'message', 'Subscription updated successfully',
      'subscription_id', v_existing_id
    );
  ELSE
    -- Insert new subscription
    INSERT INTO public.push_subscriptions (
      user_id, endpoint, p256dh, auth, device
    ) VALUES (
      p_user_id, p_endpoint, p_p256dh, p_auth, p_device
    )
    RETURNING id INTO v_existing_id;
    
    v_result := json_build_object(
      'success', true,
      'message', 'Subscription created successfully',
      'subscription_id', v_existing_id
    );
  END IF;
  
  RETURN v_result;
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Subscription with this endpoint already exists'
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_push_subscription(
  p_endpoint TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.push_subscriptions
  WHERE endpoint = p_endpoint;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  IF v_deleted_count > 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'Subscription deleted successfully',
      'deleted_count', v_deleted_count
    );
  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Subscription not found'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_push_subscriptions(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
  v_subscriptions JSON;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User ID required'
    );
  END IF;
  
  SELECT json_agg(
    json_build_object(
      'id', id,
      'endpoint', endpoint,
      'device', device,
      'created_at', created_at
    )
  ) INTO v_subscriptions
  FROM public.push_subscriptions
  WHERE user_id = v_user_id;
  
  RETURN json_build_object(
    'success', true,
    'subscriptions', COALESCE(v_subscriptions, '[]'::json)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.save_push_subscription(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_push_subscription(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_push_subscriptions(UUID) TO authenticated, service_role;

-- Verification query
SELECT 
  'push_subscriptions table and functions created successfully!' as status,
  (SELECT COUNT(*) FROM public.push_subscriptions) as initial_count,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%push_subscription%') as function_count;
