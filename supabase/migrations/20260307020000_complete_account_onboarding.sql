-- Complete Account Onboarding Database Schema
-- Supports the "Complete your account" screen with profile image, full name, username, and security PIN

-- Add profile image and security PIN fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS security_pin_hash TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Create trigger to update updated_at timestamp on profiles
CREATE OR REPLACE FUNCTION public.update_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profiles_updated_at();

-- First, let's see what usernames exist and identify problematic ones
-- Clean up existing invalid usernames before adding constraint
UPDATE public.profiles 
SET username = CASE 
  WHEN username IS NULL OR username = '' THEN 'openpay_user_' || LEFT(id::text, 8)
  WHEN username !~ '^[a-zA-Z0-9_]{3,20}$' THEN 'openpay_user_' || LEFT(id::text, 8)
  WHEN LENGTH(username) < 3 THEN 'openpay_user_' || LEFT(id::text, 8)
  WHEN LENGTH(username) > 20 THEN 'openpay_user_' || LEFT(id::text, 8)
  ELSE username
END;

-- Ensure all usernames are unique after cleanup
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Check for duplicates and make them unique
  LOOP
    SELECT COUNT(*) INTO v_count
    FROM (
      SELECT username, COUNT(*) as cnt
      FROM public.profiles
      WHERE username IS NOT NULL
      GROUP BY username
      HAVING COUNT(*) > 1
    ) dup;
    
    EXIT WHEN v_count = 0;
    
    -- Fix duplicates by appending counter
    UPDATE public.profiles p1
    SET username = p1.username || '_' || ROW_NUMBER() OVER (PARTITION BY p1.username ORDER BY p1.id)
    WHERE p1.ctid IN (
      SELECT ctid
      FROM (
        SELECT ctid, username, ROW_NUMBER() OVER (PARTITION BY username ORDER BY id) as rn
        FROM public.profiles
        WHERE username IS NOT NULL
      ) ranked
      WHERE rn > 1
    );
  END LOOP;
END $$;

-- Add constraint as NOT VALID first to identify problematic rows
ALTER TABLE public.profiles 
ADD CONSTRAINT username_format 
CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$') NOT VALID;

-- Try to validate the constraint to see what fails
-- This will show us exactly which rows violate the constraint
DO $$
DECLARE
  v_username TEXT;
  v_user_id UUID;
BEGIN
  -- Find and fix any remaining problematic usernames
  FOR v_username, v_user_id IN 
    SELECT username, id 
    FROM public.profiles 
    WHERE username IS NULL 
       OR username !~ '^[a-zA-Z0-9_]{3,20}$'
       OR LENGTH(username) < 3
       OR LENGTH(username) > 20
  LOOP
    RAISE NOTICE 'Fixing invalid username: % for user: %', v_username, v_user_id;
    UPDATE public.profiles 
    SET username = 'openpay_user_' || LEFT(id::text, 8)
    WHERE id = v_user_id;
  END LOOP;
END $$;

-- Now validate the constraint
ALTER TABLE public.profiles VALIDATE CONSTRAINT username_format;

-- Enhanced user_preferences table for onboarding tracking
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS profile_image_uploaded BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS security_pin_set BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create onboarding_steps table for detailed tracking
CREATE TABLE IF NOT EXISTS public.onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  data JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, step_name)
);

ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Create trigger for onboarding_steps updated_at
CREATE OR REPLACE FUNCTION public.update_onboarding_steps_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.completed AND NOT OLD.completed THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_steps_updated_at ON public.onboarding_steps;
CREATE TRIGGER trg_onboarding_steps_updated_at
BEFORE UPDATE ON public.onboarding_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_onboarding_steps_updated_at();

-- Function to complete onboarding step with validation
CREATE OR REPLACE FUNCTION public.complete_account_onboarding(
  p_full_name TEXT,
  p_username TEXT,
  p_profile_image_url TEXT DEFAULT NULL,
  p_security_pin TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  onboarding_step INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_step INTEGER;
  v_username_exists BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate username format
  IF p_username IS NOT NULL AND p_username !~ '^[a-zA-Z0-9_]{3,20}$' THEN
    RETURN QUERY SELECT false, 'Username must be 3-20 characters using letters, numbers, or underscore', 0;
    RETURN;
  END IF;

  -- Check if username already exists (excluding current user)
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = p_username AND id != v_user_id)
  INTO v_username_exists;

  IF v_username_exists THEN
    RETURN QUERY SELECT false, 'Username is already taken', 0;
    RETURN;
  END IF;

  -- Update profile with account completion data
  UPDATE public.profiles
  SET 
    full_name = COALESCE(p_full_name, full_name),
    username = COALESCE(p_username, username),
    profile_image_url = COALESCE(p_profile_image_url, profile_image_url),
    security_pin_hash = CASE 
      WHEN p_security_pin IS NOT NULL THEN crypt(p_security_pin, gen_salt('bf'))
      ELSE security_pin_hash
    END,
    updated_at = now()
  WHERE id = v_user_id;

  -- Update user_preferences
  UPDATE public.user_preferences
  SET 
    profile_full_name = COALESCE(p_full_name, profile_full_name),
    profile_username = COALESCE(p_username, profile_username),
    profile_image_uploaded = COALESCE(p_profile_image_url IS NOT NULL, profile_image_uploaded),
    security_pin_set = COALESCE(p_security_pin IS NOT NULL, security_pin_set),
    onboarding_step = 5,
    onboarding_completed = true,
    onboarding_completed_at = now(),
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Insert onboarding step completion
  INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed, data)
  VALUES 
    (v_user_id, 'profile_completion', 5, true, json_build_object(
      'full_name', p_full_name,
      'username', p_username,
      'profile_image_url', p_profile_image_url,
      'security_pin_set', p_security_pin IS NOT NULL
    ))
  ON CONFLICT (user_id, step_name) DO UPDATE
  SET 
    completed = true,
    data = EXCLUDED.data,
    completed_at = now(),
    updated_at = now();

  RETURN QUERY SELECT true, 'Account completed successfully', 5;
