CREATE OR REPLACE FUNCTION public.skip_account_onboarding()
RETURNS TABLE(success BOOLEAN, message TEXT)
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

  PERFORM public.upsert_my_user_account();

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

  RETURN QUERY SELECT true, 'Onboarding postponed';
END;
$$;

REVOKE ALL ON FUNCTION public.skip_account_onboarding() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skip_account_onboarding() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
