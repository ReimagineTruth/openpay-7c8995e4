
-- Fix merchant double-credit display: payments already credit the merchant wallet directly.
-- We auto-settle (insert a 'wallet' marker into merchant_balance_transfers) at receive time
-- so the merchant available_balance does not double-count what is already in the wallet.

-- 1) Backfill: for every existing succeeded merchant_payment that has no settlement marker,
--    insert a settlement marker equal to the USD-converted amount.
WITH settled AS (
  SELECT
    mp.id AS payment_id,
    mp.merchant_user_id,
    mp.key_mode,
    ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) AS usd_amount,
    mp.created_at
  FROM public.merchant_payments mp
  LEFT JOIN public.supported_currencies sc
    ON sc.iso_code = UPPER(COALESCE(mp.currency, 'USD'))
  WHERE mp.status = 'succeeded'
)
INSERT INTO public.merchant_balance_transfers
  (merchant_user_id, key_mode, destination, amount, currency, note, created_at)
SELECT
  s.merchant_user_id,
  s.key_mode,
  'wallet',
  s.usd_amount,
  'USD',
  CONCAT('Auto-settle backfill for merchant_payment ', s.payment_id::text),
  s.created_at
FROM settled s
WHERE s.usd_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.merchant_balance_transfers mbt
    WHERE mbt.merchant_user_id = s.merchant_user_id
      AND mbt.note = CONCAT('Auto-settle backfill for merchant_payment ', s.payment_id::text)
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.merchant_balance_transfers mbt2
    WHERE mbt2.merchant_user_id = s.merchant_user_id
      AND mbt2.note = CONCAT('Auto-settle for merchant_payment ', s.payment_id::text)
  );

-- 2) Update pay_merchant_checkout_with_wallet to auto-insert settlement marker
CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_wallet(
  p_session_token text,
  p_note text DEFAULT ''::text,
  p_customer_name text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_session public.merchant_checkout_sessions;
  v_existing_tx UUID;
  v_tx_id UUID;
  v_sender_balance NUMERIC(12,2);
  v_merchant_balance NUMERIC(12,2);
  v_currency_rate NUMERIC(20,8) := 1;
  v_wallet_amount NUMERIC(12,2) := 0;
  v_customer_name TEXT := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_customer_email TEXT := NULLIF(TRIM(COALESCE(p_customer_email, '')), '');
  v_customer_phone TEXT := NULLIF(TRIM(COALESCE(p_customer_phone, '')), '');
  v_customer_address TEXT := NULLIF(TRIM(COALESCE(p_customer_address, '')), '');
  v_buyer_email TEXT;
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
  v_mp_id UUID;
BEGIN
  IF v_buyer_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT email INTO v_buyer_email FROM auth.users WHERE id = v_buyer_user_id;

  SELECT * INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout session not found'; END IF;

  IF v_session.status = 'paid' THEN
    SELECT mp.transaction_id INTO v_existing_tx
    FROM public.merchant_payments mp WHERE mp.session_id = v_session.id LIMIT 1;
    RETURN v_existing_tx;
  END IF;

  IF v_session.status <> 'open' THEN RAISE EXCEPTION 'Checkout session is not open'; END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions SET status='expired' WHERE id=v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  SELECT sc.usd_rate INTO v_currency_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_session.currency, 'USD')) AND sc.is_active=true
  LIMIT 1;
  v_currency_rate := COALESCE(NULLIF(v_currency_rate, 0), 1);
  v_wallet_amount := ROUND(COALESCE(v_session.total_amount, 0) / v_currency_rate, 2);

  IF v_wallet_amount <= 0 THEN RAISE EXCEPTION 'Checkout amount must be greater than zero'; END IF;

  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = v_buyer_user_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Buyer wallet not found'; END IF;

  SELECT balance INTO v_merchant_balance FROM public.wallets WHERE user_id = v_session.merchant_user_id FOR UPDATE;
  IF v_merchant_balance IS NULL THEN RAISE EXCEPTION 'Merchant wallet not found'; END IF;

  IF v_sender_balance < v_wallet_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.wallets SET balance = v_sender_balance - v_wallet_amount, updated_at = now()
  WHERE user_id = v_buyer_user_id;

  UPDATE public.wallets SET balance = v_merchant_balance + v_wallet_amount, updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_buyer_user_id, v_session.merchant_user_id, v_wallet_amount,
    CONCAT('Merchant checkout ', v_session.session_token,
      CASE WHEN COALESCE(TRIM(p_note), '') <> '' THEN CONCAT(' | ', TRIM(p_note)) ELSE '' END),
    'completed'
  ) RETURNING id INTO v_tx_id;

  v_payment_link_id := NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL);
  v_payment_link_token := NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), '');

  INSERT INTO public.merchant_payments (
    session_id, merchant_user_id, buyer_user_id, transaction_id, amount,
    currency, api_key_id, key_mode, payment_link_id, payment_link_token, status
  ) VALUES (
    v_session.id, v_session.merchant_user_id, v_buyer_user_id, v_tx_id,
    v_session.total_amount, v_session.currency, v_session.api_key_id,
    v_session.key_mode, v_payment_link_id, v_payment_link_token, 'succeeded'
  ) ON CONFLICT (session_id) DO NOTHING
  RETURNING id INTO v_mp_id;

  -- Auto-settle: money already in wallet, mark as settled so available_balance does not double-count
  IF v_mp_id IS NOT NULL THEN
    INSERT INTO public.merchant_balance_transfers
      (merchant_user_id, key_mode, destination, amount, currency, note)
    VALUES (
      v_session.merchant_user_id, COALESCE(v_session.key_mode,'live'), 'wallet',
      v_wallet_amount, 'USD',
      CONCAT('Auto-settle for merchant_payment ', v_mp_id::text)
    );
  END IF;

  UPDATE public.merchant_checkout_sessions mcs
  SET status='paid', paid_at=now(),
      customer_name = COALESCE(v_customer_name, mcs.customer_name),
      customer_email = COALESCE(v_customer_email, v_buyer_email, mcs.customer_email),
      metadata = COALESCE(mcs.metadata,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'customer_phone', v_customer_phone, 'customer_address', v_customer_address)),
      updated_at = now()
  WHERE mcs.id = v_session.id;

  RETURN v_tx_id;
