
-- Delete a QR payment owned by the caller
CREATE OR REPLACE FUNCTION public.qr_pay_delete(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT merchant_user_id INTO v_owner FROM public.qr_payments WHERE id = p_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  IF v_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  DELETE FROM public.qr_payment_items WHERE qr_payment_id = p_id;
  DELETE FROM public.qr_payment_transactions WHERE qr_payment_id = p_id;
  DELETE FROM public.qr_payments WHERE id = p_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_delete(uuid) TO authenticated;

-- Analytics: 30-day daily series + top QR payments + method breakdown
CREATE OR REPLACE FUNCTION public.qr_pay_analytics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_daily jsonb;
  v_top jsonb;
  v_methods jsonb;
  v_totals jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  WITH days AS (
    SELECT generate_series(
      (current_date - interval '29 days')::date,
      current_date,
      interval '1 day'
    )::date AS d
  ),
  agg AS (
    SELECT date_trunc('day', paid_at)::date AS d,
           COALESCE(SUM(amount), 0) AS revenue,
           COUNT(*) AS payments
    FROM public.qr_payment_transactions
    WHERE merchant_user_id = v_uid
      AND status = 'completed'
      AND paid_at >= (current_date - interval '29 days')
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(days.d, 'YYYY-MM-DD'),
    'label', to_char(days.d, 'Mon DD'),
    'revenue', COALESCE(agg.revenue, 0),
    'payments', COALESCE(agg.payments, 0)
  ) ORDER BY days.d)
  INTO v_daily
  FROM days LEFT JOIN agg ON agg.d = days.d;

  SELECT jsonb_agg(row_to_json(t))
  INTO v_top
  FROM (
    SELECT p.id, p.token, p.title, p.currency,
           COALESCE(SUM(tx.amount), 0)::numeric AS revenue,
           COUNT(tx.id) AS payments
    FROM public.qr_payments p
    LEFT JOIN public.qr_payment_transactions tx
      ON tx.qr_payment_id = p.id AND tx.status = 'completed'
    WHERE p.merchant_user_id = v_uid
    GROUP BY p.id
    ORDER BY revenue DESC
    LIMIT 5
  ) t;

  SELECT jsonb_object_agg(method, total)
  INTO v_methods
  FROM (
    SELECT method, COALESCE(SUM(amount), 0)::numeric AS total
    FROM public.qr_payment_transactions
    WHERE merchant_user_id = v_uid AND status = 'completed'
    GROUP BY method
  ) m;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(amount), 0),
    'total_payments', COUNT(*),
    'avg_payment', COALESCE(AVG(amount), 0),
    'unique_customers', COUNT(DISTINCT COALESCE(payer_user_id::text, payer_email))
  ) INTO v_totals
  FROM public.qr_payment_transactions
  WHERE merchant_user_id = v_uid AND status = 'completed';

  RETURN jsonb_build_object(
    'success', true,
    'daily', COALESCE(v_daily, '[]'::jsonb),
    'top', COALESCE(v_top, '[]'::jsonb),
    'by_method', COALESCE(v_methods, '{}'::jsonb),
    'totals', v_totals
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_analytics() TO authenticated;
