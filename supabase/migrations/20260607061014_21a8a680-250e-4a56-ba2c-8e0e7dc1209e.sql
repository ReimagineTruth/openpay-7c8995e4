
-- ============ QR Pay tables ============

CREATE TABLE public.qr_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  description text,
  currency text NOT NULL DEFAULT 'USD',
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paid','expired','cancelled')),
  allow_pi boolean NOT NULL DEFAULT true,
  allow_wallet boolean NOT NULL DEFAULT true,
  allow_virtual_card boolean NOT NULL DEFAULT true,
  allow_guest boolean NOT NULL DEFAULT true,
  reusable boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_payments_merchant ON public.qr_payments(merchant_user_id, created_at DESC);
CREATE INDEX idx_qr_payments_status ON public.qr_payments(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_payments TO authenticated;
GRANT SELECT ON public.qr_payments TO anon;
GRANT ALL ON public.qr_payments TO service_role;

ALTER TABLE public.qr_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own qr_payments"
  ON public.qr_payments FOR ALL TO authenticated
  USING (merchant_user_id = auth.uid())
  WITH CHECK (merchant_user_id = auth.uid());

CREATE POLICY "Public can read active qr_payments by token"
  ON public.qr_payments FOR SELECT TO anon, authenticated
  USING (status = 'active');

-- ============ items ============

CREATE TABLE public.qr_payment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_payment_id uuid NOT NULL REFERENCES public.qr_payments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14,2) NOT NULL CHECK (line_total >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_payment_items_parent ON public.qr_payment_items(qr_payment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_payment_items TO authenticated;
GRANT SELECT ON public.qr_payment_items TO anon;
GRANT ALL ON public.qr_payment_items TO service_role;

ALTER TABLE public.qr_payment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants manage own qr_payment_items"
  ON public.qr_payment_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.qr_payments p WHERE p.id = qr_payment_id AND p.merchant_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.qr_payments p WHERE p.id = qr_payment_id AND p.merchant_user_id = auth.uid()));

CREATE POLICY "Public read items of active qr_payments"
  ON public.qr_payment_items FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.qr_payments p WHERE p.id = qr_payment_id AND p.status = 'active'));

-- ============ transactions ============

