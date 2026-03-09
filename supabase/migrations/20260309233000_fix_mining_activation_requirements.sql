-- 20260309233000_fix_mining_activation_requirements.sql
-- Enforce that mining starts only for Pi-auth users in Pi Browser after rewarded ad verification.

ALTER TABLE public.mining_sessions
  ADD COLUMN IF NOT EXISTS ad_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pi_browser_used BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ DEFAULT now();

CREATE OR REPLACE FUNCTION public.start_mining_session(
  p_device_fingerprint TEXT,
  p_ip_address TEXT,
  p_ad_verified BOOLEAN DEFAULT false,
  p_pi_browser_used BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_pi_uid TEXT;
  v_active_session_id UUID;
  v_claimable_session_id UUID;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '24 hours';
  v_stale_sessions INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(BTRIM(u.raw_user_meta_data->>'pi_uid'), '')
  INTO v_pi_uid
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF v_pi_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Pi authentication required. Sign in with Pi Auth in Pi Browser.');
  END IF;

  IF COALESCE(p_pi_browser_used, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Pi Browser is required to start mining.');
  END IF;

  IF COALESCE(p_ad_verified, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Rewarded ad verification is required to start mining.');
  END IF;

  SELECT id INTO v_active_session_id
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at > now();

  IF v_active_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Mining session already active', 'session_id', v_active_session_id);
  END IF;

  SELECT id INTO v_claimable_session_id
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at <= now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF v_claimable_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Mining session complete. Claim rewards before starting again.', 'session_id', v_claimable_session_id);
  END IF;

  UPDATE public.mining_sessions
  SET is_active = false, last_sync_at = now()
  WHERE user_id = v_user_id AND is_active = true;

  GET DIAGNOSTICS v_stale_sessions = ROW_COUNT;

  INSERT INTO public.mining_sessions (
    user_id,
    expires_at,
    device_fingerprint,
    ip_address,
    ad_verified,
    pi_browser_used,
    last_sync_at
  )
  VALUES (
    v_user_id,
    v_expires_at,
    p_device_fingerprint,
    p_ip_address,
    true,
    true,
    now()
  )
  RETURNING id INTO v_active_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_active_session_id,
    'expires_at', v_expires_at,
    'ad_verified', true,
    'pi_browser_used', true,
    'stale_sessions_deactivated', v_stale_sessions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_mining_session(TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_mining_session(TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

