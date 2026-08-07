-- Extend PayMongo QR Pay methods: BillEase BNPL + Online Banking

ALTER TABLE public.qr_payment_transactions
  DROP CONSTRAINT IF EXISTS qr_payment_transactions_method_check;

ALTER TABLE public.qr_payment_transactions
  ADD CONSTRAINT qr_payment_transactions_method_check
  CHECK (method IN ('pi', 'wallet', 'virtual_card', 'qr_ph', 'gcash', 'billease', 'bank', 'pro'));

CREATE OR REPLACE FUNCTION public.qr_pay_complete_paymongo(
  p_token text,
  p_method text,
  p_paymongo_intent_id text,
  p_paymongo_payment_id text DEFAULT NULL,
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
  v_method text := lower(btrim(COALESCE(p_method, '')));
  v_meta jsonb;
  v_allowed boolean := false;
  v_existing text;
BEGIN
  IF v_method NOT IN ('qr_ph', 'gcash', 'billease', 'bank') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF NULLIF(btrim(COALESCE(p_paymongo_intent_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'intent_required';
  END IF;

  SELECT transaction_ref INTO v_existing
  FROM public.qr_payment_transactions
  WHERE provider_payload->>'paymongo_intent_id' = p_paymongo_intent_id
    AND status = 'succeeded'
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('transaction_ref', v_existing, 'already', true);
  END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;

  v_meta := COALESCE(v_pay.metadata, '{}'::jsonb);
  IF v_method = 'qr_ph' THEN
    v_allowed := COALESCE((v_meta->>'allow_qr_ph')::boolean, false);
  ELSIF v_method = 'gcash' THEN
    v_allowed := COALESCE((v_meta->>'allow_gcash')::boolean, false);
  ELSIF v_method = 'billease' THEN
    v_allowed := COALESCE((v_meta->>'allow_billease')::boolean, false);
  ELSIF v_method = 'bank' THEN
    v_allowed := COALESCE((v_meta->>'allow_bank')::boolean, false);
  END IF;
  IF NOT v_allowed THEN RAISE EXCEPTION 'method_not_allowed'; END IF;

  IF v_user IS NOT NULL AND v_pay.merchant_user_id = v_user THEN
    RAISE EXCEPTION 'cannot_pay_self';
  END IF;

  v_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  INSERT INTO public.wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE
    SET balance = public.wallets.balance + v_amount, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  IF v_user IS NOT NULL THEN
    SELECT username INTO v_username FROM public.profiles WHERE id = v_user;
  END IF;

  INSERT INTO public.qr_payment_transactions(
    id, qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at,
    payer_phone, delivery_address, delivery_notes, provider_payload
  ) VALUES (
    v_tx_id, v_pay.id, v_pay.merchant_user_id, v_user, p_payer_name, p_payer_email, v_username,
    v_method, v_amount, v_pay.currency, 'succeeded', v_ref, now(),
    p_payer_phone, p_delivery_address, p_delivery_notes,
    jsonb_build_object(
      'paymongo_intent_id', p_paymongo_intent_id,
      'paymongo_payment_id', p_paymongo_payment_id,
      'provider', 'paymongo'
    )
  );

  IF NOT v_pay.reusable THEN
    UPDATE public.qr_payments SET status = 'paid' WHERE id = v_pay.id;
  END IF;

  PERFORM public.qr_pay__notify_and_email(
    v_pay, v_tx_id, v_amount, v_method, v_ref,
    p_payer_name, p_payer_email, p_delivery_address, p_delivery_notes, p_payer_phone, v_user
  );

  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount, 'method', v_method);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_paymongo(
  text, text, text, text, text, text, numeric, text, text, text, uuid
) TO service_role;

-- Allow local Vite bridge / clients to complete after PayMongo verifies success server-side
GRANT EXECUTE ON FUNCTION public.qr_pay_complete_paymongo(
  text, text, text, text, text, text, numeric, text, text, text, uuid
) TO anon, authenticated;
