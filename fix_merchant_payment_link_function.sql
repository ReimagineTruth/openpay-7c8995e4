-- Fix Merchant Payment Link Function
-- This script updates the create_merchant_payment_link function to match frontend expectations
-- Adds missing parameters that frontend is trying to pass

-- Step 1: Drop existing function
DROP FUNCTION IF EXISTS public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER
);

-- Step 2: Create updated function with all frontend parameters
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
  v_merchant_user_id UUID;
  v_api_key_id UUID;
  v_link public.merchant_payment_links;
  v_item JSONB;
  v_product public.merchant_products;
  v_product_id UUID;
  v_quantity INTEGER;
  v_line_total NUMERIC(12,2);
  v_total NUMERIC(12,2) := 0;
  v_expires_at TIMESTAMPTZ;
  v_fee_amount NUMERIC(12,2) := COALESCE(p_fee_amount, 0);
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

  IF char_length(v_currency) < 2 OR char_length(v_currency) > 10 THEN
    RAISE EXCEPTION 'Currency must be between 2 and 10 characters';
  END IF;

  -- Validate API key
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

  -- Handle expiration
  IF p_expires_in_minutes IS NOT NULL THEN
    v_expires_at := now() + (GREATEST(5, LEAST(p_expires_in_minutes, 525600)) || ' minutes')::INTERVAL;
  END IF;

  -- Calculate total amount based on link type
  IF v_link_type = 'products' THEN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'Products array cannot be empty for products link type';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_product_id := (v_item->>'product_id')::UUID;
      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);

      SELECT * INTO v_product
      FROM public.merchant_products
      WHERE id = v_product_id
        AND merchant_user_id = v_merchant_user_id
        AND is_active = true
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found or inactive', v_product_id;
      END IF;

      v_line_total := v_product.unit_amount * v_quantity;
      v_total := v_total + v_line_total;
    END LOOP;

  ELSIF v_link_type = 'custom_amount' THEN
    IF p_custom_amount IS NULL OR p_custom_amount <= 0 THEN
      RAISE EXCEPTION 'Custom amount must be greater than zero';
    END IF;

    v_total := p_custom_amount;
  END IF;

  -- Add fee to total if specified
  IF v_fee_amount > 0 THEN
    v_total := v_total + v_fee_amount;
  END IF;

  -- Create payment link
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
    items,
    collect_customer_name,
    collect_customer_email,
    collect_phone,
    collect_address,
    after_payment_type,
    confirmation_message,
    redirect_url,
    call_to_action,
    expires_at,
    fee_amount,
    fee_payer,
    merchant_settlement_amount,
    openpay_fee_account
  )
  VALUES (
    v_merchant_user_id,
    v_api_key_id,
    v_mode,
    'mpl_' || public.random_token_hex(24),
    v_link_type,
    p_title,
    p_description,
    v_currency,
    p_custom_amount,
    p_items,
    p_collect_customer_name,
    p_collect_customer_email,
    p_collect_phone,
    p_collect_address,
    v_after_payment_type,
    p_confirmation_message,
    p_redirect_url,
    p_call_to_action,
    v_expires_at,
    v_fee_amount,
    p_fee_payer,
    p_merchant_settlement_amount,
    p_openpay_fee_account
  )
  RETURNING * INTO v_link;

  -- Update API key last used timestamp
  UPDATE public.merchant_api_keys
  SET last_used_at = now()
  WHERE id = v_api_key_id;

  -- Return link details
  RETURN QUERY
  SELECT 
    v_link.id,
    v_link.link_token,
    v_total,
    v_currency,
    v_link.key_mode,
    v_link.expires_at;
END;
$$;

-- Step 3: Grant permissions
GRANT EXECUTE ON FUNCTION public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, TEXT
) TO authenticated, service_role;

-- Step 4: Add function comment
COMMENT ON FUNCTION public.create_merchant_payment_link(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, JSONB, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, TEXT, TEXT, TEXT, TEXT, INTEGER, NUMERIC, TEXT, NUMERIC, TEXT
) IS 'Create merchant payment link with all frontend parameters including fee handling and merchant settlement options.';

-- Step 5: Notify schema reload
NOTIFY pgrst, 'reload schema';

-- Step 6: Completion message
DO $$
BEGIN
  RAISE NOTICE 'Merchant Payment Link Function Fixed Successfully!';
  RAISE NOTICE '1. Added missing parameters: fee_amount, fee_payer, merchant_settlement_amount, openpay_fee_account';
  RAISE NOTICE '2. Function now matches frontend expectations';
  RAISE NOTICE '3. Payment links creation should work correctly';
END $$;