END;
$function$;

-- 3) Update virtual-card variant to auto-insert settlement marker
CREATE OR REPLACE FUNCTION public.pay_merchant_checkout_with_virtual_card(
  p_session_token text,
  p_card_number text,
  p_expiry_month integer,
  p_expiry_year integer,
  p_cvc text,
  p_note text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_existing_tx UUID;
  v_mp_id UUID;
BEGIN
  IF v_buyer_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_expiry_year > 0 AND v_expiry_year < 100 THEN v_expiry_year := 2000 + v_expiry_year; END IF;

  SELECT * INTO v_session FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, '')) FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout session not found'; END IF;

  IF v_session.status = 'paid' THEN
    SELECT mp.transaction_id INTO v_existing_tx
    FROM public.merchant_payments mp WHERE mp.session_id = v_session.id LIMIT 1;
    RETURN v_existing_tx;
  END IF;

  IF v_session.status <> 'open' THEN RAISE EXCEPTION 'Checkout session is not open'; END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions SET status='expired' WHERE id=v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  IF char_length(v_card_number) <> 16 THEN RAISE EXCEPTION 'Card number must be 16 digits'; END IF;
  IF p_expiry_month IS NULL OR p_expiry_month < 1 OR p_expiry_month > 12 THEN
    RAISE EXCEPTION 'Invalid expiry month'; END IF;
  IF v_expiry_year < 2026 THEN RAISE EXCEPTION 'Invalid expiry year'; END IF;
  IF char_length(v_cvc) <> 3 THEN RAISE EXCEPTION 'Invalid CVC'; END IF;

  v_expiry_end := (make_date(v_expiry_year, p_expiry_month, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  IF v_expiry_end < CURRENT_DATE THEN RAISE EXCEPTION 'Card expired'; END IF;

  SELECT vc.user_id INTO v_card_owner_user_id
  FROM public.virtual_cards vc
  WHERE vc.card_number = v_card_number
    AND vc.expiry_month = p_expiry_month
    AND vc.expiry_year = v_expiry_year
    AND vc.cvc = v_cvc
    AND vc.is_active = true
    AND COALESCE(vc.is_locked, false) = false
    AND COALESCE((vc.card_settings ->> 'allow_checkout')::BOOLEAN, true) = true
  FOR UPDATE;

  IF v_card_owner_user_id IS NULL THEN RAISE EXCEPTION 'Invalid virtual card details'; END IF;
  IF v_card_owner_user_id <> v_buyer_user_id THEN
    RAISE EXCEPTION 'Card owner does not match authenticated customer'; END IF;

  SELECT sc.usd_rate INTO v_currency_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_session.currency, 'USD')) AND sc.is_active=true
  LIMIT 1;
  v_currency_rate := COALESCE(NULLIF(v_currency_rate, 0), 1);
  v_wallet_amount := ROUND(COALESCE(v_session.total_amount, 0) / v_currency_rate, 2);
  IF v_wallet_amount <= 0 THEN RAISE EXCEPTION 'Checkout amount must be greater than zero'; END IF;

  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = v_card_owner_user_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Buyer wallet not found'; END IF;

  SELECT balance INTO v_receiver_balance FROM public.wallets WHERE user_id = v_session.merchant_user_id FOR UPDATE;
  IF v_receiver_balance IS NULL THEN RAISE EXCEPTION 'Merchant wallet not found'; END IF;

  IF v_sender_balance < v_wallet_amount THEN RAISE EXCEPTION 'Insufficient virtual card balance'; END IF;

  UPDATE public.wallets SET balance = v_sender_balance - v_wallet_amount, updated_at = now()
  WHERE user_id = v_card_owner_user_id;

  UPDATE public.wallets SET balance = v_receiver_balance + v_wallet_amount, updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_card_owner_user_id, v_session.merchant_user_id, v_wallet_amount,
    CONCAT('Merchant checkout ', v_session.session_token, ' | Card ****', RIGHT(v_card_number, 4),
      CASE WHEN COALESCE(TRIM(p_note), '') <> '' THEN CONCAT(' | ', TRIM(p_note)) ELSE '' END),
    'completed'
  ) RETURNING id INTO v_transaction_id;

  v_payment_link_id := NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL);
  v_payment_link_token := NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), '');

  INSERT INTO public.merchant_payments (
    session_id, merchant_user_id, buyer_user_id, transaction_id, amount,
    currency, api_key_id, key_mode, payment_link_id, payment_link_token, status
  ) VALUES (
    v_session.id, v_session.merchant_user_id, v_buyer_user_id, v_transaction_id,
    v_session.total_amount, v_session.currency, v_session.api_key_id,
    v_session.key_mode, v_payment_link_id, v_payment_link_token, 'succeeded'
  ) ON CONFLICT (session_id) DO NOTHING
  RETURNING id INTO v_mp_id;

  IF v_mp_id IS NOT NULL THEN
    INSERT INTO public.merchant_balance_transfers
      (merchant_user_id, key_mode, destination, amount, currency, note)
    VALUES (
      v_session.merchant_user_id, COALESCE(v_session.key_mode,'live'), 'wallet',
      v_wallet_amount, 'USD',
      CONCAT('Auto-settle for merchant_payment ', v_mp_id::text)
    );
  END IF;

  UPDATE public.merchant_checkout_sessions SET status='paid', paid_at=now() WHERE id=v_session.id;

  RETURN v_transaction_id;
