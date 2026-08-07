-- Install: Admin KYC identity auto-fill (OpenPay username, account #, Pi username)
-- Run in Supabase SQL editor if migrations are not applied via CLI.
--
-- NOTE: RETURNS TABLE out-params collide with SELECT aliases in plpgsql — select by position only.

CREATE OR REPLACE FUNCTION public.is_openpay_core_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_username TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT LOWER(regexp_replace(COALESCE(p.username, ''), '^@+', '', 'g'))
    INTO v_username
  FROM public.profiles p
  WHERE p.id = v_user_id;

  RETURN COALESCE(v_username, '') IN ('openpay', 'wainfoundation');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_kyc_user_identities(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  profile_username TEXT,
  account_username TEXT,
  account_number TEXT,
  account_name TEXT,
  pi_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_ids IS NULL OR COALESCE(array_length(p_user_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  -- Select by position (no AS aliases matching OUT params — avoids plpgsql ambiguity).
  RETURN QUERY
  SELECT
    u.id,
    NULLIF(LOWER(regexp_replace(TRIM(BOTH FROM COALESCE(p.username, '')), '^@+', '', 'g')), ''),
    NULLIF(LOWER(regexp_replace(TRIM(BOTH FROM COALESCE(ua.account_username, '')), '^@+', '', 'g')), ''),
    NULLIF(UPPER(TRIM(BOTH FROM COALESCE(ua.account_number, ''))), ''),
    NULLIF(TRIM(BOTH FROM COALESCE(ua.account_name, '')), ''),
    NULLIF(regexp_replace(TRIM(BOTH FROM COALESCE(pa.pi_username, '')), '^@+', '', 'g'), '')
  FROM UNNEST(p_user_ids) AS u(id)
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN LATERAL (
    SELECT ua1.account_username, ua1.account_number, ua1.account_name
    FROM public.user_accounts ua1
    WHERE ua1.user_id = u.id
    ORDER BY ua1.created_at DESC NULLS LAST
    LIMIT 1
  ) ua ON true
  LEFT JOIN LATERAL (
    SELECT pa1.pi_username
    FROM public.pi_accounts pa1
    WHERE pa1.user_id = u.id
    ORDER BY pa1.updated_at DESC NULLS LAST
    LIMIT 1
  ) pa ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_user_identities(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_kyc_user_identities(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_openpay_core_admin() TO authenticated, service_role;
