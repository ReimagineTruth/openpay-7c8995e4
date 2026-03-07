-- Fix onboarding flow: prevent user_accounts check constraint violations during account completion
-- Replaces complete_account_onboarding to ensure a compliant user_accounts row is upserted explicitly
-- Date: 2026-03-08
-- Idempotent: CREATE OR REPLACE FUNCTION

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

  -- Explicitly upsert user_accounts with a compliant account_number
  INSERT INTO public.user_accounts (user_id, account_number, account_name, account_username)
  VALUES (
    v_user_id,
    public.generate_openpay_account_number(v_user_id),
    COALESCE(NULLIF(TRIM(p_full_name), ''), 'OpenPay User'),
    COALESCE(NULLIF(TRIM(p_username), ''), 'openpay')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    account_name = EXCLUDED.account_name,
    account_username = EXCLUDED.account_username;

  RETURN QUERY SELECT true, 'Account completed successfully', 5;
END;
$$;

