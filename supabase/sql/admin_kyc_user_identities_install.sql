-- Install: Admin KYC identity auto-fill (OpenPay username, account #, Pi username)
-- Run in Supabase SQL editor if migrations are not applied via CLI.

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
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    NULLIF(LOWER(TRIM(BOTH FROM COALESCE(p.username, ''))), '') AS profile_username,
    NULLIF(LOWER(TRIM(BOTH FROM COALESCE(ua.account_username, ''))), '') AS account_username,
    NULLIF(UPPER(TRIM(BOTH FROM COALESCE(ua.account_number, ''))), '') AS account_number,
    NULLIF(TRIM(BOTH FROM COALESCE(ua.account_name, '')), '') AS account_name,
    NULLIF(TRIM(BOTH FROM COALESCE(pa.pi_username, '')), '') AS pi_username
  FROM UNNEST(p_user_ids) AS u(id)
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_accounts ua ON ua.user_id = u.id
  LEFT JOIN public.pi_accounts pa ON pa.user_id = u.id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_kyc_user_identities(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_kyc_user_identities(UUID[]) TO authenticated, service_role;