END;
$function$;

-- 4) For 'complete_merchant_checkout_with_transaction' flow (transaction already credited the
--    wallet via the prior send-money), also auto-settle when we create the merchant_payments row.
CREATE OR REPLACE FUNCTION public.complete_merchant_checkout_with_transaction(
  p_session_token text,
  p_transaction_id uuid,
  p_note text DEFAULT ''::text,
  p_customer_name text DEFAULT NULL::text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_phone text DEFAULT NULL::text,
  p_customer_address text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_session public.merchant_checkout_sessions;
  v_tx public.transactions;
  v_existing_tx UUID;
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
  v_customer_name TEXT := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_customer_email TEXT := NULLIF(TRIM(COALESCE(p_customer_email, '')), '');
  v_customer_phone TEXT := NULLIF(TRIM(COALESCE(p_customer_phone, '')), '');
  v_customer_address TEXT := NULLIF(TRIM(COALESCE(p_customer_address, '')), '');
  v_buyer_email TEXT;
  v_session_usd_rate NUMERIC(20,8) := 1;
  v_expected_amount_usd NUMERIC(12,2) := 0;
  v_mp_id UUID;
BEGIN
  IF v_buyer_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_transaction_id IS NULL THEN RAISE EXCEPTION 'Transaction id is required'; END IF;

  SELECT email INTO v_buyer_email FROM auth.users WHERE id = v_buyer_user_id;

  SELECT * INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout session not found'; END IF;

  IF v_session.status = 'paid' THEN
    SELECT mp.transaction_id INTO v_existing_tx
    FROM public.merchant_payments mp WHERE mp.session_id = v_session.id LIMIT 1;
    UPDATE public.merchant_checkout_sessions mcs
    SET customer_name = COALESCE(v_customer_name, mcs.customer_name),
        customer_email = COALESCE(v_customer_email, v_buyer_email, mcs.customer_email),
        metadata = COALESCE(mcs.metadata, '{}'::jsonb) || jsonb_strip_nulls(
          jsonb_build_object('customer_phone', v_customer_phone, 'customer_address', v_customer_address)),
        updated_at = now()
    WHERE mcs.id = v_session.id;
    RETURN COALESCE(v_existing_tx, p_transaction_id);
  END IF;

  IF v_session.status <> 'open' THEN RAISE EXCEPTION 'Checkout session is not open'; END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions SET status = 'expired' WHERE id = v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  SELECT * INTO v_tx FROM public.transactions t WHERE t.id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF v_tx.status <> 'completed' THEN RAISE EXCEPTION 'Transaction is not completed'; END IF;
  IF v_tx.sender_id <> v_buyer_user_id THEN RAISE EXCEPTION 'Transaction sender does not match buyer'; END IF;
  IF v_tx.receiver_id <> v_session.merchant_user_id THEN RAISE EXCEPTION 'Transaction receiver does not match merchant'; END IF;

  SELECT sc.usd_rate INTO v_session_usd_rate
  FROM public.supported_currencies sc
  WHERE sc.iso_code = UPPER(COALESCE(v_session.currency, 'USD')) AND sc.is_active = true
  LIMIT 1;
  v_session_usd_rate := COALESCE(NULLIF(v_session_usd_rate, 0), 1);
  v_expected_amount_usd := ROUND(COALESCE(v_session.total_amount, 0) / v_session_usd_rate, 2);

  IF ABS(COALESCE(v_tx.amount, 0) - v_expected_amount_usd) > 0.02 THEN
    RAISE EXCEPTION 'Transaction amount does not match checkout amount';
  END IF;

  v_payment_link_id := NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL);
  v_payment_link_token := NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), '');

  INSERT INTO public.merchant_payments (
    session_id, merchant_user_id, buyer_user_id, transaction_id, amount,
    currency, api_key_id, key_mode, payment_link_id, payment_link_token, status
  ) VALUES (
    v_session.id, v_session.merchant_user_id, v_buyer_user_id, v_tx.id,
    v_session.total_amount, v_session.currency, v_session.api_key_id,
    v_session.key_mode, v_payment_link_id, v_payment_link_token, 'succeeded'
  ) ON CONFLICT (session_id) DO NOTHING
  RETURNING id INTO v_mp_id;

  -- Auto-settle: send-money already credited merchant wallet; mark as settled so available_balance does not double-count.
  IF v_mp_id IS NOT NULL THEN
    INSERT INTO public.merchant_balance_transfers
      (merchant_user_id, key_mode, destination, amount, currency, note)
    VALUES (
      v_session.merchant_user_id, COALESCE(v_session.key_mode,'live'), 'wallet',
      v_expected_amount_usd, 'USD',
      CONCAT('Auto-settle for merchant_payment ', v_mp_id::text)
    );
  END IF;

  UPDATE public.merchant_checkout_sessions mcs
  SET status = 'paid', paid_at = now(),
      customer_name = COALESCE(v_customer_name, mcs.customer_name),
      customer_email = COALESCE(v_customer_email, v_buyer_email, mcs.customer_email),
      metadata = COALESCE(mcs.metadata, '{}'::jsonb) || jsonb_strip_nulls(
        jsonb_build_object('customer_phone', v_customer_phone, 'customer_address', v_customer_address)),
      updated_at = now()
  WHERE mcs.id = v_session.id;

  IF COALESCE(TRIM(p_note), '') <> '' THEN
    UPDATE public.transactions SET note = CONCAT(COALESCE(note, ''), ' | ', TRIM(p_note))
    WHERE id = v_tx.id;
  END IF;

  RETURN v_tx.id;
END;
$function$;
