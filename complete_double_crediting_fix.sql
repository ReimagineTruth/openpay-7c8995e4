-- Complete fix for double crediting issue
-- Includes both authenticated and public payment functions

-- Drop existing problematic functions
DROP FUNCTION IF EXISTS public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.pay_merchant_checkout_public_virtual_card CASCADE;

-- Create fixed authenticated version
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
  v_card_owner_user_id UUID;
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
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

  -- FIXED: Only debit buyer and credit merchant wallet - NO SETTLEMENT WALLET
  UPDATE public.wallets
  SET balance = v_sender_balance - v_wallet_amount,
      updated_at = now()
  WHERE user_id = v_card_owner_user_id;

  -- Credit merchant wallet with FULL amount (no more settlement wallet transfer)
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
      ' | Payment credited to merchant wallet only'
    ),
    'completed'
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.merchant_payments (
    session_id,
    merchant_user_id,
    buyer_user_id,
    transaction_id,
    amount,
    currency,
    api_key_id,
    key_mode,
    status
  )
  VALUES (
    v_session.id,
    v_session.merchant_user_id,
    v_buyer_user_id,
    v_transaction_id,
    v_session.total_amount,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    'succeeded'
  );

  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      paid_at = now(),
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_method', 'virtual_card',
        'credited_to_merchant_wallet_only', v_wallet_amount,
        'no_settlement_wallet_transfer', true
      )
  WHERE id = v_session.id;

  RETURN v_transaction_id;
END;
$$;

-- Create fixed public version
CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_public_virtual_card(
  p_session_token TEXT,
  p_card_number TEXT,
  p_expiry_month INTEGER,
  p_expiry_year INTEGER,
  p_cvc TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.merchant_checkout_sessions;
  v_merchant_user_id UUID;
  v_sanitized_card_number TEXT := regexp_replace(COALESCE(p_card_number, ''), '\D', '', 'g');
  v_sanitized_cvc TEXT := regexp_replace(COALESCE(p_cvc, ''), '\D', '', 'g');
  v_expiry_end DATE;
  v_transaction_id UUID;
  v_total_amount NUMERIC(12,2);
  v_merchant_balance NUMERIC(12,2);
BEGIN
  -- Validate session
  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
    AND mcs.status = 'open'
    AND mcs.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid or expired checkout session'::TEXT;
    RETURN;
  END IF;

  v_merchant_user_id := v_session.merchant_user_id;
  v_total_amount := v_session.total_amount;

  -- Validate card details
  IF char_length(v_sanitized_card_number) <> 16 THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Card number must be 16 digits'::TEXT;
    RETURN;
  END IF;

  IF p_expiry_month IS NULL OR p_expiry_month < 1 OR p_expiry_month > 12 THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid expiry month'::TEXT;
    RETURN;
  END IF;

  IF p_expiry_year IS NULL OR p_expiry_year < 2026 THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid expiry year'::TEXT;
    RETURN;
  END IF;

  IF char_length(v_sanitized_cvc) <> 3 THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid CVC'::TEXT;
    RETURN;
  END IF;

  v_expiry_end := (make_date(p_expiry_year, p_expiry_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  IF v_expiry_end < CURRENT_DATE THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Card expired'::TEXT;
    RETURN;
  END IF;

  -- Check if virtual card exists and is valid
  IF NOT EXISTS (
    SELECT 1
    FROM public.virtual_cards vc
    WHERE vc.card_number = v_sanitized_card_number
      AND vc.expiry_month = p_expiry_month
      AND vc.expiry_year = p_expiry_year
      AND vc.cvc = v_sanitized_cvc
      AND vc.is_active = true
  ) THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid virtual card details'::TEXT;
    RETURN;
  END IF;

  -- Get merchant wallet balance
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    -- Create merchant wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_merchant_user_id, 0, now());
    
    v_merchant_balance := 0;
  END IF;

  -- FIXED: Credit merchant wallet directly (no settlement wallet)
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_total_amount,
      updated_at = now()
  WHERE user_id = v_merchant_user_id;

  -- Create transaction record
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    created_at
  ) VALUES (
    NULL, -- No sender for public virtual card payments
    v_merchant_user_id,
    v_total_amount,
    CONCAT('Public virtual card payment | Session: ', p_session_token, ' | Customer: ', COALESCE(p_customer_name, 'Anonymous'), ' | Credited to merchant wallet only'),
    'completed',
    now()
  )
  RETURNING id INTO v_transaction_id;

  -- Update session status
  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      paid_at = now(),
      updated_at = now(),
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_method', 'public_virtual_card',
        'credited_to_merchant_wallet_only', v_total_amount,
        'no_settlement_wallet_transfer', true
      )
  WHERE id = v_session.id;

  -- Create merchant payment record
  INSERT INTO public.merchant_payments (
    session_id,
    merchant_user_id,
    buyer_user_id,
    transaction_id,
    amount,
    currency,
    key_mode,
    status,
    created_at
  ) VALUES (
    v_session.id,
    v_merchant_user_id,
    NULL, -- No buyer user for public payments
    v_transaction_id,
    v_total_amount,
    v_session.currency,
    v_session.key_mode,
    'succeeded',
    now()
  );

  RETURN QUERY SELECT v_transaction_id, 'success'::TEXT, 'Payment credited to merchant wallet successfully'::TEXT;
END;
$$;

-- Backward compatibility version for authenticated function
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
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_with_virtual_card(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.pay_merchant_checkout_public_virtual_card(TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
