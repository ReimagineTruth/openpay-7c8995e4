-- Allow the original browser (outside Pi Browser) to detect when a Pi payment finishes
-- and continue to the success screen automatically.

CREATE OR REPLACE FUNCTION public.qr_pay_check_result(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay public.qr_payments;
  v_tx public.qr_payment_transactions;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 6 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE token = btrim(p_token);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  IF v_pay.status = 'paid' THEN
    SELECT * INTO v_tx
    FROM public.qr_payment_transactions
    WHERE qr_payment_id = v_pay.id
      AND status = 'succeeded'
    ORDER BY COALESCE(paid_at, created_at) DESC
    LIMIT 1;

    RETURN jsonb_build_object(
      'token', v_pay.token,
      'status', v_pay.status,
      'paid', true,
      'transaction_ref', v_tx.transaction_ref,
      'method', v_tx.method,
      'amount', COALESCE(v_tx.amount, v_pay.total),
      'currency', COALESCE(v_tx.currency, v_pay.currency),
      'paid_at', v_tx.paid_at,
      'payer_name', v_tx.payer_name,
      'payer_email', v_tx.payer_email
    );
  END IF;

  RETURN jsonb_build_object(
    'token', v_pay.token,
    'status', v_pay.status,
    'paid', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_check_result(text) TO anon, authenticated, service_role;
