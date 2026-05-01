-- Fix double crediting issue in POS and checkout link payments
-- This fix ensures payments only credit the merchant wallet, not both merchant and settlement wallets

-- First, let's identify the problematic function and fix it
-- The issue is in pay_merchant_checkout_with_virtual_card function

DROP FUNCTION IF EXISTS public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_virtual_card(
  p_session_token TEXT,
  p_card_number TEXT,
  p_expiry_month INTEGER,
  p_expiry_year INTEGER,
  p_cvc TEXT,
  p_note TEXT DEFAULT '',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_session public.merchant_checkout_sessions;
  v_sender_balance NUMERIC(12,2);
  v_receiver_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_card_number TEXT := regexp_replace(COALESCE(p_card_number, ''), '\D', '', 'g');
  v_cvc TEXT := regexp_replace(COALESCE(p_cvc, ''), '\D', '', 'g');
  v_expiry_end DATE;
  v_expiry_year INTEGER := COALESCE(p_expiry_year, 0);
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
  v_card_owner_user_id UUID;
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
  v_fee_payer TEXT := 'customer';
  v_fee_amount NUMERIC(12,2) := 0;
  v_merchant_settlement NUMERIC(12,2) := 0;
BEGIN
  IF v_expiry_year > 0 AND v_expiry_year < 100 THEN
    v_expiry_year := 2000 + v_expiry_year;
  END IF;

  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout session not found';
  END IF;

  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Checkout session is not open';
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF char_length(v_card_number) <> 16 THEN
    RAISE EXCEPTION 'Card number must be 16 digits';
  END IF;

  IF p_expiry_month IS NULL OR p_expiry_month < 1 OR p_expiry_month > 12 THEN
    RAISE EXCEPTION 'Invalid expiry month';
  END IF;

  IF v_expiry_year < 2026 THEN
    RAISE EXCEPTION 'Invalid expiry year';
  END IF;

  IF char_length(v_cvc) <> 3 THEN
    RAISE EXCEPTION 'Invalid CVC';
  END IF;

  v_expiry_end := (make_date(v_expiry_year, p_expiry_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  IF v_expiry_end < CURRENT_DATE THEN
    RAISE EXCEPTION 'Card expired';
  END IF;

  SELECT vc.user_id
  INTO v_card_owner_user_id
  FROM public.virtual_cards vc
  WHERE vc.card_number = v_card_number
    AND vc.expiry_month = p_expiry_month
    AND vc.expiry_year = v_expiry_year
    AND vc.cvc = v_cvc
    AND vc.is_active = true
    AND COALESCE(vc.is_locked, false) = false
    AND COALESCE((vc.card_settings ->> 'allow_checkout')::BOOLEAN, true) = true
  FOR UPDATE;

  IF v_card_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid virtual card details';
  END IF;

  IF v_buyer_user_id IS NULL THEN
    v_buyer_user_id := v_card_owner_user_id;
  END IF;

  IF v_card_owner_user_id <> v_buyer_user_id THEN
    RAISE EXCEPTION 'Card owner does not match authenticated customer';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  v_fee_payer := LOWER(COALESCE(NULLIF(TRIM(v_session.metadata->>'fee_payer'), ''), 'customer'));
  v_fee_amount := COALESCE(v_session.fee_amount, ROUND(COALESCE(v_session.subtotal_amount, 0) * 0.02, 2));
  v_merchant_settlement := COALESCE(
    NULLIF(TRIM(v_session.metadata->>'merchant_settlement_amount'), '')::NUMERIC,
    CASE
      WHEN v_fee_payer = 'merchant' THEN GREATEST(COALESCE(v_session.subtotal_amount, 0) - v_fee_amount, 0)
      ELSE COALESCE(v_session.subtotal_amount, COALESCE(v_session.total_amount, 0))
    END
  );

  SELECT sc.usd_rate
  INTO v_currency_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_session.currency, 'USD'))
    AND sc.is_active = true
  LIMIT 1;

  v_currency_rate := COALESCE(NULLIF(v_currency_rate, 0), 1);
  v_wallet_amount := ROUND(COALESCE(v_session.total_amount, 0) / v_currency_rate, 2);

  IF v_wallet_amount <= 0 THEN
    RAISE EXCEPTION 'Checkout amount must be greater than zero';
  END IF;

  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = v_card_owner_user_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Buyer wallet not found';
  END IF;

  SELECT balance INTO v_receiver_balance
  FROM public.wallets
  WHERE user_id = v_session.merchant_user_id
  FOR UPDATE;

  IF v_receiver_balance IS NULL THEN
    RAISE EXCEPTION 'Merchant wallet not found';
  END IF;

  IF v_sender_balance < v_wallet_amount THEN
    RAISE EXCEPTION 'Insufficient virtual card balance';
  END IF;

  -- FIXED: Only credit merchant wallet, remove settlement wallet logic
  UPDATE public.wallets
  SET balance = v_sender_balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_card_owner_user_id;

  -- Credit merchant wallet only (no more double crediting)
  UPDATE public.wallets
  SET balance = v_receiver_balance + v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_card_owner_user_id,
    v_session.merchant_user_id,
    v_wallet_amount,
    CONCAT(
      'Merchant checkout ',
      v_session.session_token,
      ' | Card ****',
      RIGHT(v_card_number, 4),
      ' | Payment credited to merchant wallet',
      CASE WHEN COALESCE(TRIM(p_note), '') <> '' THEN CONCAT(' | ', TRIM(p_note)) ELSE '' END
    ),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  v_payment_link_id := NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL);
  v_payment_link_token := NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), '');

  INSERT INTO public.merchant_payments (
    session_id,
    merchant_user_id,
    buyer_user_id,
    transaction_id,
    amount,
    currency,
    api_key_id,
    key_mode,
    payment_link_id,
    payment_link_token,
    status
  )
  VALUES (
    v_session.id,
    v_session.merchant_user_id,
    v_buyer_user_id,
    v_transaction_id,
    v_merchant_settlement,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    v_payment_link_id,
    v_payment_link_token,
    'succeeded'
  );

  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      paid_at = now(),
      customer_name = COALESCE(NULLIF(TRIM(COALESCE(p_customer_name, v_session.customer_name, '')), ''), v_session.customer_name),
      customer_email = COALESCE(NULLIF(TRIM(COALESCE(p_customer_email, v_session.customer_email, '')), ''), v_session.customer_email),
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'fee_payer', v_fee_payer,
        'openpay_fee_amount', v_fee_amount,
        'merchant_settlement_amount', v_merchant_settlement,
        'payment_method', 'virtual_card'
      )
  WHERE id = v_session.id;

  RETURN v_transaction_id;
END;
$$;

-- Also fix the version without customer details parameters for backward compatibility
CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_virtual_card(
  p_session_token TEXT,
  p_card_number TEXT,
  p_expiry_month INTEGER,
  p_expiry_year INTEGER,
  p_cvc TEXT,
  p_note TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.pay_merchant_checkout_with_virtual_card(
    p_session_token,
    p_card_number,
    p_expiry_month,
    p_expiry_year,
    p_cvc,
    p_note,
    NULL, NULL, NULL, NULL
  );
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
