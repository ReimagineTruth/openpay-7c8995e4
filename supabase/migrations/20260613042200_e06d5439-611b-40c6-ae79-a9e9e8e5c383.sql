-- Fix QR Pay analytics: status was 'completed' (wrong) instead of 'succeeded';
-- add timeframe ranges (today/week/month/year/all) and yearly totals.

CREATE OR REPLACE FUNCTION public.qr_pay_merchant_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_total numeric := 0; v_today numeric := 0; v_week numeric := 0;
  v_month numeric := 0; v_year numeric := 0; v_count integer := 0;
  v_by_method jsonb; v_balance numeric := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*) INTO v_total, v_count
    FROM qr_payment_transactions WHERE merchant_user_id = v_user AND status = 'succeeded';

  SELECT COALESCE(SUM(amount),0) INTO v_today FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(amount),0) INTO v_week FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('week', now());

  SELECT COALESCE(SUM(amount),0) INTO v_month FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('month', now());

  SELECT COALESCE(SUM(amount),0) INTO v_year FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('year', now());

  SELECT COALESCE(jsonb_object_agg(method, total), '{}'::jsonb) INTO v_by_method
    FROM (SELECT method, SUM(amount) AS total FROM qr_payment_transactions
          WHERE merchant_user_id = v_user AND status='succeeded' GROUP BY method) m;

  SELECT COALESCE(balance, 0) INTO v_balance FROM wallets WHERE user_id = v_user;

  RETURN jsonb_build_object(
    'total', v_total, 'today', v_today, 'week', v_week, 'month', v_month, 'year', v_year,
    'count', v_count, 'by_method', v_by_method, 'available_balance', v_balance
  );
END;
$$;

DROP FUNCTION IF EXISTS public.qr_pay_analytics();
DROP FUNCTION IF EXISTS public.qr_pay_analytics(text);

CREATE OR REPLACE FUNCTION public.qr_pay_analytics(p_range text DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz;
  v_bucket text;
  v_series jsonb;
  v_top jsonb;
  v_methods jsonb;
  v_totals jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_range = 'today' THEN
    v_since := date_trunc('day', now());
    v_bucket := 'hour';
  ELSIF p_range = 'week' THEN
    v_since := now() - interval '6 days';
    v_bucket := 'day';
  ELSIF p_range = 'year' THEN
    v_since := date_trunc('year', now());
    v_bucket := 'month';
  ELSIF p_range = 'all' THEN
    v_since := '1970-01-01'::timestamptz;
    v_bucket := 'month';
  ELSE -- month / default
    v_since := now() - interval '29 days';
    v_bucket := 'day';
  END IF;

  WITH buckets AS (
    SELECT generate_series(
      date_trunc(v_bucket, v_since),
      date_trunc(v_bucket, now()),
      ('1 ' || v_bucket)::interval
    ) AS b
  ),
  agg AS (
    SELECT date_trunc(v_bucket, paid_at) AS b,
           COALESCE(SUM(amount),0) AS revenue,
           COUNT(*) AS payments
    FROM qr_payment_transactions
    WHERE merchant_user_id = v_uid AND status='succeeded' AND paid_at >= v_since
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(buckets.b, 'YYYY-MM-DD HH24:MI'),
    'label', CASE
      WHEN v_bucket='hour' THEN to_char(buckets.b,'HH24:MI')
      WHEN v_bucket='month' THEN to_char(buckets.b,'Mon')
      ELSE to_char(buckets.b,'Mon DD') END,
    'revenue', COALESCE(agg.revenue,0),
    'payments', COALESCE(agg.payments,0)
  ) ORDER BY buckets.b)
  INTO v_series
  FROM buckets LEFT JOIN agg ON agg.b = buckets.b;

  SELECT jsonb_agg(row_to_json(t)) INTO v_top FROM (
    SELECT p.id, p.token, p.title, p.currency,
           COALESCE(SUM(tx.amount),0)::numeric AS revenue,
           COUNT(tx.id) AS payments
    FROM qr_payments p
    LEFT JOIN qr_payment_transactions tx
      ON tx.qr_payment_id = p.id AND tx.status='succeeded' AND tx.paid_at >= v_since
    WHERE p.merchant_user_id = v_uid
    GROUP BY p.id
    ORDER BY revenue DESC NULLS LAST
    LIMIT 5
  ) t;

  SELECT jsonb_object_agg(method, total) INTO v_methods FROM (
    SELECT method, COALESCE(SUM(amount),0)::numeric AS total
    FROM qr_payment_transactions
    WHERE merchant_user_id = v_uid AND status='succeeded' AND paid_at >= v_since
    GROUP BY method
  ) m;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount),0),
    'total_payments', COUNT(*),
    'avg_payment', COALESCE(AVG(amount),0),
    'unique_customers', COUNT(DISTINCT COALESCE(payer_user_id::text, payer_email))
  ) INTO v_totals
  FROM qr_payment_transactions
  WHERE merchant_user_id = v_uid AND status='succeeded' AND paid_at >= v_since;

  RETURN jsonb_build_object(
    'success', true,
    'range', p_range,
    'bucket', v_bucket,
    'daily', COALESCE(v_series,'[]'::jsonb),
    'top', COALESCE(v_top,'[]'::jsonb),
    'by_method', COALESCE(v_methods,'{}'::jsonb),
    'totals', v_totals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_merchant_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_pay_analytics(text) TO authenticated;