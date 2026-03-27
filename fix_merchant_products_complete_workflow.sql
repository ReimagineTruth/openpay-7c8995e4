-- ===============================================================
-- Complete Merchant Products Workflow Fix
-- This script fixes the entire merchant products creation and payment workflow
-- ===============================================================

-- Step 1: Drop and recreate merchant products table with proper schema
DROP TABLE IF EXISTS public.merchant_products CASCADE;

CREATE TABLE public.merchant_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_description TEXT DEFAULT '',
  image_url TEXT,
  unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  is_active BOOLEAN DEFAULT true,
  product_tags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  checkout_info TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  pricing_type TEXT DEFAULT 'one_time' CHECK (pricing_type IN ('one_time', 'subscription')),
  repeat_every INTEGER DEFAULT NULL,
  repeat_unit TEXT DEFAULT NULL CHECK (repeat_unit IN ('week', 'month', 'year')),
  tax_code TEXT DEFAULT 'digital_goods',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_merchant_products_owner_active ON public.merchant_products (merchant_user_id, is_active);
CREATE INDEX idx_merchant_products_owner_published ON public.merchant_products (merchant_user_id, published_at DESC);
CREATE INDEX idx_merchant_products_code ON public.merchant_products (product_code);
CREATE INDEX idx_merchant_products_currency ON public.merchant_products (currency);

-- Enable Row Level Security
ALTER TABLE public.merchant_products ENABLE ROW LEVEL SECURITY;

