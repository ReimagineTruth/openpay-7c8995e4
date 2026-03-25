-- Ensure payment-link RPC signature matches frontend and is visible in PostgREST schema cache.

ALTER TABLE public.merchant_payment_links
  ADD COLUMN IF NOT EXISTS fee_payer TEXT,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS merchant_settlement_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS openpay_fee_account TEXT;

ALTER TABLE public.merchant_payment_links
  ALTER COLUMN fee_payer SET DEFAULT 'customer',
  ALTER COLUMN fee_amount SET DEFAULT 0;

UPDATE public.merchant_payment_links
SET fee_payer = COALESCE(NULLIF(LOWER(TRIM(fee_payer)), ''), 'customer'),
    fee_amount = COALESCE(fee_amount, 0)
WHERE fee_payer IS NULL OR fee_amount IS NULL;

ALTER TABLE public.merchant_payment_links
  DROP CONSTRAINT IF EXISTS merchant_payment_links_fee_payer_check;

ALTER TABLE public.merchant_payment_links
  ADD CONSTRAINT merchant_payment_links_fee_payer_check
  CHECK (fee_payer IN ('customer', 'merchant'));

DROP FUNCTION IF EXISTS public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, TEXT
);

CREATE OR REPLACE FUNCTION public.create_merchant_payment_link(
  p_secret_key TEXT,
  p_mode TEXT,
  p_link_type TEXT,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'USD',
  p_custom_amount NUMERIC DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_collect_customer_name BOOLEAN DEFAULT true,
  p_collect_customer_email BOOLEAN DEFAULT true,
  p_collect_phone BOOLEAN DEFAULT false,
  p_collect_address BOOLEAN DEFAULT false,
  p_after_payment_type TEXT DEFAULT 'confirmation',
  p_confirmation_message TEXT DEFAULT NULL,
  p_redirect_url TEXT DEFAULT NULL,
  p_call_to_action TEXT DEFAULT 'Pay',
  p_expires_in_minutes INTEGER DEFAULT NULL,
  p_fee_amount NUMERIC DEFAULT NULL,
  p_fee_payer TEXT DEFAULT NULL,
  p_merchant_settlement_amount NUMERIC DEFAULT NULL,
  p_openpay_fee_account TEXT DEFAULT NULL
)
RETURNS TABLE (
  link_id UUID,
  link_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  key_mode TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, '')));
  v_link_type TEXT := LOWER(TRIM(COALESCE(p_link_type, '')));
  v_after_payment_type TEXT := LOWER(TRIM(COALESCE(p_after_payment_type, 'confirmation')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_fee_payer TEXT := LOWER(TRIM(COALESCE(p_fee_payer, 'customer')));
  v_merchant_user_id UUID;
  v_api_key_id UUID;
  v_link public.merchant_payment_links;
  v_item JSONB;
  v_product public.merchant_products;
  v_quantity INTEGER;
  v_line_total NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2) := 0;
  v_fee_amount NUMERIC(12,2) := 0;
  v_merchant_settlement NUMERIC(12,2) := 0;
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF v_link_type NOT IN ('products', 'custom_amount') THEN
    RAISE EXCEPTION 'Link type must be products or custom_amount';
  END IF;

  IF v_after_payment_type NOT IN ('confirmation', 'redirect') THEN
    RAISE EXCEPTION 'After payment type must be confirmation or redirect';
  END IF;

  IF v_fee_payer NOT IN ('customer', 'merchant') THEN
    RAISE EXCEPTION 'Fee payer must be customer or merchant';
  END IF;

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
  END IF;

  SELECT mak.merchant_user_id, mak.id
  INTO v_merchant_user_id, v_api_key_id
  FROM public.merchant_api_keys mak
  WHERE (mak.secret_key_hash = md5(p_secret_key) OR mak.secret_key_hash = encode(digest(p_secret_key, 'sha256'), 'hex'))
    AND mak.key_mode = v_mode
    AND mak.is_active = true
  LIMIT 1;

  IF v_merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid merchant API key for mode %', v_mode;
  END IF;

  IF p_expires_in_minutes IS NOT NULL THEN
    v_expires_at := now() + (GREATEST(5, LEAST(p_expires_in_minutes, 525600)) || ' minutes')::INTERVAL;
  END IF;

  IF v_link_type = 'custom_amount' THEN
    IF p_custom_amount IS NULL OR p_custom_amount <= 0 THEN
      RAISE EXCEPTION 'Custom amount must be greater than 0';
    END IF;
    v_subtotal := ROUND(p_custom_amount, 2);
  ELSE
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'At least one product item is required';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      SELECT *
      INTO v_product
      FROM public.merchant_products mp
      WHERE mp.id = (v_item->>'product_id')::UUID
        AND mp.merchant_user_id = v_merchant_user_id
        AND mp.is_active = true
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid product_id in items payload';
      END IF;

      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
      IF v_quantity < 1 OR v_quantity > 1000 THEN
        RAISE EXCEPTION 'Quantity must be between 1 and 1000';
      END IF;

      IF UPPER(v_product.currency) <> v_currency THEN
        RAISE EXCEPTION 'Product currency mismatch for product %', v_product.id;
      END IF;

      v_line_total := ROUND(v_product.unit_amount * v_quantity, 2);
      v_subtotal := v_subtotal + v_line_total;
    END LOOP;
  END IF;

  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'Link total must be positive';
  END IF;

  v_fee_amount := ROUND(COALESCE(p_fee_amount, 0), 2);
  IF v_fee_amount < 0 THEN
    RAISE EXCEPTION 'Fee amount must be non-negative';
  END IF;

  v_total := CASE WHEN v_fee_payer = 'customer' THEN ROUND(v_subtotal + v_fee_amount, 2) ELSE v_subtotal END;

  v_merchant_settlement := ROUND(
    COALESCE(
      p_merchant_settlement_amount,
      CASE WHEN v_fee_payer = 'merchant' THEN GREATEST(v_subtotal - v_fee_amount, 0) ELSE v_subtotal END
    ),
    2
  );

  INSERT INTO public.merchant_payment_links (
    merchant_user_id,
    api_key_id,
    key_mode,
    link_token,
    link_type,
    title,
    description,
    currency,
    custom_amount,
    total_amount,
    collect_customer_name,
    collect_customer_email,
    collect_phone,
    collect_address,
    after_payment_type,
    confirmation_message,
    redirect_url,
    call_to_action,
    expires_at,
    fee_payer,
    fee_amount,
    merchant_settlement_amount,
    openpay_fee_account
  )
  VALUES (
    v_merchant_user_id,
    v_api_key_id,
    v_mode,
    'oplink_' || public.random_token_hex(24),
    v_link_type,
    COALESCE(NULLIF(TRIM(p_title), ''), 'OpenPay Payment'),
    COALESCE(NULLIF(TRIM(p_description), ''), ''),
    v_currency,
    CASE WHEN v_link_type = 'custom_amount' THEN v_subtotal ELSE p_custom_amount END,
    v_total,
    COALESCE(p_collect_customer_name, true),
    COALESCE(p_collect_customer_email, true),
    COALESCE(p_collect_phone, false),
    COALESCE(p_collect_address, false),
    v_after_payment_type,
    COALESCE(NULLIF(TRIM(p_confirmation_message), ''), 'Thanks for your payment.'),
    NULLIF(TRIM(COALESCE(p_redirect_url, '')), ''),
    COALESCE(NULLIF(TRIM(p_call_to_action), ''), 'Pay'),
    v_expires_at,
    v_fee_payer,
    v_fee_amount,
    v_merchant_settlement,
    NULLIF(TRIM(COALESCE(p_openpay_fee_account, '')), '')
  )
  RETURNING * INTO v_link;

  IF v_link_type = 'products' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      SELECT *
      INTO v_product
      FROM public.merchant_products mp
      WHERE mp.id = (v_item->>'product_id')::UUID
        AND mp.merchant_user_id = v_merchant_user_id
        AND mp.is_active = true
      LIMIT 1;

      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
      v_line_total := ROUND(v_product.unit_amount * v_quantity, 2);

      INSERT INTO public.merchant_payment_link_items (
        link_id,
        product_id,
        item_name,
        unit_amount,
        quantity,
        line_total
      )
      VALUES (
        v_link.id,
        v_product.id,
        v_product.product_name,
        v_product.unit_amount,
        v_quantity,
        v_line_total
      );
    END LOOP;
  END IF;

  UPDATE public.merchant_api_keys
  SET last_used_at = now()
  WHERE id = v_api_key_id;

  RETURN QUERY
  SELECT v_link.id, v_link.link_token, v_link.total_amount, v_link.currency, v_link.key_mode, v_link.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, TEXT
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
