-- Fix onboarding database to ensure user data saves properly
-- This migration fixes issues with user_preferences and profile creation during onboarding

-- Fix user_preferences trigger to properly handle new users
DROP TRIGGER IF EXISTS trg_profiles_sync_user_preferences ON public.profiles;

CREATE OR REPLACE FUNCTION public.sync_user_preferences_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_preferences (
    user_id, 
    profile_full_name, 
    profile_username, 
    reference_code,
    onboarding_step,
    onboarding_completed
  )
  SELECT 
    NEW.id, 
    NEW.full_name, 
    NEW.username, 
    NEW.referral_code,
    0,
    false
  FROM public.profiles NEW
  ON CONFLICT (user_id) DO UPDATE
  SET 
    profile_full_name = EXCLUDED.profile_full_name,
    profile_username = EXCLUDED.profile_username,
    reference_code = EXCLUDED.reference_code,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_sync_user_preferences
AFTER INSERT OR UPDATE OF full_name, username, referral_code
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_preferences_from_profile();

-- Ensure all existing users have user_preferences records
INSERT INTO public.user_preferences (user_id, profile_full_name, profile_username, reference_code, onboarding_step, onboarding_completed)
SELECT 
  p.id, 
  p.full_name, 
  p.username, 
  p.referral_code,
  0,
  false
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_preferences up 
  WHERE up.user_id = p.id
);

-- Create or replace function to handle onboarding completion
CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step INTEGER,
  p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_step INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get current onboarding step
  SELECT onboarding_step 
  INTO v_current_step
  FROM public.user_preferences 
  WHERE user_id = v_user_id;

  -- Update onboarding step and data
  UPDATE public.user_preferences
  SET 
    onboarding_step = GREATEST(p_step, COALESCE(v_current_step, 0)),
    merchant_onboarding_data = CASE 
      WHEN p_data IS NOT NULL THEN 
        CASE 
          WHEN merchant_onboarding_data IS NULL THEN p_data
          ELSE merchant_onboarding_data || p_data
        END
      ELSE merchant_onboarding_data
    END,
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Mark onboarding as completed if step is 5 or higher
  IF p_step >= 5 THEN
    UPDATE public.user_preferences
    SET 
      onboarding_completed = true,
      updated_at = now()
    WHERE user_id = v_user_id;
  END IF;

  RETURN true;
END;
$$;

-- Grant permissions for onboarding function
REVOKE ALL ON FUNCTION public.complete_onboarding_step() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_step() TO authenticated;

-- Create function to get user onboarding status
CREATE OR REPLACE FUNCTION public.get_my_onboarding_status()
RETURNS TABLE(
  onboarding_step INTEGER,
  onboarding_completed BOOLEAN,
  profile_full_name TEXT,
  profile_username TEXT,
  reference_code TEXT
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
    up.reference_code
  FROM public.user_preferences up
  WHERE up.user_id = auth.uid();
END;
$$;

-- Grant permissions for onboarding status function
REVOKE ALL ON FUNCTION public.get_my_onboarding_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_onboarding_status() TO authenticated;

-- Fix policy for user_preferences to ensure proper access
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;

CREATE POLICY "Users can view own preferences"
  ON public.user_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure all profiles have corresponding user_preferences and user_accounts
INSERT INTO public.user_accounts (user_id, account_number, account_name, account_username)
SELECT
  p.id,
  public.generate_openpay_account_number(p.id),
  COALESCE(NULLIF(TRIM(p.full_name), ''), 'OpenPay User'),
  COALESCE(NULLIF(TRIM(p.username), ''), 'openpay')
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_accounts ua 
  WHERE ua.user_id = p.id
)
ON CONFLICT (user_id) DO UPDATE
SET 
  account_name = EXCLUDED.account_name,
  account_username = EXCLUDED.account_username;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_onboarding_step ON public.user_preferences(onboarding_step);
CREATE INDEX IF NOT EXISTS idx_user_preferences_completed ON public.user_preferences(onboarding_completed);

-- Add RLS policies for user_accounts if they don't exist
DROP POLICY IF EXISTS "Users can view own account" ON public.user_accounts;
DROP POLICY IF EXISTS "Users can insert own account" ON public.user_accounts;
DROP POLICY IF EXISTS "Users can update own account" ON public.user_accounts;

CREATE POLICY "Users can view own account"
  ON public.user_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own account"
  ON public.user_accounts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own account"
  ON public.user_accounts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for user_accounts
CREATE INDEX IF NOT EXISTS idx_user_accounts_user_id ON public.user_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_account_number ON public.user_accounts(account_number);
