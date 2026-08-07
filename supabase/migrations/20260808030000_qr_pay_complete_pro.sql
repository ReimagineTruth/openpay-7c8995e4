-- QR Pay: complete checkout when buyer pays merchant via OpenPay Pro

CREATE OR REPLACE FUNCTION public.qr_pay_complete_pro(
  p_token text,
  p_pro_xfer_ref text,
  p_asset text DEFAULT 'OUSD',
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL,
  p_payer_user_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := COALESCE(p_payer_user_id, auth.uid());
  v_pay public.qr_payments;
  v_amount numeric(14,2);
  v_ref text;
  v_tx_id uuid := gen_random_uuid();
  v_username text;
  v_dest text;
  v_xfer text := lower(btrim(COALESCE(p_pro_xfer_ref, '')));
  v_asset text := upper(btrim(COALESCE(p_asset, 'OUSD')));
  v_existing text;
  v_existing_amount numeric;
BEGIN
  IF NOT public.qr_pay_platform_method_allowed('pro') THEN
    RAISE EXCEPTION 'method_disabled';
  END IF;

  IF v_xfer = '' OR length(v_xfer) < 4 THEN
    RAISE EXCEPTION 'pro_ref_required';
  END IF;

  -- Idempotent on Pro transfer ref (stored in provider_payload)
  SELECT t.transaction_ref, t.amount INTO v_existing, v_existing_amount
  FROM public.qr_payment_transactions t
  JOIN public.qr_payments p ON p.id = t.qr_payment_id
  WHERE p.token = p_token
    AND t.method = 'pro'
    AND t.status = 'succeeded'
    AND t.provider_payload->>'pro_xfer_ref' = v_xfer
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'transaction_ref', v_existing,
      'amount', v_existing_amount,
      'method', 'pro',
      'already', true
    );
  END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;

  v_dest := public.qr_pay_normalize_pro_destination(v_pay.pro_settlement_to);
  IF v_dest IS NULL OR btrim(v_dest) = '' THEN
    RAISE EXCEPTION 'pro_destination_missing';
  END IF;

  IF v_user IS NOT NULL AND v_pay.merchant_user_id = v_user THEN
    RAISE EXCEPTION 'cannot_pay_self';
  END IF;

  v_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  -- Funds settle on OpenPay Pro directly — do not credit OpenPay wallet again.
  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  IF v_user IS NOT NULL THEN
    SELECT username INTO v_username FROM public.profiles WHERE id = v_user;
  END IF;

  INSERT INTO public.qr_payment_transactions(
    id, qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at,
    payer_phone, delivery_address, delivery_notes,
    pro_settlement_to, pro_settlement_status, pro_settled_at, provider_payload
  ) VALUES (
    v_tx_id, v_pay.id, v_pay.merchant_user_id, v_user, p_payer_name, p_payer_email, v_username,
    'pro', v_amount, v_pay.currency, 'succeeded', v_ref, now(),
    p_payer_phone, p_delivery_address, p_delivery_notes,
    v_dest, 'credited', now(),
    jsonb_build_object(
      'provider', 'openpay_pro',
      'method', 'pro',
      'pro_xfer_ref', v_xfer,
      'asset', v_asset,
      'destination', v_dest
    )
  );

  IF NOT v_pay.reusable THEN
    UPDATE public.qr_payments SET status = 'paid' WHERE id = v_pay.id;
  END IF;

  PERFORM public.qr_pay__notify_and_email(
    v_pay, v_tx_id, v_amount, 'pro', v_ref,
    p_payer_name, p_payer_email, p_delivery_address, p_delivery_notes, p_payer_phone, v_user
  );

  RETURN jsonb_build_object(
    'transaction_ref', v_ref,
    'amount', v_amount,
    'method', 'pro',
    'destination', v_dest,
    'asset', v_asset
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_pro(
  text, text, text, text, text, numeric, text, text, text, uuid
) TO anon, authenticated, service_role;
