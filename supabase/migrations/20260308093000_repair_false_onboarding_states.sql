CREATE OR REPLACE FUNCTION public.repair_my_onboarding_if_ready()
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

  PERFORM public.upsert_my_user_account();

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

  IF v_full_name != '' AND v_username != '' AND v_has_account AND v_account_ok THEN
    UPDATE public.user_preferences
    SET 
      onboarding_step = 5,
      onboarding_completed = true,
      onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
      profile_full_name = v_full_name,
      profile_username = v_username,
      updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed, data, completed_at)
    VALUES (
      v_user_id,
      'profile_completion',
      5,
      true,
      jsonb_build_object('full_name', v_full_name, 'username', v_username),
      now()
    )
    ON CONFLICT (user_id, step_name) DO UPDATE
    SET 
      completed = true,
      data = EXCLUDED.data,
      completed_at = now(),
      updated_at = now();

    RETURN QUERY SELECT true, 'Onboarding repaired', 5;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, 'Profile or account incomplete', 0;
END;
$$;

DO $$
BEGIN
  UPDATE public.user_preferences up
  SET 
    onboarding_step = 5,
    onboarding_completed = true,
    onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
    updated_at = now()
  WHERE up.onboarding_completed = false
    AND COALESCE(NULLIF(TRIM(up.profile_full_name), ''), '') != ''
    AND COALESCE(NULLIF(TRIM(COALESCE(up.profile_username, '')), ''), '') != ''
    AND EXISTS (
      SELECT 1 FROM public.user_accounts ua 
      WHERE ua.user_id = up.user_id 
        AND ua.account_number ~ '^OP[A-Z0-9]{6,64}$'
    );

  INSERT INTO public.onboarding_steps (user_id, step_name, step_number, completed, data, completed_at)
  SELECT 
    up.user_id,
    'profile_completion',
    5,
    true,
    jsonb_build_object('full_name', up.profile_full_name, 'username', up.profile_username),
    now()
  FROM public.user_preferences up
  WHERE up.onboarding_completed = true
  ON CONFLICT (user_id, step_name) DO UPDATE
  SET 
    completed = true,
    data = EXCLUDED.data,
    completed_at = now(),
    updated_at = now();
END $$;

REVOKE ALL ON FUNCTION public.repair_my_onboarding_if_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repair_my_onboarding_if_ready() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