CREATE TABLE public.qr_payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_payment_id uuid NOT NULL REFERENCES public.qr_payments(id) ON DELETE CASCADE,
  merchant_user_id uuid NOT NULL,
  payer_user_id uuid,
  payer_name text,
  payer_email text,
  payer_username text,
  method text NOT NULL CHECK (method IN ('pi','wallet','virtual_card')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','refunded')),
  transaction_ref text NOT NULL UNIQUE,
  pi_payment_id text,
  pi_txid text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qr_pay_tx_merchant ON public.qr_payment_transactions(merchant_user_id, created_at DESC);
CREATE INDEX idx_qr_pay_tx_payment ON public.qr_payment_transactions(qr_payment_id);

GRANT SELECT ON public.qr_payment_transactions TO authenticated;
GRANT ALL ON public.qr_payment_transactions TO service_role;

ALTER TABLE public.qr_payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants view own qr_payment_transactions"
  ON public.qr_payment_transactions FOR SELECT TO authenticated
  USING (merchant_user_id = auth.uid());

CREATE POLICY "Payers view own qr_payment_transactions"
  ON public.qr_payment_transactions FOR SELECT TO authenticated
  USING (payer_user_id = auth.uid());

-- ============ updated_at trigger ============

CREATE OR REPLACE FUNCTION public.qr_payments_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER qr_payments_updated_at
  BEFORE UPDATE ON public.qr_payments
  FOR EACH ROW EXECUTE FUNCTION public.qr_payments_set_updated_at();

-- ============ helper: gen tokens / refs ============

CREATE OR REPLACE FUNCTION public.qr_pay_gen_token()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'qrp_' || replace(encode(gen_random_bytes(12), 'base64'), '/', '_');
$$;

-- ============ create QR payment ============

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
  p_expires_minutes integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'items_required'; END IF;

  v_token := qr_pay_gen_token();
  IF p_expires_minutes IS NOT NULL AND p_expires_minutes > 0 THEN
    v_expires := now() + (p_expires_minutes || ' minutes')::interval;
  END IF;

  INSERT INTO qr_payments(merchant_user_id, token, title, description, currency,
                          allow_pi, allow_wallet, allow_virtual_card, allow_guest,
                          reusable, expires_at, subtotal, total)
  VALUES (v_user, v_token, COALESCE(p_title,''), p_description, COALESCE(p_currency,'USD'),
          COALESCE(p_allow_pi,true), COALESCE(p_allow_wallet,true),
          COALESCE(p_allow_virtual_card,true), COALESCE(p_allow_guest,true),
          COALESCE(p_reusable,false), v_expires, 0, 0)
  RETURNING id INTO v_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := COALESCE((v_item->>'quantity')::integer, 1);
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line := round(v_qty * v_price, 2);
    v_total := v_total + v_line;
    INSERT INTO qr_payment_items(qr_payment_id, name, description, image_url, quantity, unit_price, line_total, position)
    VALUES (v_id, COALESCE(v_item->>'name','Item'), v_item->>'description', v_item->>'image_url',
            v_qty, v_price, v_line, v_idx);
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE qr_payments SET subtotal = v_total, total = v_total WHERE id = v_id;

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'total', v_total,
                            'checkout_url', '/qr-pay/' || v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_create(text,text,text,jsonb,boolean,boolean,boolean,boolean,boolean,integer) TO authenticated;

-- ============ public get by token ============

CREATE OR REPLACE FUNCTION public.qr_pay_get_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE v_pay qr_payments; v_items jsonb; v_merchant jsonb;
BEGIN
  SELECT * INTO v_pay FROM qr_payments WHERE token = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.expires_at IS NOT NULL AND v_pay.expires_at < now() AND v_pay.status = 'active' THEN
    UPDATE qr_payments SET status='expired' WHERE id=v_pay.id;
    v_pay.status := 'expired';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'name', name, 'description', description, 'image_url', image_url,
    'quantity', quantity, 'unit_price', unit_price, 'line_total', line_total
  ) ORDER BY position) INTO v_items FROM qr_payment_items WHERE qr_payment_id = v_pay.id;

  SELECT jsonb_build_object(
    'id', id, 'full_name', full_name, 'username', username, 'avatar_url', avatar_url
  ) INTO v_merchant FROM profiles WHERE id = v_pay.merchant_user_id;

  RETURN jsonb_build_object(
    'id', v_pay.id, 'token', v_pay.token, 'title', v_pay.title, 'description', v_pay.description,
    'currency', v_pay.currency, 'subtotal', v_pay.subtotal, 'total', v_pay.total,
    'status', v_pay.status,
    'allow_pi', v_pay.allow_pi, 'allow_wallet', v_pay.allow_wallet,
    'allow_virtual_card', v_pay.allow_virtual_card, 'allow_guest', v_pay.allow_guest,
    'reusable', v_pay.reusable, 'expires_at', v_pay.expires_at,
    'merchant', v_merchant, 'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_get_by_token(text) TO anon, authenticated;

-- ============ shared finish: mark paid, optional set paid status if not reusable ============

CREATE OR REPLACE FUNCTION public._qr_pay_finish(p_payment_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE qr_payments SET status = 'paid'
    WHERE id = p_payment_id AND reusable = false AND status = 'active';
END;
$$;

-- ============ complete with wallet ============

CREATE OR REPLACE FUNCTION public.qr_pay_complete_wallet(
  p_token text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay qr_payments;
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid;
  v_payer_profile profiles;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_pay FROM qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_wallet THEN RAISE EXCEPTION 'wallet_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'no_wallet'; END IF;
  IF v_balance < v_pay.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_payer_profile FROM profiles WHERE id = v_user;

  UPDATE wallets SET balance = balance - v_pay.total, updated_at = now() WHERE user_id = v_user;
  INSERT INTO wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_pay.total)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_pay.total, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  INSERT INTO qr_payment_transactions(
    qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at
  ) VALUES (
    v_pay.id, v_pay.merchant_user_id, v_user,
    COALESCE(p_payer_name, v_payer_profile.full_name),
    p_payer_email,
    v_payer_profile.username,
    'wallet', v_pay.total, v_pay.currency, 'succeeded', v_ref, now()
  ) RETURNING id INTO v_tx_id;

  PERFORM _qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'transaction_ref', v_ref,
                            'amount', v_pay.total, 'currency', v_pay.currency);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_wallet(text,text,text) TO authenticated;

-- ============ complete with virtual card (treat as wallet debit; cards are linked to wallet) ============

CREATE OR REPLACE FUNCTION public.qr_pay_complete_virtual_card(
  p_token text,
  p_card_number text,
  p_cvc text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay qr_payments;
  v_card virtual_cards;
  v_balance numeric(14,2);
  v_ref text;
  v_tx_id uuid;
  v_payer_profile profiles;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  SELECT * INTO v_pay FROM qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_virtual_card THEN RAISE EXCEPTION 'card_not_allowed'; END IF;
  IF v_pay.merchant_user_id = v_user THEN RAISE EXCEPTION 'cannot_pay_self'; END IF;

  SELECT * INTO v_card FROM virtual_cards WHERE user_id = v_user;
  IF v_card.id IS NULL THEN RAISE EXCEPTION 'no_card'; END IF;
  IF v_card.is_locked OR NOT v_card.is_active THEN RAISE EXCEPTION 'card_inactive'; END IF;
  IF replace(v_card.card_number,' ','') <> replace(p_card_number,' ','') THEN RAISE EXCEPTION 'card_mismatch'; END IF;
  IF v_card.cvc <> p_cvc THEN RAISE EXCEPTION 'cvc_mismatch'; END IF;

  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user FOR UPDATE;
  IF v_balance IS NULL OR v_balance < v_pay.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_payer_profile FROM profiles WHERE id = v_user;

  UPDATE wallets SET balance = balance - v_pay.total, updated_at = now() WHERE user_id = v_user;
  INSERT INTO wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_pay.total)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_pay.total, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  INSERT INTO qr_payment_transactions(
    qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, paid_at,
    provider_payload
  ) VALUES (
    v_pay.id, v_pay.merchant_user_id, v_user,
    COALESCE(p_payer_name, v_payer_profile.full_name),
    p_payer_email, v_payer_profile.username,
    'virtual_card', v_pay.total, v_pay.currency, 'succeeded', v_ref, now(),
    jsonb_build_object('card_last4', right(v_card.card_number,4))
  ) RETURNING id INTO v_tx_id;

  PERFORM _qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'transaction_ref', v_ref,
                            'amount', v_pay.total, 'currency', v_pay.currency);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_virtual_card(text,text,text,text,text) TO authenticated;