-- Step 2: Create comprehensive RLS policies
DROP POLICY IF EXISTS "Users can view own merchant products" ON public.merchant_products;
CREATE POLICY "Users can view own merchant products"
ON public.merchant_products
FOR SELECT TO authenticated
USING (merchant_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own merchant products" ON public.merchant_products;
CREATE POLICY "Users can insert own merchant products"
ON public.merchant_products
FOR INSERT TO authenticated
WITH CHECK (merchant_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own merchant products" ON public.merchant_products;
CREATE POLICY "Users can update own merchant products"
ON public.merchant_products
FOR UPDATE TO authenticated
USING (merchant_user_id = auth.uid())
WITH CHECK (merchant_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own merchant products" ON public.merchant_products;
CREATE POLICY "Users can delete own merchant products"
ON public.merchant_products
FOR DELETE TO authenticated
USING (merchant_user_id = auth.uid());

-- Public policy for viewing active products
DROP POLICY IF EXISTS "Public can view active merchant products" ON public.merchant_products;
CREATE POLICY "Public can view active merchant products"
ON public.merchant_products
FOR SELECT TO anon, authenticated
USING (is_active = true AND published_at IS NOT NULL);

-- Step 3: Create merchant checkout sessions table (if not exists)
CREATE TABLE IF NOT EXISTS public.merchant_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token TEXT UNIQUE NOT NULL,
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  fee_amount NUMERIC(12,2) DEFAULT 0 CHECK (fee_amount >= 0),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paid', 'expired', 'cancelled')),
  key_mode TEXT DEFAULT 'sandbox' CHECK (key_mode IN ('sandbox', 'live')),
  api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 minutes'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create checkout session items table
CREATE TABLE IF NOT EXISTS public.merchant_checkout_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.merchant_checkout_sessions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.merchant_products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  unit_amount NUMERIC(12,2) NOT NULL CHECK (unit_amount > 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_amount NUMERIC(12,2) GENERATED ALWAYS AS (unit_amount * quantity) STORED,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create merchant payments table
CREATE TABLE IF NOT EXISTS public.merchant_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.merchant_checkout_sessions(id) ON DELETE CASCADE,
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
  key_mode TEXT DEFAULT 'sandbox' CHECK (key_mode IN ('sandbox', 'live')),
  payment_link_id UUID REFERENCES public.merchant_payment_links(id) ON DELETE SET NULL,
  payment_link_token TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 4: Create comprehensive merchant products functions

-- Function to create/update merchant product
CREATE OR REPLACE FUNCTION public.upsert_merchant_product(
  p_product_code TEXT,
  p_product_name TEXT,
  p_product_description TEXT DEFAULT '',
  p_unit_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_is_active BOOLEAN DEFAULT true,
  p_product_tags TEXT[] DEFAULT '{}',
  p_media_urls TEXT[] DEFAULT '{}',
  p_checkout_info TEXT DEFAULT '',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_pricing_type TEXT DEFAULT 'one_time',
  p_repeat_every INTEGER DEFAULT NULL,
  p_repeat_unit TEXT DEFAULT NULL,
  p_tax_code TEXT DEFAULT 'digital_goods',
  p_publish BOOLEAN DEFAULT false
)
RETURNS TABLE (
  product_id UUID,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_product_id UUID;
  v_product public.merchant_products;
BEGIN
  -- Authentication check
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Unauthorized'::TEXT;
    RETURN;
  END IF;

  -- Validation
  IF p_product_code IS NULL OR p_product_code = '' THEN
    RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Product code is required'::TEXT;
    RETURN;
  END IF;

  IF p_product_name IS NULL OR p_product_name = '' THEN
    RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Product name is required'::TEXT;
    RETURN;
  END IF;

  IF p_unit_amount IS NULL OR p_unit_amount < 0 THEN
    RETURN QUERY SELECT NULL::UUID, false::BOOLEAN, 'Valid amount is required'::TEXT;
    RETURN;
  END IF;

  -- Upsert product
  INSERT INTO public.merchant_products (
    merchant_user_id,
    product_code,
    product_name,
    product_description,
    unit_amount,
    currency,
    is_active,
    product_tags,
    media_urls,
    checkout_info,
    metadata,
    pricing_type,
    repeat_every,
    repeat_unit,
    tax_code,
    published_at
  ) VALUES (
    v_user_id,
    p_product_code,
    p_product_name,
    p_product_description,
    p_unit_amount,
    UPPER(TRIM(p_currency)),
    p_is_active,
    p_product_tags,
    p_media_urls,
    p_checkout_info,
    p_metadata,
    p_pricing_type,
    p_repeat_every,
    p_repeat_unit,
    p_tax_code,
    CASE WHEN p_publish THEN now() ELSE NULL END
  )
  ON CONFLICT (merchant_user_id, product_code)
  DO UPDATE SET
    product_name = EXCLUDED.product_name,
    product_description = EXCLUDED.product_description,
    unit_amount = EXCLUDED.unit_amount,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    product_tags = EXCLUDED.product_tags,
    media_urls = EXCLUDED.media_urls,
    checkout_info = EXCLUDED.checkout_info,
    metadata = EXCLUDED.metadata,
    pricing_type = EXCLUDED.pricing_type,
    repeat_every = EXCLUDED.repeat_every,
    repeat_unit = EXCLUDED.repeat_unit,
    tax_code = EXCLUDED.tax_code,
    published_at = COALESCE(merchant_products.published_at, CASE WHEN p_publish THEN now() ELSE NULL END),
    updated_at = now()
  RETURNING id INTO v_product_id;

  RETURN QUERY SELECT v_product_id::UUID, true::BOOLEAN, 
    CASE WHEN p_publish THEN 'Product published successfully' ELSE 'Product saved successfully' END::TEXT;
END;
$$;

-- Function to create merchant checkout session with products
CREATE OR REPLACE FUNCTION public.create_merchant_checkout_session(
  p_secret_key TEXT,
  p_mode TEXT DEFAULT 'sandbox',
  p_currency TEXT DEFAULT 'USD',
  p_items JSONB DEFAULT '[]'::jsonb,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_in_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  checkout_url TEXT,
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'sandbox')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_merchant_user_id UUID;
  v_api_key_id UUID;
  v_session_token TEXT;
  v_session_id UUID;
  v_total_amount NUMERIC(12,2) := 0;
  v_expires_at TIMESTAMPTZ;
  v_item JSONB;
  v_product public.merchant_products;
  v_quantity INTEGER;
  v_line_total NUMERIC(12,2);
  v_checkout_url TEXT;
BEGIN
  -- Validation
  IF v_mode NOT IN ('sandbox', 'live') THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, NULL::TIMESTAMPTZ, ''::TEXT, false::BOOLEAN, 'Invalid mode'::TEXT;
    RETURN;
  END IF;

  IF char_length(v_currency) <> 3 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, NULL::TIMESTAMPTZ, ''::TEXT, false::BOOLEAN, 'Invalid currency'::TEXT;
    RETURN;
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
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, NULL::TIMESTAMPTZ, ''::TEXT, false::BOOLEAN, 'Invalid merchant API key'::TEXT;
    RETURN;
  END IF;

  -- Calculate expiration
  v_expires_at := now() + (GREATEST(5, LEAST(p_expires_in_minutes, 525600)) || ' minutes')::INTERVAL;

  -- Process items and calculate total
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
      
      -- Find product
      SELECT * INTO v_product
      FROM public.merchant_products mp
      WHERE mp.id = (v_item->>'product_id')::UUID
        AND mp.merchant_user_id = v_merchant_user_id
        AND mp.is_active = true
        AND mp.published_at IS NOT NULL
      FOR UPDATE;

      IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, NULL::TIMESTAMPTZ, ''::TEXT, false::BOOLEAN, 
          'Product not found or inactive'::TEXT;
        RETURN;
      END IF;

      -- Validate currency match
      IF v_product.currency <> v_currency THEN
        RETURN QUERY SELECT NULL::UUID, NULL::TEXT, 0::NUMERIC, ''::TEXT, 'error'::TEXT, NULL::TIMESTAMPTZ, ''::TEXT, false::BOOLEAN, 
          'Currency mismatch'::TEXT;
        RETURN;
      END IF;

      v_line_total := v_product.unit_amount * v_quantity;
      v_total_amount := v_total_amount + v_line_total;
    END LOOP;
  ELSE
    -- No items provided, create empty session
    v_total_amount := 0;
  END IF;

  -- Generate session token
  v_session_token := 'mcs_' || encode(gen_random_bytes(16), 'hex');

  -- Create checkout session
  INSERT INTO public.merchant_checkout_sessions (
    session_token,
    merchant_user_id,
    total_amount,
    currency,
    fee_amount,
    status,
    key_mode,
    api_key_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    metadata,
    expires_at
  ) VALUES (
    v_session_token,
    v_merchant_user_id,
    v_total_amount,
    v_currency,
    0, -- Calculate fee amount if needed
    'open',
    v_mode,
    v_api_key_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_customer_address,
    p_metadata,
    v_expires_at
  ) RETURNING id INTO v_session_id;

  -- Create session items
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 1);
      
      -- Get product again for item creation
      SELECT * INTO v_product
      FROM public.merchant_products mp
      WHERE mp.id = (v_item->>'product_id')::UUID
        AND mp.merchant_user_id = v_merchant_user_id;

      IF v_product IS NOT NULL THEN
        INSERT INTO public.merchant_checkout_session_items (
          session_id,
          product_id,
          item_name,
          unit_amount,
          quantity
        ) VALUES (
          v_session_id,
          v_product.id,
          v_product.product_name,
          v_product.unit_amount,
          v_quantity
        );
      END IF;
    END LOOP;
  END IF;

  -- Generate checkout URL
  v_checkout_url := 'https://openpay.app/merchant-checkout?session=' || v_session_token;

  RETURN QUERY SELECT 
    v_session_id::UUID,
    v_session_token::TEXT,
    v_total_amount::NUMERIC,
    v_currency::TEXT,
    'open'::TEXT,
    v_expires_at::TIMESTAMPTZ,
    v_checkout_url::TEXT,
    true::BOOLEAN,
    'Checkout session created successfully'::TEXT;
END;
$$;

-- Function to complete merchant checkout with wallet payment
CREATE OR REPLACE FUNCTION public.complete_merchant_checkout_with_wallet(
  p_session_token TEXT,
  p_customer_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  payment_id UUID,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.merchant_checkout_sessions;
  v_customer_user_id UUID := COALESCE(p_customer_user_id, auth.uid());
  v_payment_id UUID;
  v_transaction_id UUID;
  v_merchant_balance NUMERIC(12,2);
  v_customer_balance NUMERIC(12,2);
  v_fee_amount NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
BEGIN
  -- Get and validate session
  SELECT * INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
    AND mcs.status = 'open'
    AND mcs.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invalid or expired checkout session'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Validate customer
  IF v_customer_user_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Customer authentication required'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Prevent merchant paying own checkout
  IF v_session.merchant_user_id = v_customer_user_id THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Merchant cannot pay own checkout'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := v_session.fee_amount;
  v_net_amount := v_session.total_amount - v_fee_amount;

  -- Get customer wallet balance
  SELECT balance INTO v_customer_balance
  FROM public.wallets
  WHERE user_id = v_customer_user_id
  FOR UPDATE;

  IF v_customer_balance IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Customer wallet not found'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Check sufficient balance
  IF v_customer_balance < v_session.total_amount THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Insufficient balance'::TEXT, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  -- Get merchant wallet
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_session.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    -- Create merchant wallet if doesn't exist
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_session.merchant_user_id, 0, now());
    v_merchant_balance := 0;
  END IF;

  -- Create transaction
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    currency,
    fee_amount,
    status,
    type,
    metadata
  ) VALUES (
    v_customer_user_id,
    v_session.merchant_user_id,
    v_session.total_amount,
    v_session.currency,
    v_fee_amount,
    'completed',
    'payment',
    jsonb_build_object(
      'checkout_session_id', v_session.id,
      'checkout_session_token', v_session.session_token,
      'payment_method', 'wallet'
    )
  ) RETURNING id INTO v_transaction_id;

  -- Update wallet balances
  UPDATE public.wallets
  SET balance = v_customer_balance - v_session.total_amount,
      updated_at = now()
  WHERE user_id = v_customer_user_id;

  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  -- Create payment record
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
  ) VALUES (
    v_session.id,
    v_session.merchant_user_id,
    v_customer_user_id,
    v_transaction_id,
    v_session.total_amount,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    'succeeded'
  ) RETURNING id INTO v_payment_id;

  -- Update session status
  UPDATE public.merchant_checkout_sessions
  SET status = 'paid',
      updated_at = now()
  WHERE id = v_session.id;

  RETURN QUERY SELECT 
    true::BOOLEAN,
    'Payment completed successfully'::TEXT,
    v_payment_id::UUID,
    v_transaction_id::UUID;
END;
$$;

-- Function to get merchant products
CREATE OR REPLACE FUNCTION public.get_merchant_products(
  p_include_inactive BOOLEAN DEFAULT false,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  product_code TEXT,
  product_name TEXT,
  product_description TEXT,
  image_url TEXT,
  unit_amount NUMERIC,
  currency TEXT,
  is_active BOOLEAN,
  product_tags TEXT[],
  media_urls TEXT[],
  checkout_info TEXT,
  metadata JSONB,
  pricing_type TEXT,
  repeat_every INTEGER,
  repeat_unit TEXT,
  tax_code TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.id,
    mp.product_code,
    mp.product_name,
    mp.product_description,
    mp.image_url,
    mp.unit_amount,
    mp.currency,
    mp.is_active,
    mp.product_tags,
    mp.media_urls,
    mp.checkout_info,
    mp.metadata,
    mp.pricing_type,
    mp.repeat_every,
    mp.repeat_unit,
    mp.tax_code,
    mp.published_at,
    mp.created_at,
    mp.updated_at
  FROM public.merchant_products mp
  WHERE mp.merchant_user_id = auth.uid()
    AND (p_include_inactive OR mp.is_active = true)
  ORDER BY mp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Function to get public merchant products
CREATE OR REPLACE FUNCTION public.get_public_merchant_products(
  p_merchant_user_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  product_code TEXT,
  product_name TEXT,
  product_description TEXT,
  image_url TEXT,
  unit_amount NUMERIC,
  currency TEXT,
  product_tags TEXT[],
  pricing_type TEXT,
  repeat_every INTEGER,
  repeat_unit TEXT,
  published_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.id,
    mp.product_code,
    mp.product_name,
    mp.product_description,
    mp.image_url,
    mp.unit_amount,
    mp.currency,
    mp.product_tags,
    mp.pricing_type,
    mp.repeat_every,
    mp.repeat_unit,
    mp.published_at
  FROM public.merchant_products mp
  WHERE mp.merchant_user_id = p_merchant_user_id
    AND mp.is_active = true
    AND mp.published_at IS NOT NULL
  ORDER BY mp.published_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Step 5: Create triggers for updated_at
CREATE TRIGGER trg_merchant_products_updated_at
BEFORE UPDATE ON public.merchant_products
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

CREATE TRIGGER trg_merchant_checkout_sessions_updated_at
BEFORE UPDATE ON public.merchant_checkout_sessions
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

CREATE TRIGGER trg_merchant_payments_updated_at
BEFORE UPDATE ON public.merchant_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

-- Step 6: Grant permissions
GRANT ALL ON public.merchant_products TO authenticated;
GRANT ALL ON public.merchant_checkout_sessions TO authenticated;
GRANT ALL ON public.merchant_checkout_session_items TO authenticated;
GRANT ALL ON public.merchant_payments TO authenticated;

GRANT SELECT ON public.merchant_products TO anon;
GRANT SELECT ON public.merchant_checkout_sessions TO anon;
GRANT SELECT ON public.merchant_checkout_session_items TO anon;
GRANT SELECT ON public.merchant_payments TO anon;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION public.upsert_merchant_product TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_merchant_checkout_session TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_merchant_checkout_with_wallet TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_merchant_products TO anon, authenticated;

-- Step 7: Notify schema reload
NOTIFY pgrst, 'reload schema';

-- Step 8: Completion message
DO $$
BEGIN
  RAISE NOTICE 'Merchant Products Complete Workflow Fixed Successfully!';
  RAISE NOTICE '1. merchant_products table recreated with proper schema';
  RAISE NOTICE '2. Comprehensive RLS policies implemented';
  RAISE NOTICE '3. Complete checkout session workflow';
  RAISE NOTICE '4. Payment processing with wallet integration';
  RAISE NOTICE '5. Product management functions';
  RAISE NOTICE '6. Public product catalog access';
END $$;
