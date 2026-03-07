-- Enhanced user account creation and onboarding functions
-- This ensures all user data is properly saved during authentication and onboarding

-- Enhanced function to create complete user profile with all necessary data
CREATE OR REPLACE FUNCTION public.create_complete_user_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_referral_code TEXT DEFAULT NULL,
  p_pi_uid TEXT DEFAULT NULL,
  p_pi_username TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_created BOOLEAN := FALSE;
  v_preferences_created BOOLEAN := FALSE;
  v_account_created BOOLEAN := FALSE;
BEGIN
  -- Create or update profile
  INSERT INTO public.profiles (
    id, 
    full_name, 
    username, 
    referral_code
  )
  VALUES (
    p_user_id, 
    p_full_name, 
    p_username, 
    p_referral_code
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = COALESCE(p_full_name, profiles.full_name),
    username = COALESCE(p_username, profiles.username),
    referral_code = COALESCE(p_referral_code, profiles.referral_code),
    updated_at = now()
  RETURNING id IS NOT NULL INTO v_profile_created;

  -- Create user preferences
  INSERT INTO public.user_preferences (
    user_id, 
    profile_full_name, 
    profile_username, 
    reference_code,
    onboarding_step,
    onboarding_completed
  )
  SELECT 
    p_user_id, 
    p_full_name, 
    p_username, 
    p_referral_code,
    0,
    false
  ON CONFLICT (user_id) DO UPDATE
  SET 
    profile_full_name = COALESCE(p_full_name, user_preferences.profile_full_name),
    profile_username = COALESCE(p_username, user_preferences.profile_username),
    reference_code = COALESCE(p_referral_code, user_preferences.reference_code),
    updated_at = now()
  RETURNING user_id IS NOT NULL INTO v_preferences_created;

  -- Create user account
  INSERT INTO public.user_accounts (
    user_id, 
    account_number, 
    account_name, 
    account_username
  )
  VALUES (
    p_user_id,
    public.generate_openpay_account_number(p_user_id),
    COALESCE(NULLIF(TRIM(p_full_name), ''), 'OpenPay User'),
    COALESCE(NULLIF(TRIM(p_username), ''), 'openpay')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    account_name = COALESCE(NULLIF(TRIM(p_full_name), ''), user_accounts.account_name),
    account_username = COALESCE(NULLIF(TRIM(p_username), ''), user_accounts.account_username),
    updated_at = now()
  RETURNING user_id IS NOT NULL INTO v_account_created;

  -- Create wallet if not exists
  INSERT INTO public.wallets (user_id, balance)
  VALUES (p_user_id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_profile_created AND v_preferences_created AND v_account_created;
END;
$$;

-- Grant permissions for complete user profile function
REVOKE ALL ON FUNCTION public.create_complete_user_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_complete_user_profile() TO authenticated;

-- Enhanced function to handle Pi user authentication with complete data creation
CREATE OR REPLACE FUNCTION public.handle_pi_user_auth(
  p_pi_uid TEXT,
  p_pi_username TEXT,
  p_referral_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_password TEXT;
  v_profile_created BOOLEAN;
BEGIN
  -- Generate Pi user email and password
  v_email := 'pi_' || p_pi_uid || '@openpay.local';
  v_password := 'OpenPay-Pi-' || p_pi_uid || '-v1!';

  -- Create or get user
  v_profile_created := public.create_complete_user_profile(
    auth.uid(),
    p_pi_username, -- Use Pi username as full name
    p_pi_username, -- Use Pi username as username
    v_email,
    p_referral_code,
    p_pi_uid,
    p_pi_username
  );

  IF v_profile_created THEN
    -- Log successful Pi user creation
    INSERT INTO public.audit_logs (
      user_id,
      action,
      details,
      created_at
    ) VALUES (
      auth.uid(),
      'pi_user_auth_success',
      json_build_object(
        'pi_uid', p_pi_uid,
        'pi_username', p_pi_username,
        'referral_code', p_referral_code
      ),
      now()
    );
  END IF;

  RETURN v_profile_created;
END;
$$;

-- Grant permissions for Pi user auth function
REVOKE ALL ON FUNCTION public.handle_pi_user_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_pi_user_auth() TO authenticated;

-- Create audit logs table for tracking user creation
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- Enable RLS for audit logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Create policy for audit logs insertion
CREATE POLICY "Service functions can insert audit logs"
  ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);
