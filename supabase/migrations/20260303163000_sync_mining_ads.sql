-- 20260303163000_sync_mining_ads.sql
-- Ensure mining ad verification fields and RPC signatures are present

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
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_session_id UUID;
  v_expires_at TIMESTAMPTZ := now() + INTERVAL '24 hours';
  v_stale_sessions INTEGER;
BEGIN
  SELECT id INTO v_active_session_id
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at > now();

  IF v_active_session_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Mining session already active', 'session_id', v_active_session_id);
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

CREATE OR REPLACE FUNCTION public.sync_mining_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_active_session RECORD;
  v_claimable_session RECORD;
BEGIN
  SELECT * INTO v_active_session
  FROM public.mining_sessions
  WHERE user_id = v_user_id AND is_active = true AND expires_at > now()
  ORDER BY expires_at DESC
  LIMIT 1;

  IF v_active_session IS NULL THEN
    SELECT * INTO v_claimable_session
    FROM public.mining_sessions
    WHERE user_id = v_user_id AND is_active = true AND expires_at <= now()
    ORDER BY expires_at DESC
    LIMIT 1;
  END IF;

  IF v_active_session IS NOT NULL THEN
    UPDATE public.mining_sessions
    SET last_sync_at = now()
    WHERE id = v_active_session.id;
  ELSIF v_claimable_session IS NOT NULL THEN
    UPDATE public.mining_sessions
    SET last_sync_at = now()
    WHERE id = v_claimable_session.id;
  END IF;

  RETURN jsonb_build_object(
    'active_session', v_active_session,
    'claimable_session', v_claimable_session,
    'synced_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_mining_session(TEXT, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_mining_state() TO authenticated;

NOTIFY pgrst, 'reload schema';
