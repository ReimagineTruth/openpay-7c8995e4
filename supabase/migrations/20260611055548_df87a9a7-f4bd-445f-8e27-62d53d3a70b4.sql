
-- Make QR Pay transactions show up in OpenLedger, /activity, and notifications for both merchant and payer.

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
  p_payer_phone text,
  p_payer_user_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merchant_email text;
  v_payer_auth_email text;
  v_title text := COALESCE(NULLIF(p_pay.title,''), 'QR Payment');
  v_amount_str text := p_pay.currency || ' ' || to_char(p_amount, 'FM999999990.00');
  v_body text;
  v_note text;
  v_merchant_name text;
BEGIN
  v_note := 'QR Pay · ' || v_title || ' · ' || p_ref;

  SELECT full_name INTO v_merchant_name FROM public.profiles WHERE id = p_pay.merchant_user_id;

  -- Record in transactions ledger (drives /activity) when payer is known
  IF p_payer_user_id IS NOT NULL AND p_payer_user_id <> p_pay.merchant_user_id THEN
    BEGIN
      INSERT INTO public.transactions(id, sender_id, receiver_id, amount, note, status, created_at)
      VALUES (p_tx_id, p_payer_user_id, p_pay.merchant_user_id, p_amount, v_note, 'completed', now());
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;

  -- Record in OpenLedger
  BEGIN
    INSERT INTO public.ledger_events(
      source_table, source_id, event_type, actor_user_id, related_user_id,
      amount, status, note, payload, occurred_at
    ) VALUES (
      'qr_payment_transactions', p_tx_id, 'qr_pay_' || p_method,
      p_payer_user_id, p_pay.merchant_user_id,
      p_amount, 'succeeded', v_note,
      jsonb_build_object(
        'kind','qr_pay',
        'qr_payment_id', p_pay.id,
        'token', p_pay.token,
        'transaction_ref', p_ref,
        'currency', p_pay.currency,
        'method', p_method,
        'title', v_title,
        'payer_name', p_payer_name,
        'payer_email', p_payer_email
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Merchant in-app notification
  INSERT INTO public.app_notifications(user_id, title, message, type, metadata)
  VALUES (
    p_pay.merchant_user_id,
    'Payment received · ' || v_amount_str,
    COALESCE(p_payer_name,'A customer') || ' paid for "' || v_title || '" via ' || p_method,
    'success',
    jsonb_build_object(
      'kind','qr_pay','qr_payment_id', p_pay.id,'token', p_pay.token,
      'transaction_ref', p_ref,'amount', p_amount,'currency', p_pay.currency,
      'method', p_method,'payer_name', p_payer_name,'payer_email', p_payer_email,
      'payer_phone', p_payer_phone,'delivery_address', p_delivery_address,
      'delivery_notes', p_delivery_notes
    )
  );

  -- Payer in-app notification (logged-in payer)
  IF p_payer_user_id IS NOT NULL AND p_payer_user_id <> p_pay.merchant_user_id THEN
    INSERT INTO public.app_notifications(user_id, title, message, type, metadata)
    VALUES (
      p_payer_user_id,
      'Payment sent · ' || v_amount_str,
      'You paid ' || COALESCE(v_merchant_name,'merchant') || ' for "' || v_title || '" via ' || p_method,
      'info',
      jsonb_build_object(
        'kind','qr_pay_payer','qr_payment_id', p_pay.id,'token', p_pay.token,
        'transaction_ref', p_ref,'amount', p_amount,'currency', p_pay.currency,
        'method', p_method,'download_url', p_pay.download_url
      )
    );
  END IF;

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

  -- Customer email (use provided email; fall back to payer auth email)
  IF (p_payer_email IS NULL OR length(p_payer_email) < 4) AND p_payer_user_id IS NOT NULL THEN
    SELECT email INTO v_payer_auth_email FROM auth.users WHERE id = p_payer_user_id;
  END IF;
  IF p_payer_email IS NOT NULL AND length(p_payer_email) > 3 THEN
    v_payer_auth_email := p_payer_email;
  END IF;
  IF v_payer_auth_email IS NOT NULL AND length(v_payer_auth_email) > 3 THEN
    v_body := 'Thanks for your payment of ' || v_amount_str || '.' || E'\n\n' ||
              'Item: ' || v_title || E'\n' ||
              'Transaction ID: ' || p_ref || E'\n' ||
              'Method: ' || p_method || E'\n' ||
              CASE WHEN p_pay.after_payment_action = 'download' AND p_pay.download_url IS NOT NULL
                   THEN E'\nDownload your purchase: ' || p_pay.download_url || E'\n'
                   ELSE '' END ||
              E'\nKeep this Transaction ID for any disputes or claims.';
    INSERT INTO public.email_notifications_outbox(user_id, to_email, subject, body, payload)
    VALUES (COALESCE(p_payer_user_id, p_pay.merchant_user_id), v_payer_auth_email,
            'Your OpenPay receipt · ' || v_amount_str,
            v_body,
            jsonb_build_object('kind','qr_pay_customer','ref',p_ref,'token',p_pay.token,
                               'download_url', p_pay.download_url));
  END IF;
END;
$function$;

-- Update completion RPCs to pass payer_user_id

CREATE OR REPLACE FUNCTION public.qr_pay_complete_pi(
  p_token text, p_pi_payment_id text, p_pi_txid text,
  p_payer_name text DEFAULT NULL, p_payer_email text DEFAULT NULL,
  p_payer_username text DEFAULT NULL, p_amount numeric DEFAULT NULL,
  p_payer_phone text DEFAULT NULL, p_delivery_address text DEFAULT NULL,
  p_delivery_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    p_payer_name, p_payer_email, p_delivery_address, p_delivery_notes, p_payer_phone, v_user);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_pay_complete_wallet(
  p_token text, p_payer_name text DEFAULT NULL, p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL, p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL, p_delivery_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    p_payer_name, p_payer_email, p_delivery_address, p_delivery_notes, p_payer_phone, v_user);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.qr_pay_complete_virtual_card(
  p_token text, p_card_number text, p_cvc text,
  p_payer_name text DEFAULT NULL, p_payer_email text DEFAULT NULL,
  p_amount numeric DEFAULT NULL, p_payer_phone text DEFAULT NULL,
  p_delivery_address text DEFAULT NULL, p_delivery_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    p_payer_name, p_payer_email, p_delivery_address, p_delivery_notes, p_payer_phone, v_user);
  RETURN jsonb_build_object('transaction_ref', v_ref, 'amount', v_amount);
END;
$$;
