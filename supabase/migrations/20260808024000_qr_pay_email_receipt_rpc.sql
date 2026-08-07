-- QR Pay: email receipt via outbox + Lovable queue (no Edge Function required)
-- Uses existing email_notifications_outbox → dispatch_outbox_to_pgmq → process-email-queue cron

CREATE OR REPLACE FUNCTION public.qr_pay_email_receipt(
  p_transaction_ref text,
  p_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(COALESCE(p_email, '')));
  v_ref text := btrim(COALESCE(p_transaction_ref, ''));
  v_tx public.qr_payment_transactions;
  v_pay public.qr_payments;
  v_merchant_name text;
  v_merchant_username text;
  v_amount_str text;
  v_subject text;
  v_body text;
  v_recent int := 0;
  v_outbox_id uuid;
  v_dispatched int := 0;
BEGIN
  IF v_ref = '' THEN
    RAISE EXCEPTION 'transaction_ref required';
  END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR v_email ~ '@openpay\.local$' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  SELECT * INTO v_tx
  FROM public.qr_payment_transactions
  WHERE transaction_ref = v_ref
    AND status = 'succeeded'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'receipt_not_found';
  END IF;

  -- Soft rate limit: 8 receipt emails / address / hour
  SELECT count(*)::int INTO v_recent
  FROM public.email_notifications_outbox
  WHERE to_email = v_email
    AND created_at > now() - interval '1 hour'
    AND (
      subject ILIKE '%receipt%'
      OR COALESCE(payload->>'kind', '') ILIKE '%receipt%'
      OR COALESCE(payload->>'ref', '') = v_ref
    );
  IF v_recent >= 8 THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE id = v_tx.qr_payment_id;
  SELECT full_name, username INTO v_merchant_name, v_merchant_username
  FROM public.profiles WHERE id = v_tx.merchant_user_id;

  v_amount_str := COALESCE(v_tx.currency, 'USD') || ' ' || to_char(COALESCE(v_tx.amount, 0), 'FM999999990.00');
  v_subject := 'Your OpenPay receipt · ' || v_amount_str;

  v_body :=
    'OpenPay Receipt' || E'\n\n' ||
    'Transaction ID: ' || v_tx.transaction_ref || E'\n' ||
    'Date: ' || to_char(COALESCE(v_tx.paid_at, now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI UTC') || E'\n' ||
    'Method: ' || COALESCE(v_tx.method, 'openpay') || E'\n' ||
    'Merchant: ' || COALESCE(v_merchant_name, 'merchant') ||
      CASE WHEN v_merchant_username IS NOT NULL THEN ' (@' || v_merchant_username || ')' ELSE '' END || E'\n' ||
    CASE WHEN v_pay.title IS NOT NULL AND length(v_pay.title) > 0
         THEN 'Item: ' || v_pay.title || E'\n' ELSE '' END ||
    'Amount: ' || v_amount_str || E'\n\n' ||
    'Thank you for paying with OpenPay. Keep this Transaction ID for any disputes.' || E'\n\n' ||
    'Sent by OpenPay Receipts <receipts@notify.openpy.space>';

  INSERT INTO public.email_notifications_outbox(
    user_id, to_email, subject, body, status, payload
  ) VALUES (
    COALESCE(v_tx.payer_user_id, v_tx.merchant_user_id),
    v_email,
    v_subject,
    v_body,
    'pending',
    jsonb_build_object(
      'kind', 'qr_pay_customer_receipt',
      'ref', v_tx.transaction_ref,
      'token', v_pay.token,
      'method', v_tx.method,
      'provider', 'lovable',
      'from', 'OpenPay Receipts <receipts@notify.openpy.space>'
    )
  )
  RETURNING id INTO v_outbox_id;

  -- Push into Lovable transactional queue immediately (cron also runs every 30s)
  BEGIN
    v_dispatched := public.dispatch_outbox_to_pgmq(50);
  EXCEPTION WHEN OTHERS THEN
    v_dispatched := 0;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'to', v_email,
    'from', 'OpenPay Receipts <receipts@notify.openpy.space>',
    'subject', v_subject,
    'outbox_id', v_outbox_id,
    'dispatched', v_dispatched,
    'transaction_ref', v_tx.transaction_ref
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_email_receipt(text, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.qr_pay_email_receipt(text, text) IS
  'Queue a QR Pay receipt email via Lovable outbox (receipts@notify.openpy.space). No Edge Function required.';
