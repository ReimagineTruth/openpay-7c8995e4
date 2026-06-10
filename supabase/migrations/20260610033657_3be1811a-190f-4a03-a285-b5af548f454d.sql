
-- 1. New columns
ALTER TABLE public.qr_payments
  ADD COLUMN IF NOT EXISTS collect_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fields jsonb NOT NULL DEFAULT '["name","email","address"]'::jsonb;

ALTER TABLE public.qr_payment_transactions
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_notes text;

-- 2. Restrict public reads to the security-definer RPC only
DROP POLICY IF EXISTS "Public can read active qr_payments by token" ON public.qr_payments;
DROP POLICY IF EXISTS "Public read items of active qr_payments" ON public.qr_payment_items;

-- 3. Drop old function overloads
DROP FUNCTION IF EXISTS public.qr_pay_complete_wallet(text, text, text);
DROP FUNCTION IF EXISTS public.qr_pay_complete_wallet(text, text, text, numeric);
DROP FUNCTION IF EXISTS public.qr_pay_complete_virtual_card(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.qr_pay_complete_virtual_card(text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.qr_pay_complete_pi(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.qr_pay_complete_pi(text, text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.qr_pay_create(text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer);
DROP FUNCTION IF EXISTS public.qr_pay_create(text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer, text, text, text, text, numeric, numeric, boolean, text);
DROP FUNCTION IF EXISTS public.qr_pay_get_by_token(text);

-- 4. Helper: settle a transaction (insert tx row, notify, enqueue emails)
CREATE OR REPLACE FUNCTION public.qr_pay__notify_and_email(
  p_pay public.qr_payments,
  p_tx_id uuid,
  p_amount numeric,
  p_method text,
  p_ref text,
  p_payer_name text,
  p_payer_email text,
  p_delivery_address text,
  p_delivery_notes text,
  p_payer_phone text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_email text;
  v_title text := COALESCE(NULLIF(p_pay.title,''), 'QR Payment');
  v_amount_str text := p_pay.currency || ' ' || to_char(p_amount, 'FM999999990.00');
  v_body text;
BEGIN
  -- In-app notification for the merchant
  INSERT INTO public.app_notifications(user_id, title, message, type, metadata)
  VALUES (
    p_pay.merchant_user_id,
    'Payment received · ' || v_amount_str,
    COALESCE(p_payer_name,'A customer') || ' paid for "' || v_title || '" via ' || p_method,
    'success',
    jsonb_build_object(
      'kind','qr_pay',
      'qr_payment_id', p_pay.id,
      'token', p_pay.token,
      'transaction_ref', p_ref,
      'amount', p_amount,
      'currency', p_pay.currency,
      'method', p_method,
      'payer_name', p_payer_name,
      'payer_email', p_payer_email,
      'payer_phone', p_payer_phone,
      'delivery_address', p_delivery_address,
      'delivery_notes', p_delivery_notes
    )
  );

  -- Merchant email
  SELECT email INTO v_merchant_email FROM auth.users WHERE id = p_pay.merchant_user_id;
  IF v_merchant_email IS NOT NULL THEN
    v_body := 'You received ' || v_amount_str || ' for "' || v_title || '".' || E'\n\n' ||
              'Method: ' || p_method || E'\n' ||
              'Transaction ID: ' || p_ref || E'\n' ||
              'Customer: ' || COALESCE(p_payer_name,'(guest)') ||
              CASE WHEN p_payer_email IS NOT NULL THEN ' <' || p_payer_email || '>' ELSE '' END || E'\n' ||
              CASE WHEN p_payer_phone IS NOT NULL THEN 'Phone: ' || p_payer_phone || E'\n' ELSE '' END ||
              CASE WHEN p_delivery_address IS NOT NULL THEN E'\nShip to:\n' || p_delivery_address || E'\n' ELSE '' END ||
              CASE WHEN p_delivery_notes IS NOT NULL THEN E'\nNotes: ' || p_delivery_notes || E'\n' ELSE '' END;
    INSERT INTO public.email_notifications_outbox(user_id, to_email, subject, body, payload)
    VALUES (p_pay.merchant_user_id, v_merchant_email,
            'Payment received · ' || v_amount_str || ' · ' || v_title,
            v_body,
            jsonb_build_object('kind','qr_pay_merchant','ref',p_ref,'token',p_pay.token));
  END IF;

  -- Customer email (receipt + download link if applicable)
  IF p_payer_email IS NOT NULL AND length(p_payer_email) > 3 THEN
    v_body := 'Thanks for your payment of ' || v_amount_str || '.' || E'\n\n' ||
              'Item: ' || v_title || E'\n' ||
              'Transaction ID: ' || p_ref || E'\n' ||
              'Method: ' || p_method || E'\n' ||
              CASE WHEN p_pay.after_payment_action = 'download' AND p_pay.download_url IS NOT NULL
                   THEN E'\nDownload your purchase: ' || p_pay.download_url || E'\n'
                   ELSE '' END ||
              E'\nKeep this Transaction ID for any disputes or claims.';
    INSERT INTO public.email_notifications_outbox(user_id, to_email, subject, body, payload)
    VALUES (p_pay.merchant_user_id, p_payer_email,
            'Your OpenPay receipt · ' || v_amount_str,
            v_body,
            jsonb_build_object('kind','qr_pay_customer','ref',p_ref,'token',p_pay.token,
                               'download_url', p_pay.download_url));
  END IF;
END;
$$;

-- 5. qr_pay_create (with collect_delivery)
CREATE OR REPLACE FUNCTION public.qr_pay_create(
  p_title text,
  p_description text,
  p_currency text,
  p_items jsonb,
  p_allow_pi boolean,
  p_allow_wallet boolean,
  p_allow_virtual_card boolean,
  p_allow_guest boolean,
  p_reusable boolean,
  p_expires_minutes integer,
  p_payment_type text DEFAULT 'product',
  p_after_payment_action text DEFAULT 'receipt',
  p_download_url text DEFAULT NULL,
  p_redirect_url text DEFAULT NULL,
  p_suggested_amount numeric DEFAULT NULL,
  p_min_amount numeric DEFAULT NULL,
  p_allow_custom_amount boolean DEFAULT false,
  p_cover_image_url text DEFAULT NULL,
  p_collect_delivery boolean DEFAULT false,
  p_delivery_fields jsonb DEFAULT '["name","email","address"]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_token text;
  v_subtotal numeric(14,2) := 0;
  v_total numeric(14,2) := 0;
  v_item jsonb;
  v_pos int := 0;
  v_expires timestamptz;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_currency IS NULL OR length(p_currency) < 3 THEN RAISE EXCEPTION 'currency_required'; END IF;

  IF p_payment_type IN ('donation','tip') THEN
    v_total := COALESCE(p_suggested_amount, 0);
    v_subtotal := v_total;
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'items_required';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_subtotal := v_subtotal + (COALESCE((v_item->>'quantity')::int,1) * COALESCE((v_item->>'unit_price')::numeric,0));
    END LOOP;
    v_total := v_subtotal;
    IF v_total <= 0 THEN RAISE EXCEPTION 'total_zero'; END IF;
  END IF;

  IF p_expires_minutes IS NOT NULL AND p_expires_minutes > 0 THEN
    v_expires := now() + (p_expires_minutes || ' minutes')::interval;
  END IF;

  v_token := public.qr_pay_gen_token();
  v_id := gen_random_uuid();

  INSERT INTO public.qr_payments(
    id, merchant_user_id, token, title, description, currency, subtotal, total, status,
    allow_pi, allow_wallet, allow_virtual_card, allow_guest, reusable, expires_at,
    payment_type, after_payment_action, download_url, redirect_url,
    suggested_amount, min_amount, allow_custom_amount, cover_image_url,
    collect_delivery, delivery_fields
  ) VALUES (
    v_id, v_user, v_token, COALESCE(p_title,''), p_description, upper(p_currency),
    v_subtotal, v_total, 'active',
    COALESCE(p_allow_pi,true), COALESCE(p_allow_wallet,true), COALESCE(p_allow_virtual_card,true),
    COALESCE(p_allow_guest,true), COALESCE(p_reusable,false), v_expires,
    COALESCE(p_payment_type,'product'), COALESCE(p_after_payment_action,'receipt'),
    p_download_url, p_redirect_url,
    p_suggested_amount, p_min_amount, COALESCE(p_allow_custom_amount,false), p_cover_image_url,
    COALESCE(p_collect_delivery,false), COALESCE(p_delivery_fields,'["name","email","address"]'::jsonb)
  );

  IF p_payment_type NOT IN ('donation','tip') THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.qr_payment_items(qr_payment_id, name, description, image_url, quantity, unit_price, line_total, position)
      VALUES (v_id,
              COALESCE(v_item->>'name','Item'),
              v_item->>'description',
              v_item->>'image_url',
              COALESCE((v_item->>'quantity')::int,1),
              COALESCE((v_item->>'unit_price')::numeric,0),
              COALESCE((v_item->>'quantity')::int,1) * COALESCE((v_item->>'unit_price')::numeric,0),
              v_pos);
      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'total', v_total);
END;
$$;

-- 6. qr_pay_get_by_token (adds collect_delivery & delivery_fields)
CREATE OR REPLACE FUNCTION public.qr_pay_get_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    'id', id, 'name', name, 'description', description, 'image_url', image_url,
    'quantity', quantity, 'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY position)
  INTO v_items FROM public.qr_payment_items WHERE qr_payment_id = v_pay.id;

  SELECT jsonb_build_object('id', id, 'full_name', full_name, 'username', username, 'avatar_url', avatar_url)
  INTO v_merchant FROM public.profiles WHERE id = v_pay.merchant_user_id;

  RETURN jsonb_build_object(
    'id', v_pay.id, 'token', v_pay.token, 'title', v_pay.title, 'description', v_pay.description,
    'currency', v_pay.currency, 'subtotal', v_pay.subtotal, 'total', v_pay.total, 'status', v_pay.status,
    'allow_pi', v_pay.allow_pi, 'allow_wallet', v_pay.allow_wallet,
    'allow_virtual_card', v_pay.allow_virtual_card, 'allow_guest', v_pay.allow_guest,
    'reusable', v_pay.reusable, 'expires_at', v_pay.expires_at,
    'payment_type', v_pay.payment_type, 'after_payment_action', v_pay.after_payment_action,
    'download_url', v_pay.download_url, 'redirect_url', v_pay.redirect_url,
    'suggested_amount', v_pay.suggested_amount, 'min_amount', v_pay.min_amount,
    'allow_custom_amount', v_pay.allow_custom_amount, 'cover_image_url', v_pay.cover_image_url,
    'collect_delivery', v_pay.collect_delivery, 'delivery_fields', v_pay.delivery_fields,
    'merchant', v_merchant, 'items', COALESCE(v_items,'[]'::jsonb)
  );
END;
$$;

-- 7. qr_pay_complete_wallet
CREATE OR REPLACE FUNCTION public.qr_pay_complete_wallet(
  p_token text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_amount numeric(14,2);
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid := gen_random_uuid();
  v_username text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_wallet THEN RAISE EXCEPTION 'wallet_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  v_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.wallets SET balance = balance - v_amount, updated_at = now() WHERE user_id = v_user;
  INSERT INTO public.wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + v_amount, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  SELECT username INTO v_username FROM public.profiles WHERE id = v_user;

  INSERT INTO public.qr_payment_transactions(
    id, qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at,
    payer_phone, delivery_address, delivery_notes
  ) VALUES (
    v_tx_id, v_pay.id, v_pay.merchant_user_id, v_user, p_payer_name, p_payer_email, v_username,
    'wallet', v_amount, v_pay.currency, 'succeeded', v_ref, now(),
    p_payer_phone, p_delivery_address, p_delivery_notes
  );

  IF NOT v_pay.reusable THEN
    UPDATE public.qr_payments SET status = 'paid' WHERE id = v_pay.id;
  END IF;

  PERFORM public.qr_pay__notify_and_email(v_pay, v_tx_id, v_amount, 'wallet', v_ref,
                                          p_payer_name, p_payer_email, p_delivery_address,
                                          p_delivery_notes, p_payer_phone);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;

-- 8. qr_pay_complete_virtual_card  (drops is_active requirement)
CREATE OR REPLACE FUNCTION public.qr_pay_complete_virtual_card(
  p_token text,
  p_card_number text,
  p_cvc text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_card public.virtual_cards;
  v_amount numeric(14,2);
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid := gen_random_uuid();
  v_username text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_virtual_card THEN RAISE EXCEPTION 'card_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  SELECT * INTO v_card FROM public.virtual_cards WHERE user_id = v_user;
  IF v_card.id IS NULL THEN RAISE EXCEPTION 'no_card'; END IF;
  IF v_card.is_locked THEN RAISE EXCEPTION 'card_locked'; END IF;
  IF replace(v_card.card_number,' ','') <> replace(p_card_number,' ','') THEN RAISE EXCEPTION 'card_mismatch'; END IF;
  IF v_card.cvc <> p_cvc THEN RAISE EXCEPTION 'cvc_mismatch'; END IF;

  -- Auto-activate first use
  IF NOT v_card.is_active THEN
    UPDATE public.virtual_cards SET is_active = true, updated_at = now() WHERE id = v_card.id;
  END IF;

  v_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  SELECT balance INTO v_balance FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.wallets SET balance = balance - v_amount, updated_at = now() WHERE user_id = v_user;
  INSERT INTO public.wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + v_amount, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
  SELECT username INTO v_username FROM public.profiles WHERE id = v_user;

  INSERT INTO public.qr_payment_transactions(
    id, qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at,
    payer_phone, delivery_address, delivery_notes
  ) VALUES (
    v_tx_id, v_pay.id, v_pay.merchant_user_id, v_user, p_payer_name, p_payer_email, v_username,
    'virtual_card', v_amount, v_pay.currency, 'succeeded', v_ref, now(),
    p_payer_phone, p_delivery_address, p_delivery_notes
  );

  IF NOT v_pay.reusable THEN
    UPDATE public.qr_payments SET status = 'paid' WHERE id = v_pay.id;
  END IF;

  PERFORM public.qr_pay__notify_and_email(v_pay, v_tx_id, v_amount, 'virtual_card', v_ref,
                                          p_payer_name, p_payer_email, p_delivery_address,
                                          p_delivery_notes, p_payer_phone);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;

-- 9. qr_pay_complete_pi
CREATE OR REPLACE FUNCTION public.qr_pay_complete_pi(
  p_token text,
  p_pi_payment_id text,
  p_pi_txid text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_payer_username text DEFAULT NULL,
  p_amount numeric DEFAULT NULL,
  p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay public.qr_payments;
  v_amount numeric(14,2);
  v_ref text;
  v_tx_id uuid := gen_random_uuid();
BEGIN
  SELECT * INTO v_pay FROM public.qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_pi THEN RAISE EXCEPTION 'pi_not_allowed'; END IF;

  v_amount := public.qr_pay_calc_charge_amount(v_pay, p_amount);

  -- Credit merchant wallet ONCE in QR Pay currency units
  INSERT INTO public.wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + v_amount, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  INSERT INTO public.qr_payment_transactions(
    id, qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at, pi_payment_id, pi_txid,
    payer_phone, delivery_address, delivery_notes
  ) VALUES (
    v_tx_id, v_pay.id, v_pay.merchant_user_id, v_user, p_payer_name, p_payer_email, p_payer_username,
    'pi', v_amount, v_pay.currency, 'succeeded', v_ref, now(), p_pi_payment_id, p_pi_txid,
    p_payer_phone, p_delivery_address, p_delivery_notes
  );

  IF NOT v_pay.reusable THEN
    UPDATE public.qr_payments SET status = 'paid' WHERE id = v_pay.id;
  END IF;

  PERFORM public.qr_pay__notify_and_email(v_pay, v_tx_id, v_amount, 'pi', v_ref,
                                          p_payer_name, p_payer_email, p_delivery_address,
                                          p_delivery_notes, p_payer_phone);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;

-- 10. Grants
GRANT EXECUTE ON FUNCTION public.qr_pay_create(text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,integer,text,text,text,text,numeric,numeric,boolean,text,boolean,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_pay_get_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.qr_pay_complete_wallet(text,text,text,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_pay_complete_virtual_card(text,text,text,text,text,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_pay_complete_pi(text,text,text,text,text,text,numeric,text,text,text) TO anon, authenticated;
