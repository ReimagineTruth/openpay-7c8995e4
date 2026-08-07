-- Fix QR Pay create rejecting PI (length 2) via currency_required
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
  p_delivery_fields jsonb DEFAULT '["name","email","address"]'::jsonb,
  p_payment_purpose text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_purpose text;
  v_api_type text;
  v_flexible boolean := false;
  v_default_title text;
  v_title text;
  v_currency text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;

  v_currency := upper(btrim(COALESCE(p_currency, '')));
  -- Allow 2-char codes like PI (ISO-4217 is usually 3, but OpenPay uses PI)
  IF v_currency IS NULL OR length(v_currency) < 2 THEN RAISE EXCEPTION 'currency_required'; END IF;

  -- Resolve purpose (prefer explicit purpose, else treat payment_type as purpose id)
  v_purpose := NULLIF(btrim(COALESCE(p_payment_purpose, '')), '');
  IF v_purpose IS NULL THEN
    v_purpose := NULLIF(btrim(COALESCE(p_payment_type, '')), '');
  END IF;
  IF v_purpose IS NULL THEN
    v_purpose := 'product';
  END IF;

  SELECT api_type, is_flexible, COALESCE(default_title, label)
    INTO v_api_type, v_flexible, v_default_title
  FROM public.qr_pay_purposes
  WHERE id = v_purpose AND active;

  IF NOT FOUND THEN
    -- Fall back: payment_type may already be one of the 4 api types
    IF p_payment_type IN ('product', 'digital', 'donation', 'tip') THEN
      v_api_type := p_payment_type;
      v_purpose := p_payment_type;
      v_flexible := (p_payment_type IN ('donation', 'tip')) OR COALESCE(p_allow_custom_amount, false);
      v_default_title := 'QR Payment';
    ELSE
      RAISE EXCEPTION 'invalid_payment_purpose';
    END IF;
  ELSE
    v_flexible := COALESCE(v_flexible, false) OR COALESCE(p_allow_custom_amount, false);
  END IF;

  IF v_api_type NOT IN ('product', 'digital', 'donation', 'tip') THEN
    RAISE EXCEPTION 'invalid_payment_type';
  END IF;

  v_title := NULLIF(btrim(COALESCE(p_title, '')), '');
  IF v_title IS NULL THEN
    v_title := COALESCE(v_default_title, 'QR Payment');
  END IF;

  IF v_flexible THEN
    v_total := COALESCE(p_suggested_amount, 0);
    v_subtotal := v_total;
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'items_required';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_subtotal := v_subtotal + (COALESCE((v_item->>'quantity')::int, 1) * COALESCE((v_item->>'unit_price')::numeric, 0));
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
    payment_type, payment_purpose, after_payment_action, download_url, redirect_url,
    suggested_amount, min_amount, allow_custom_amount, cover_image_url,
    collect_delivery, delivery_fields
  ) VALUES (
    v_id, v_user, v_token, v_title, p_description, v_currency,
    v_subtotal, v_total, 'active',
    COALESCE(p_allow_pi, true), COALESCE(p_allow_wallet, true), COALESCE(p_allow_virtual_card, true),
    COALESCE(p_allow_guest, true),
    CASE WHEN v_flexible THEN true ELSE COALESCE(p_reusable, false) END,
    v_expires,
    v_api_type, v_purpose, COALESCE(p_after_payment_action, 'receipt'),
    p_download_url, p_redirect_url,
    p_suggested_amount, p_min_amount, v_flexible, p_cover_image_url,
    COALESCE(p_collect_delivery, false),
    COALESCE(p_delivery_fields, '["name","email","address"]'::jsonb)
  );

  IF NOT v_flexible THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      INSERT INTO public.qr_payment_items(
        qr_payment_id, name, description, image_url, quantity, unit_price, line_total, position
      ) VALUES (
        v_id,
        COALESCE(v_item->>'name', 'Item'),
        v_item->>'description',
        v_item->>'image_url',
        COALESCE((v_item->>'quantity')::int, 1),
        COALESCE((v_item->>'unit_price')::numeric, 0),
        COALESCE((v_item->>'quantity')::int, 1) * COALESCE((v_item->>'unit_price')::numeric, 0),
        v_pos
      );
      v_pos := v_pos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'total', v_total,
    'payment_type', v_api_type,
    'payment_purpose', v_purpose,
    'allow_custom_amount', v_flexible
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_pay_create(
  text, text, text, jsonb, boolean, boolean, boolean, boolean, boolean, integer,
  text, text, text, text, numeric, numeric, boolean, text, boolean, jsonb, text
) TO authenticated;
