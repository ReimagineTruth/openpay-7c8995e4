-- QR Pay platform admin: enable/disable payment methods for maintenance

CREATE TABLE IF NOT EXISTS public.qr_pay_platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  maintenance_mode BOOLEAN NOT NULL DEFAULT false,
  maintenance_message TEXT NOT NULL DEFAULT 'QR Pay is temporarily under maintenance. Please try again later.',
  allow_pi BOOLEAN NOT NULL DEFAULT true,
  allow_wallet BOOLEAN NOT NULL DEFAULT true,
  allow_virtual_card BOOLEAN NOT NULL DEFAULT true,
  allow_moonpay BOOLEAN NOT NULL DEFAULT true,
  allow_google_pay BOOLEAN NOT NULL DEFAULT true,
  allow_apple_pay BOOLEAN NOT NULL DEFAULT true,
  allow_paypal BOOLEAN NOT NULL DEFAULT true,
  allow_qr_ph BOOLEAN NOT NULL DEFAULT true,
  allow_gcash BOOLEAN NOT NULL DEFAULT true,
  allow_maya BOOLEAN NOT NULL DEFAULT true,
  allow_grab_pay BOOLEAN NOT NULL DEFAULT true,
  allow_shopee_pay BOOLEAN NOT NULL DEFAULT true,
  allow_billease BOOLEAN NOT NULL DEFAULT true,
  allow_bank BOOLEAN NOT NULL DEFAULT true,
  allow_guest BOOLEAN NOT NULL DEFAULT true,
  allow_pro BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.qr_pay_platform_settings TO authenticated, anon;
GRANT ALL ON public.qr_pay_platform_settings TO service_role;

ALTER TABLE public.qr_pay_platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read qr pay platform settings" ON public.qr_pay_platform_settings;
CREATE POLICY "Anyone can read qr pay platform settings"
ON public.qr_pay_platform_settings FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Only core admins can modify qr pay platform settings" ON public.qr_pay_platform_settings;
CREATE POLICY "Only core admins can modify qr pay platform settings"
ON public.qr_pay_platform_settings FOR ALL
USING (public.is_openpay_core_admin())
WITH CHECK (public.is_openpay_core_admin());