END;
$$;

-- Function to validate username availability
CREATE OR REPLACE FUNCTION public.check_username_availability(
  p_username TEXT
)
RETURNS TABLE(
  available BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_username_exists BOOLEAN := FALSE;
  v_valid_format BOOLEAN := FALSE;
BEGIN
  -- Check username format
  v_valid_format := p_username ~ '^[a-zA-Z0-9_]{3,20}$';
  
  IF NOT v_valid_format THEN
    RETURN QUERY SELECT false, 'Username must be 3-20 characters using letters, numbers, or underscore';
    RETURN;
  END IF;

  -- Check if username exists
  SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = p_username AND id != v_user_id)
  INTO v_username_exists;

  IF v_username_exists THEN
    RETURN QUERY SELECT false, 'Username is already taken';
  ELSE
    RETURN QUERY SELECT true, 'Username is available';
  END IF;
END;
$$;

-- Function to upload profile image
CREATE OR REPLACE FUNCTION public.upload_profile_image(
  p_image_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET 
    profile_image_url = p_image_url,
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.user_preferences
  SET 
    profile_image_uploaded = true,
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN true;
END;
$$;

-- Function to update security PIN
CREATE OR REPLACE FUNCTION public.update_security_pin(
  p_new_pin TEXT,
  p_current_pin TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_pin_hash TEXT;
  v_pin_length INTEGER := LENGTH(p_new_pin);
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Unauthorized';
    RETURN;
  END IF;

  -- Validate PIN length (4-6 digits)
  IF v_pin_length < 4 OR v_pin_length > 6 OR p_new_pin !~ '^[0-9]+$' THEN
    RETURN QUERY SELECT false, 'PIN must be 4-6 digits';
    RETURN;
  END IF;

  -- Get current PIN hash
  SELECT security_pin_hash INTO v_current_pin_hash
  FROM public.profiles
  WHERE id = v_user_id;

  -- If user has existing PIN, verify current PIN
  IF v_current_pin_hash IS NOT NULL AND p_current_pin IS NULL THEN
    RETURN QUERY SELECT false, 'Current PIN required to update security PIN';
    RETURN;
  END IF;

  IF v_current_pin_hash IS NOT NULL AND p_current_pin IS NOT NULL THEN
    IF NOT (v_current_pin_hash = crypt(p_current_pin, v_current_pin_hash)) THEN
      RETURN QUERY SELECT false, 'Current PIN is incorrect';
      RETURN;
    END IF;
  END IF;

  -- Update PIN
  UPDATE public.profiles
  SET 
    security_pin_hash = crypt(p_new_pin, gen_salt('bf')),
    updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.user_preferences
  SET 
    security_pin_set = true,
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN QUERY SELECT true, 'Security PIN updated successfully';
END;
$$;

-- Function to get onboarding status
CREATE OR REPLACE FUNCTION public.get_onboarding_status()
RETURNS TABLE(
  step INTEGER,
  completed BOOLEAN,
  profile_full_name TEXT,
  profile_username TEXT,
  profile_image_url TEXT,
  profile_image_uploaded BOOLEAN,
  security_pin_set BOOLEAN,
  onboarding_started_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    up.onboarding_step,
    up.onboarding_completed,
    up.profile_full_name,
    up.profile_username,
    p.profile_image_url,
    up.profile_image_uploaded,
    up.security_pin_set,
    up.onboarding_started_at,
    up.onboarding_completed_at
  FROM public.user_preferences up
  LEFT JOIN public.profiles p ON p.id = up.user_id
  WHERE up.user_id = auth.uid();
END;
$$;

-- Grant permissions for new functions
REVOKE ALL ON FUNCTION public.complete_account_onboarding(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_account_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.check_username_availability(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_availability(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.upload_profile_image(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upload_profile_image(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.update_security_pin(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_security_pin(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_onboarding_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_onboarding_status() TO authenticated;

-- RLS policies for onboarding_steps
DROP POLICY IF EXISTS "Users can view own onboarding steps" ON public.onboarding_steps;
DROP POLICY IF EXISTS "Users can insert own onboarding steps" ON public.onboarding_steps;
DROP POLICY IF EXISTS "Users can update own onboarding steps" ON public.onboarding_steps;

CREATE POLICY "Users can view own onboarding steps"
  ON public.onboarding_steps
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding steps"
  ON public.onboarding_steps
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding steps"
  ON public.onboarding_steps
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON public.profiles(updated_at);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_user_id ON public.onboarding_steps(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_step_number ON public.onboarding_steps(step_number);
CREATE INDEX IF NOT EXISTS idx_onboarding_steps_completed ON public.onboarding_steps(completed);

-- Initialize onboarding steps for existing users
INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed)
SELECT 
  user_id,
  unnest(ARRAY['profile_image', 'full_name', 'username', 'security_pin', 'profile_completion']),
  unnest(ARRAY[1, 2, 3, 4, 5]),
  unnest(ARRAY[false, false, false, false, false])
FROM public.user_preferences
WHERE onboarding_completed = false
ON CONFLICT (user_id, step_name) DO NOTHING;
