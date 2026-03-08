CREATE OR REPLACE FUNCTION public.reset_my_onboarding_to_false()
RETURNS TABLE(success BOOLEAN, message TEXT, onboarding_step INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_full_name TEXT;
  v_username TEXT;
  v_has_account BOOLEAN := FALSE;
  v_account_ok BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT 
    COALESCE(NULLIF(TRIM(p.full_name), ''), ''),
    COALESCE(NULLIF(TRIM(COALESCE(p.username, '')), ''), '')
  INTO v_full_name, v_username
  FROM public.profiles p
  WHERE p.id = v_user_id;

  SELECT EXISTS(SELECT 1 FROM public.user_accounts ua WHERE ua.user_id = v_user_id)
  INTO v_has_account;

  SELECT EXISTS(
    SELECT 1 
    FROM public.user_accounts ua 
    WHERE ua.user_id = v_user_id 
      AND ua.account_number ~ '^OP[A-Z0-9]{6,64}$'
  )
  INTO v_account_ok;

  IF v_full_name = '' OR v_username = '' OR NOT v_has_account OR NOT v_account_ok THEN
    UPDATE public.user_preferences
    SET 
      onboarding_step = COALESCE(onboarding_step, 1),
      onboarding_completed = false,
      onboarding_started_at = COALESCE(onboarding_started_at, now()),
      updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed)
    VALUES (v_user_id, 'profile_completion', 5, false)
    ON CONFLICT (user_id, step_name) DO UPDATE
    SET completed = false,
        updated_at = now();

    RETURN QUERY SELECT true, 'Onboarding reset', 0;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'Prerequisites are complete', 5;
END;
$$;

DO $$
BEGIN
  UPDATE public.user_preferences up
  SET 
    onboarding_step = COALESCE(onboarding_step, 1),
    onboarding_completed = false,
    onboarding_started_at = COALESCE(onboarding_started_at, now()),
    updated_at = now()
  WHERE COALESCE(NULLIF(TRIM(up.profile_full_name), ''), '') = ''
     OR COALESCE(NULLIF(TRIM(COALESCE(up.profile_username, '')), ''), '') = ''
     OR NOT EXISTS (
       SELECT 1 FROM public.user_accounts ua 
       WHERE ua.user_id = up.user_id 
         AND ua.account_number ~ '^OP[A-Z0-9]{6,64}$'
     );

  INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed)
  SELECT 
    up.user_id,
    'profile_completion',
    5,
    false
  FROM public.user_preferences up
  WHERE up.onboarding_completed = false
  ON CONFLICT (user_id, step_name) DO UPDATE
  SET 
    completed = false,
    updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.reset_my_onboarding_to_false() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_my_onboarding_to_false() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