INSERT INTO public.qr_pay_platform_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.qr_pay_get_platform_settings()
RETURNS public.qr_pay_platform_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.qr_pay_platform_settings WHERE id = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_get_platform_settings() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qr_pay_platform_method_allowed(p_method text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.qr_pay_platform_settings;
  m text := lower(btrim(COALESCE(p_method, '')));
BEGIN
  SELECT * INTO s FROM public.qr_pay_platform_settings WHERE id = true LIMIT 1;
  IF NOT FOUND THEN RETURN true; END IF;
  IF s.maintenance_mode THEN RETURN false; END IF;
  IF m IN ('pi') THEN RETURN s.allow_pi; END IF;
  IF m IN ('wallet') THEN RETURN s.allow_wallet; END IF;
  IF m IN ('card', 'virtual_card') THEN RETURN s.allow_virtual_card; END IF;
  IF m = 'moonpay' THEN RETURN s.allow_moonpay; END IF;
  IF m = 'google_pay' THEN RETURN s.allow_google_pay; END IF;
  IF m = 'apple_pay' THEN RETURN s.allow_apple_pay; END IF;
  IF m = 'paypal' THEN RETURN s.allow_paypal; END IF;
  IF m IN ('qr_ph', 'qrph') THEN RETURN s.allow_qr_ph; END IF;
  IF m = 'gcash' THEN RETURN s.allow_gcash; END IF;
  IF m IN ('maya', 'paymaya') THEN RETURN s.allow_maya; END IF;
  IF m IN ('grab_pay', 'grabpay') THEN RETURN s.allow_grab_pay; END IF;
  IF m IN ('shopee_pay', 'shopeepay') THEN RETURN s.allow_shopee_pay; END IF;
  IF m = 'billease' THEN RETURN s.allow_billease; END IF;
  IF m = 'bank' THEN RETURN s.allow_bank; END IF;
  IF m = 'guest' THEN RETURN s.allow_guest; END IF;
  IF m = 'pro' THEN RETURN s.allow_pro; END IF;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_platform_method_allowed(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.qr_pay_set_platform_settings(
  p_maintenance_mode boolean DEFAULT NULL,
  p_maintenance_message text DEFAULT NULL,
  p_allow_pi boolean DEFAULT NULL,
  p_allow_wallet boolean DEFAULT NULL,
  p_allow_virtual_card boolean DEFAULT NULL,
  p_allow_moonpay boolean DEFAULT NULL,
  p_allow_google_pay boolean DEFAULT NULL,
  p_allow_apple_pay boolean DEFAULT NULL,
  p_allow_paypal boolean DEFAULT NULL,
  p_allow_qr_ph boolean DEFAULT NULL,
  p_allow_gcash boolean DEFAULT NULL,
  p_allow_maya boolean DEFAULT NULL,
  p_allow_grab_pay boolean DEFAULT NULL,
  p_allow_shopee_pay boolean DEFAULT NULL,
  p_allow_billease boolean DEFAULT NULL,
  p_allow_bank boolean DEFAULT NULL,
  p_allow_guest boolean DEFAULT NULL,
  p_allow_pro boolean DEFAULT NULL
) RETURNS public.qr_pay_platform_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.qr_pay_platform_settings;
BEGIN
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  INSERT INTO public.qr_pay_platform_settings (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.qr_pay_platform_settings SET
    maintenance_mode = COALESCE(p_maintenance_mode, maintenance_mode),
    maintenance_message = COALESCE(NULLIF(btrim(p_maintenance_message), ''), maintenance_message),
    allow_pi = COALESCE(p_allow_pi, allow_pi),
    allow_wallet = COALESCE(p_allow_wallet, allow_wallet),
    allow_virtual_card = COALESCE(p_allow_virtual_card, allow_virtual_card),
    allow_moonpay = COALESCE(p_allow_moonpay, allow_moonpay),
    allow_google_pay = COALESCE(p_allow_google_pay, allow_google_pay),
    allow_apple_pay = COALESCE(p_allow_apple_pay, allow_apple_pay),
    allow_paypal = COALESCE(p_allow_paypal, allow_paypal),
    allow_qr_ph = COALESCE(p_allow_qr_ph, allow_qr_ph),
    allow_gcash = COALESCE(p_allow_gcash, allow_gcash),
    allow_maya = COALESCE(p_allow_maya, allow_maya),
    allow_grab_pay = COALESCE(p_allow_grab_pay, allow_grab_pay),
    allow_shopee_pay = COALESCE(p_allow_shopee_pay, allow_shopee_pay),
    allow_billease = COALESCE(p_allow_billease, allow_billease),
    allow_bank = COALESCE(p_allow_bank, allow_bank),
    allow_guest = COALESCE(p_allow_guest, allow_guest),
    allow_pro = COALESCE(p_allow_pro, allow_pro),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = true
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_set_platform_settings(
  boolean, text,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean, boolean, boolean, boolean, boolean, boolean,
  boolean, boolean
) TO authenticated, service_role;

-- Enforce platform gates inside PayMongo complete RPC
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
  IF v_method NOT IN ('qr_ph', 'gcash', 'maya', 'grab_pay', 'shopee_pay', 'billease', 'bank', 'google_pay') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF NULLIF(btrim(COALESCE(p_paymongo_intent_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'intent_required';
  END IF;
  IF NOT public.qr_pay_platform_method_allowed(v_method) THEN
    RAISE EXCEPTION 'method_disabled';
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
  ELSIF v_method = 'maya' THEN
    v_allowed := COALESCE((v_meta->>'allow_maya')::boolean, false);
  ELSIF v_method = 'grab_pay' THEN
    v_allowed := COALESCE((v_meta->>'allow_grab_pay')::boolean, false);
  ELSIF v_method = 'shopee_pay' THEN
    v_allowed := COALESCE((v_meta->>'allow_shopee_pay')::boolean, false);
  ELSIF v_method = 'billease' THEN
    v_allowed := COALESCE((v_meta->>'allow_billease')::boolean, false);
  ELSIF v_method = 'bank' THEN
    v_allowed := COALESCE((v_meta->>'allow_bank')::boolean, false);
  ELSIF v_method = 'google_pay' THEN
    v_allowed := COALESCE((v_meta->>'allow_google_pay')::boolean, false);
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
      'provider', 'paymongo',
      'method', v_method
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
) TO service_role, anon, authenticated;
