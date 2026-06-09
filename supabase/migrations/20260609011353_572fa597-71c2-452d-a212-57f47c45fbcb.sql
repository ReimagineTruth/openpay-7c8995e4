ALTER TABLE public.qr_payments
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'product' CHECK (payment_type IN ('product','digital','donation','tip')),
  ADD COLUMN IF NOT EXISTS after_payment_action text NOT NULL DEFAULT 'receipt' CHECK (after_payment_action IN ('receipt','download','redirect')),
  ADD COLUMN IF NOT EXISTS download_url text,
  ADD COLUMN IF NOT EXISTS redirect_url text,
  ADD COLUMN IF NOT EXISTS suggested_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS min_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS allow_custom_amount boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_url text;

CREATE OR REPLACE FUNCTION public.qr_pay_calc_charge_amount(
  p_payment public.qr_payments,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_amount numeric(14,2);
BEGIN
  IF p_payment.payment_type IN ('donation', 'tip') OR p_payment.allow_custom_amount THEN
    v_amount := round(COALESCE(p_amount, p_payment.suggested_amount, p_payment.total, 0)::numeric, 2);
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'amount_required';
    END IF;
    IF p_payment.min_amount IS NOT NULL AND v_amount < p_payment.min_amount THEN
      RAISE EXCEPTION 'amount_below_minimum';
    END IF;
    RETURN v_amount;
  END IF;

  v_amount := round(COALESCE(p_payment.total, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_payment_total';
  END IF;
  RETURN v_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_pay_create(
  p_title text,
  p_description text,
  p_currency text,
  p_items jsonb,
  p_allow_pi boolean DEFAULT true,
  p_allow_wallet boolean DEFAULT true,
  p_allow_virtual_card boolean DEFAULT true,
  p_allow_guest boolean DEFAULT true,
  p_reusable boolean DEFAULT false,
  p_expires_minutes integer DEFAULT NULL,
  p_payment_type text DEFAULT 'product',
  p_after_payment_action text DEFAULT 'receipt',
  p_download_url text DEFAULT NULL,
  p_redirect_url text DEFAULT NULL,
  p_suggested_amount numeric DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_allow_custom_amount boolean DEFAULT false,
  p_cover_image_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_token text;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_qty integer;
  v_price numeric(14,2);
  v_line numeric(14,2);
  v_idx integer := 0;
  v_expires timestamptz;
  v_payment_type text := COALESCE(p_payment_type, 'product');
  v_after_action text := COALESCE(p_after_payment_action, 'receipt');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF COALESCE(p_allow_pi, false) = false AND COALESCE(p_allow_wallet, false) = false AND COALESCE(p_allow_virtual_card, false) = false THEN
    RAISE EXCEPTION 'payment_method_required';
  END IF;
  IF v_payment_type NOT IN ('product','digital','donation','tip') THEN
    RAISE EXCEPTION 'invalid_payment_type';
  END IF;
  IF v_after_action NOT IN ('receipt','download','redirect') THEN
    RAISE EXCEPTION 'invalid_after_payment_action';
  END IF;
  IF v_after_action = 'download' AND NULLIF(trim(COALESCE(p_download_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'download_url_required';
  END IF;
  IF v_after_action = 'redirect' AND NULLIF(trim(COALESCE(p_redirect_url, '')), '') IS NULL THEN
    RAISE EXCEPTION 'redirect_url_required';
  END IF;
  IF (v_payment_type IN ('donation','tip') OR COALESCE(p_allow_custom_amount, false)) AND COALESCE(p_suggested_amount, 0) <= 0 AND COALESCE(p_min_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'amount_configuration_required';
  END IF;
  IF p_min_amount IS NOT NULL AND p_min_amount < 0 THEN
    RAISE EXCEPTION 'invalid_min_amount';
  END IF;
  IF p_suggested_amount IS NOT NULL AND p_suggested_amount < 0 THEN
    RAISE EXCEPTION 'invalid_suggested_amount';
  END IF;

  IF p_expires_minutes IS NOT NULL AND p_expires_minutes > 0 THEN
    v_expires := now() + make_interval(mins => p_expires_minutes);
  END IF;

  IF v_payment_type IN ('donation','tip') OR COALESCE(p_allow_custom_amount, false) THEN
    v_total := round(COALESCE(p_suggested_amount, p_min_amount, 0)::numeric, 2);
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'items_required';
    END IF;
  END IF;

  v_token := public.qr_pay_gen_token();

  INSERT INTO public.qr_payments(
    merchant_user_id,
    token,
    title,
    description,
    currency,
    subtotal,
    total,
    allow_pi,
    allow_wallet,
    allow_virtual_card,
    allow_guest,
    reusable,
    expires_at,
    payment_type,
    after_payment_action,
    download_url,
    redirect_url,
    suggested_amount,
    min_amount,
    allow_custom_amount,
    cover_image_url
  ) VALUES (
    v_user,
    v_token,
    COALESCE(p_title, ''),
    p_description,
    COALESCE(p_currency, 'USD'),
    v_total,
    v_total,
    COALESCE(p_allow_pi, true),
    COALESCE(p_allow_wallet, true),
    COALESCE(p_allow_virtual_card, true),
    COALESCE(p_allow_guest, true),
    COALESCE(p_reusable, false),
    v_expires,
    v_payment_type,
    v_after_action,
    NULLIF(trim(COALESCE(p_download_url, '')), ''),
    NULLIF(trim(COALESCE(p_redirect_url, '')), ''),
    CASE WHEN p_suggested_amount IS NULL THEN NULL ELSE round(p_suggested_amount::numeric, 2) END,
    CASE WHEN p_min_amount IS NULL THEN NULL ELSE round(p_min_amount::numeric, 2) END,
    COALESCE(p_allow_custom_amount, false) OR v_payment_type IN ('donation','tip'),
    NULLIF(trim(COALESCE(p_cover_image_url, '')), '')
  ) RETURNING id INTO v_id;

  IF NOT (v_payment_type IN ('donation','tip') OR COALESCE(p_allow_custom_amount, false)) THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_qty := GREATEST(COALESCE((v_item->>'quantity')::integer, 1), 1);
      v_price := round(COALESCE((v_item->>'unit_price')::numeric, 0)::numeric, 2);
      v_line := round((v_qty * v_price)::numeric, 2);
      v_total := v_total + v_line;

      INSERT INTO public.qr_payment_items(
        qr_payment_id,
        name,
        description,
        image_url,
        quantity,
        unit_price,
        line_total,
        position
      ) VALUES (
        v_id,
        COALESCE(NULLIF(trim(COALESCE(v_item->>'name', '')), ''), 'Item'),
        NULLIF(trim(COALESCE(v_item->>'description', '')), ''),
        NULLIF(trim(COALESCE(v_item->>'image_url', '')), ''),
        v_qty,
        v_price,
        v_line,
        v_idx
      );
      v_idx := v_idx + 1;
    END LOOP;

    IF v_total <= 0 THEN
      RAISE EXCEPTION 'items_total_invalid';
    END IF;

    UPDATE public.qr_payments
    SET subtotal = v_total,
        total = v_total
    WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'total', v_total,
    'checkout_url', '/qr-pay/' || v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_create(text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,integer,text,text,text,text,numeric,numeric,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.qr_pay_get_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_pay public.qr_payments;
  v_items jsonb;
  v_merchant jsonb;
BEGIN
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;

  IF v_pay.expires_at IS NOT NULL AND v_pay.expires_at < now() AND v_pay.status = 'active' THEN
    UPDATE public.qr_payments SET status = 'expired' WHERE id = v_pay.id;
    SELECT * INTO v_pay FROM public.qr_payments WHERE id = v_pay.id;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'name', name,
    'description', description,
    'image_url', image_url,
    'quantity', quantity,
    'unit_price', unit_price,
    'line_total', line_total
  ) ORDER BY position)
  INTO v_items
  FROM public.qr_payment_items
  WHERE qr_payment_id = v_pay.id;

  SELECT jsonb_build_object(
    'id', id,
    'full_name', full_name,
    'username', username,
    'avatar_url', avatar_url
  )
  INTO v_merchant
  FROM public.profiles
  WHERE id = v_pay.merchant_user_id;

  RETURN jsonb_build_object(
    'id', v_pay.id,
    'token', v_pay.token,
    'title', v_pay.title,
    'description', v_pay.description,
    'currency', v_pay.currency,
    'subtotal', v_pay.subtotal,
    'total', v_pay.total,
    'status', v_pay.status,
    'allow_pi', v_pay.allow_pi,
    'allow_wallet', v_pay.allow_wallet,
    'allow_virtual_card', v_pay.allow_virtual_card,
    'allow_guest', v_pay.allow_guest,
    'reusable', v_pay.reusable,
    'expires_at', v_pay.expires_at,
    'payment_type', v_pay.payment_type,
    'after_payment_action', v_pay.after_payment_action,
    'download_url', v_pay.download_url,
    'redirect_url', v_pay.redirect_url,
    'suggested_amount', v_pay.suggested_amount,
    'min_amount', v_pay.min_amount,
    'allow_custom_amount', v_pay.allow_custom_amount,
    'cover_image_url', v_pay.cover_image_url,
    'merchant', v_merchant,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_get_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.qr_pay_complete_wallet(
  p_token text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid;
  v_payer_profile public.profiles;
  v_charge_amount numeric(14,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_wallet THEN RAISE EXCEPTION 'wallet_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  v_charge_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'no_wallet'; END IF;
  IF v_balance < v_charge_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_payer_profile FROM public.profiles WHERE id = v_user;

  UPDATE public.wallets
  SET balance = balance - v_charge_amount,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.wallets(user_id, balance)
  VALUES (v_pay.merchant_user_id, v_charge_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.wallets.balance + EXCLUDED.balance,
      updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.qr_payment_transactions(
    qr_payment_id,
    merchant_user_id,
    payer_user_id,
    payer_name,
    payer_email,
    payer_username,
    method,
    amount,
    currency,
    status,
    transaction_ref,
    paid_at
  ) VALUES (
    v_pay.id,
    v_pay.merchant_user_id,
    v_user,
    COALESCE(NULLIF(trim(COALESCE(p_payer_name, '')), ''), v_payer_profile.full_name),
    NULLIF(trim(COALESCE(p_payer_email, '')), ''),
    v_payer_profile.username,
    'wallet',
    v_charge_amount,
    v_pay.currency,
    'succeeded',
    v_ref,
    now()
  ) RETURNING id INTO v_tx_id;

  PERFORM public._qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'transaction_ref', v_ref,
    'amount', v_charge_amount,
    'currency', v_pay.currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_wallet(text,text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.qr_pay_complete_virtual_card(
  p_token text,
  p_card_number text,
  p_cvc text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_card public.virtual_cards;
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid;
  v_payer_profile public.profiles;
  v_charge_amount numeric(14,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_virtual_card THEN RAISE EXCEPTION 'card_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  v_charge_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  SELECT * INTO v_card FROM public.virtual_cards WHERE user_id = v_user ORDER BY created_at DESC LIMIT 1;
  IF v_card.id IS NULL THEN RAISE EXCEPTION 'no_card'; END IF;
  IF COALESCE(v_card.is_locked, false) OR NOT COALESCE(v_card.is_active, false) THEN RAISE EXCEPTION 'card_inactive'; END IF;
  IF replace(COALESCE(v_card.card_number, ''), ' ', '') <> replace(COALESCE(p_card_number, ''), ' ', '') THEN RAISE EXCEPTION 'card_mismatch'; END IF;
  IF COALESCE(v_card.cvc, '') <> COALESCE(p_cvc, '') THEN RAISE EXCEPTION 'cvc_mismatch'; END IF;

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_charge_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_payer_profile FROM public.profiles WHERE id = v_user;

  UPDATE public.wallets
  SET balance = balance - v_charge_amount,
      updated_at = now()
  WHERE user_id = v_user;

  INSERT INTO public.wallets(user_id, balance)
  VALUES (v_pay.merchant_user_id, v_charge_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.wallets.balance + EXCLUDED.balance,
      updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.qr_payment_transactions(
    qr_payment_id,
    merchant_user_id,
    payer_user_id,
    payer_name,
    payer_email,
    payer_username,
    method,
    amount,
    currency,
    status,
    transaction_ref,
    paid_at,
    provider_payload
  ) VALUES (
    v_pay.id,
    v_pay.merchant_user_id,
    v_user,
    COALESCE(NULLIF(trim(COALESCE(p_payer_name, '')), ''), v_payer_profile.full_name),
    NULLIF(trim(COALESCE(p_payer_email, '')), ''),
    v_payer_profile.username,
    'virtual_card',
    v_charge_amount,
    v_pay.currency,
    'succeeded',
    v_ref,
    now(),
    jsonb_build_object('card_last4', right(COALESCE(v_card.card_number, ''), 4))
  ) RETURNING id INTO v_tx_id;

  PERFORM public._qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'transaction_ref', v_ref,
    'amount', v_charge_amount,
    'currency', v_pay.currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_virtual_card(text,text,text,text,text,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.qr_pay_complete_pi(
  p_token text,
  p_pi_payment_id text,
  p_pi_txid text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_payer_username text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_ref text;
  v_tx_id uuid;
  v_charge_amount numeric(14,2);
BEGIN
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_pi THEN RAISE EXCEPTION 'pi_not_allowed'; END IF;
  IF v_user IS NULL AND NOT v_pay.allow_guest THEN RAISE EXCEPTION 'guest_not_allowed'; END IF;

  v_charge_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  INSERT INTO public.wallets(user_id, balance)
  VALUES (v_pay.merchant_user_id, v_charge_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET balance = public.wallets.balance + EXCLUDED.balance,
      updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.qr_payment_transactions(
    qr_payment_id,
    merchant_user_id,
    payer_user_id,
    payer_name,
    payer_email,
    payer_username,
    method,
    amount,
    currency,
    status,
    transaction_ref,
    pi_payment_id,
    pi_txid,
    paid_at,
    provider_payload
  ) VALUES (
    v_pay.id,
    v_pay.merchant_user_id,
    v_user,
    NULLIF(trim(COALESCE(p_payer_name, '')), ''),
    NULLIF(trim(COALESCE(p_payer_email, '')), ''),
    NULLIF(trim(COALESCE(p_payer_username, '')), ''),
    'pi',
    v_charge_amount,
    v_pay.currency,
    'succeeded',
    v_ref,
    p_pi_payment_id,
    p_pi_txid,
    now(),
    jsonb_build_object('pi_payment_id', p_pi_payment_id, 'pi_txid', p_pi_txid)
  ) RETURNING id INTO v_tx_id;

  PERFORM public._qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'transaction_ref', v_ref,
    'amount', v_charge_amount,
    'currency', v_pay.currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_pi(text,text,text,text,text,text,numeric) TO anon, authenticated;