-- 20260303180000_enforce_mining_session_guard.sql
-- Prevent overlapping sessions and block new starts until expired sessions are claimed.

ALTER TABLE public.mining_sessions
  DROP CONSTRAINT IF EXISTS unique_active_session;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_mining_sessions_user_active
  ON public.mining_sessions(user_id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.start_mining_session(
  p_device_fingerprint TEXT,
  p_ip_address TEXT,
  p_ad_verified BOOLEAN DEFAULT false,
  p_pi_browser_used BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_session_id UUID;
  v_claimable_session_id UUID;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '24 hours';
  v_stale_sessions INTEGER;
BEGIN
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
  WHERE user_id = v_user_id AND is_active = true
  RETURNING 1 INTO v_stale_sessions;

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
    p_ad_verified,
    p_pi_browser_used,
    now()
  )
  RETURNING id INTO v_active_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_active_session_id,
    'expires_at', v_expires_at,
    'ad_verified', p_ad_verified,
    'pi_browser_used', p_pi_browser_used,
    'stale_sessions_deactivated', v_stale_sessions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_mining_session(TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
