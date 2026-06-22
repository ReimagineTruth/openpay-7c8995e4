
CREATE OR REPLACE FUNCTION public.is_openpay_metrics_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND lower(regexp_replace(coalesce(username,''), '^@+', '')) IN ('openpay','wainfoundation')
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_openpay_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  now_ts timestamptz := now();
  sod timestamptz := date_trunc('day', now_ts);
  sod_prev timestamptz := sod - interval '1 day';
  som timestamptz := date_trunc('month', now_ts);
  som_prev timestamptz := som - interval '1 month';
  soy timestamptz := date_trunc('year', now_ts);
  soy_prev timestamptz := soy - interval '1 year';
BEGIN
  IF NOT public.is_openpay_metrics_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'users_today', (SELECT count(*) FROM public.profiles WHERE created_at >= sod),
    'users_prev_day', (SELECT count(*) FROM public.profiles WHERE created_at >= sod_prev AND created_at < sod),
    'users_month', (SELECT count(*) FROM public.profiles WHERE created_at >= som),
    'users_prev_month', (SELECT count(*) FROM public.profiles WHERE created_at >= som_prev AND created_at < som),
    'users_year', (SELECT count(*) FROM public.profiles WHERE created_at >= soy),
    'users_prev_year', (SELECT count(*) FROM public.profiles WHERE created_at >= soy_prev AND created_at < soy),
    'kyc_approved', (SELECT count(*) FROM public.kyc_applications WHERE status = 'approved'),
    'kyc_pending', (SELECT count(*) FROM public.kyc_applications WHERE status IN ('pending','under_review')),
    'total_balance', (SELECT coalesce(sum(balance),0) FROM public.wallets),
    'wallets_count', (SELECT count(*) FROM public.wallets),
    'tx_total_count', (SELECT count(*) FROM public.transactions),
    'tx_total_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status = 'completed'),
    'tx_today_count', (SELECT count(*) FROM public.transactions WHERE created_at >= sod),
    'tx_today_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= sod),
    'tx_month_count', (SELECT count(*) FROM public.transactions WHERE created_at >= som),
    'tx_month_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= som),
    'tx_year_count', (SELECT count(*) FROM public.transactions WHERE created_at >= soy),
    'tx_year_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= soy),
    'tx_prev_day_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= sod_prev AND created_at < sod),
    'tx_prev_month_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= som_prev AND created_at < som),
    'tx_prev_year_volume', (SELECT coalesce(sum(amount),0) FROM public.transactions WHERE status='completed' AND created_at >= soy_prev AND created_at < soy),
    'countries_count', (SELECT count(DISTINCT nationality) FROM public.kyc_applications WHERE nationality IS NOT NULL AND nationality <> ''),
    'countries', (
      SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT nationality AS country, count(*)::int AS users
        FROM public.kyc_applications
        WHERE nationality IS NOT NULL AND nationality <> ''
        GROUP BY nationality
        ORDER BY count(*) DESC
        LIMIT 50
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_openpay_metrics() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_openpay_metrics() FROM anon;