-- ============ complete with Pi (called after Pi SDK approve/complete via pi-platform) ============

CREATE OR REPLACE FUNCTION public.qr_pay_complete_pi(
  p_token text,
  p_pi_payment_id text,
  p_pi_txid text,
  p_payer_name text DEFAULT NULL,
  p_payer_email text DEFAULT NULL,
  p_payer_username text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_pay qr_payments;
  v_ref text;
  v_tx_id uuid;
BEGIN
  SELECT * INTO v_pay FROM qr_payments WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF v_pay.status <> 'active' THEN RAISE EXCEPTION 'not_active'; END IF;
  IF NOT v_pay.allow_pi THEN RAISE EXCEPTION 'pi_not_allowed'; END IF;
  IF v_user IS NULL AND NOT v_pay.allow_guest THEN RAISE EXCEPTION 'guest_not_allowed'; END IF;

  -- credit merchant wallet in fiat-equivalent total (Pi off-chain, amount tracked as total)
  INSERT INTO wallets(user_id, balance) VALUES (v_pay.merchant_user_id, v_pay.total)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + v_pay.total, updated_at = now();

  v_ref := 'QRP-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));

  INSERT INTO qr_payment_transactions(
    qr_payment_id, merchant_user_id, payer_user_id, payer_name, payer_email, payer_username,
    method, amount, currency, status, transaction_ref, pi_payment_id, pi_txid, paid_at,
    provider_payload
  ) VALUES (
    v_pay.id, v_pay.merchant_user_id, v_user,
    p_payer_name, p_payer_email, p_payer_username,
    'pi', v_pay.total, v_pay.currency, 'succeeded', v_ref,
    p_pi_payment_id, p_pi_txid, now(),
    jsonb_build_object('pi_payment_id', p_pi_payment_id, 'pi_txid', p_pi_txid)
  ) RETURNING id INTO v_tx_id;

  PERFORM _qr_pay_finish(v_pay.id);

  RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'transaction_ref', v_ref,
                            'amount', v_pay.total, 'currency', v_pay.currency);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_complete_pi(text,text,text,text,text,text) TO anon, authenticated;

-- ============ stats for dashboard ============

CREATE OR REPLACE FUNCTION public.qr_pay_merchant_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_total numeric := 0;
  v_today numeric := 0;
  v_week numeric := 0;
  v_month numeric := 0;
  v_count integer := 0;
  v_by_method jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  SELECT COALESCE(SUM(amount),0), COUNT(*) INTO v_total, v_count
    FROM qr_payment_transactions WHERE merchant_user_id = v_user AND status = 'succeeded';

  SELECT COALESCE(SUM(amount),0) INTO v_today FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('day', now());

  SELECT COALESCE(SUM(amount),0) INTO v_week FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= now() - interval '7 days';

  SELECT COALESCE(SUM(amount),0) INTO v_month FROM qr_payment_transactions
    WHERE merchant_user_id = v_user AND status='succeeded' AND paid_at >= date_trunc('month', now());

  SELECT COALESCE(jsonb_object_agg(method, total), '{}'::jsonb) INTO v_by_method
    FROM (SELECT method, SUM(amount) AS total FROM qr_payment_transactions
          WHERE merchant_user_id = v_user AND status='succeeded' GROUP BY method) m;

  RETURN jsonb_build_object('total', v_total, 'today', v_today, 'week', v_week,
                            'month', v_month, 'count', v_count, 'by_method', v_by_method);
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_merchant_stats() TO authenticated;
