-- ===============================================================
-- OpenPay Payment Links System - Stripe-like Architecture
-- Production-ready PostgreSQL (Supabase) RPC functions
-- ===============================================================

-- ===============================================================
-- 1. PAYMENT_LINKS TABLE SCHEMA
-- ===============================================================

-- Drop table if exists (for clean deployment)
DROP TABLE IF EXISTS public.payment_links CASCADE;

-- Create payment_links table with comprehensive fields
CREATE TABLE public.payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_link_token TEXT UNIQUE NOT NULL,
  merchant_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Payment details
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (char_length(currency) = 3),
  description TEXT,
  
  -- Customer collection fields
  customer_email TEXT,
  customer_name TEXT,
  collect_address BOOLEAN DEFAULT false,
  collect_phone BOOLEAN DEFAULT false,
  
  -- URL and expiration
  redirect_url TEXT,
  checkout_url TEXT,
  expires_at TIMESTAMPTZ,
  
  -- Items for product-based payments
  items JSONB DEFAULT '[]'::jsonb,
  
  -- Fee handling
  fee_amount NUMERIC(12,2) DEFAULT 0 CHECK (fee_amount >= 0),
  fee_payer TEXT DEFAULT 'customer' CHECK (fee_payer IN ('customer', 'merchant', 'split')),
  
  -- Metadata and timestamps
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_payment_links_token ON public.payment_links(payment_link_token);
CREATE INDEX idx_payment_links_merchant ON public.payment_links(merchant_user_id);
CREATE INDEX idx_payment_links_status ON public.payment_links(status);
CREATE INDEX idx_payment_links_expires ON public.payment_links(expires_at);
CREATE INDEX idx_payment_links_created ON public.payment_links(created_at);

-- Enable Row Level Security
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

-- ===============================================================
-- 2. CREATE_MERCHANT_PAYMENT_LINK FUNCTION
-- ===============================================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_merchant_payment_link CASCADE;

CREATE OR REPLACE FUNCTION public.create_merchant_payment_link(
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_description TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_collect_address BOOLEAN DEFAULT false,
  p_collect_phone BOOLEAN DEFAULT false,
  p_redirect_url TEXT DEFAULT NULL,
  p_expiration_minutes INTEGER DEFAULT 30,
  p_fee_payer TEXT DEFAULT 'customer',
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_payment_link_token TEXT;
  v_payment_link_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_fee_amount NUMERIC(12,2) := 0;
  v_final_amount NUMERIC(12,2);
  v_checkout_url TEXT;
  v_merchant_name TEXT;
BEGIN
  -- ===============================================================
  -- VALIDATION
  -- ===============================================================
  
  -- Authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Unauthorized',
      'code', 'auth_required'
    );
  END IF;
  
  -- Amount validation
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Amount must be greater than 0',
      'code', 'invalid_amount'
    );
  END IF;
  
  -- Currency validation
  IF p_currency IS NULL OR char_length(TRIM(p_currency)) <> 3 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Invalid currency code',
      'code', 'invalid_currency'
    );
  END IF;
  
  -- Fee payer validation
  IF p_fee_payer NOT IN ('customer', 'merchant', 'split') THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Invalid fee payer',
      'code', 'invalid_fee_payer'
    );
  END IF;
  
  -- Expiration validation
  IF p_expiration_minutes IS NULL OR p_expiration_minutes < 5 OR p_expiration_minutes > 525600 THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', 'Expiration minutes must be between 5 and 525600',
      'code', 'invalid_expiration'
    );
  END IF;
  
  -- ===============================================================
  -- BUSINESS LOGIC
  -- ===============================================================
  
  -- Generate unique payment link token
  v_payment_link_token := 'pl_' || encode(gen_random_bytes(16), 'hex');
  
  -- Calculate expiration
  v_expires_at := now() + (p_expiration_minutes || ' minutes')::INTERVAL;
  
  -- Calculate final amount (could add fee logic here)
  v_final_amount := p_amount;
  
  -- Get merchant name for metadata
  SELECT COALESCE(full_name, email) INTO v_merchant_name
  FROM auth.users
  WHERE id = v_user_id;
  
  -- ===============================================================
  -- CREATE PAYMENT LINK
  -- ===============================================================
  
  INSERT INTO public.payment_links (
    payment_link_token,
    merchant_user_id,
    amount,
    currency,
    description,
    customer_email,
    customer_name,
    collect_address,
    collect_phone,
    redirect_url,
    expires_at,
    items,
    fee_payer,
    metadata,
    status
  ) VALUES (
    v_payment_link_token,
    v_user_id,
    v_final_amount,
    UPPER(TRIM(p_currency)),
    p_description,
    p_customer_email,
    p_customer_name,
    p_collect_address,
    p_collect_phone,
    p_redirect_url,
    v_expires_at,
    p_items,
    p_fee_payer,
    jsonb_build_object(
      'created_by', v_merchant_name,
      'api_version', '1.0',
      'fee_payer', p_fee_payer
    ),
    'active'
  ) RETURNING id INTO v_payment_link_id;
  
  -- Generate checkout URL
  v_checkout_url := 'https://openpay.app/pay/' || v_payment_link_token;
  
  -- Update the record with checkout URL
  UPDATE public.payment_links
  SET checkout_url = v_checkout_url,
      updated_at = now()
  WHERE id = v_payment_link_id;
  
  -- ===============================================================
  -- RETURN SUCCESS RESPONSE
  -- ===============================================================
  
  RETURN jsonb_build_object(
    'status', 'success',
    'payment_link_id', v_payment_link_id,
    'payment_link_token', v_payment_link_token,
    'checkout_url', v_checkout_url,
    'amount', v_final_amount,
    'currency', UPPER(TRIM(p_currency)),
    'expires_at', v_expires_at,
    'created_at', now()
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'error', SQLERRM,
      'code', 'internal_error'
    );
END;
$$;

-- ===============================================================
-- 3. SECURITY POLICIES
-- ===============================================================

-- Policy: Merchants can create payment links
CREATE POLICY "Merchants can create payment links" ON public.payment_links
  FOR INSERT
  WITH CHECK (auth.uid() = merchant_user_id);

-- Policy: Merchants can view their own payment links
CREATE POLICY "Merchants can view own payment links" ON public.payment_links
  FOR SELECT
  USING (auth.uid() = merchant_user_id);

-- Policy: Merchants can update their own payment links
CREATE POLICY "Merchants can update own payment links" ON public.payment_links
  FOR UPDATE
  USING (auth.uid() = merchant_user_id)
  WITH CHECK (auth.uid() = merchant_user_id);

-- ===============================================================
-- 4. UTILITY FUNCTIONS
-- ===============================================================

-- Function to get payment link details
CREATE OR REPLACE FUNCTION public.get_payment_link(
  p_payment_link_token TEXT
)
RETURNS TABLE (
  id UUID,
  payment_link_token TEXT,
  amount NUMERIC,
  currency TEXT,
  description TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  checkout_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.payment_link_token,
    pl.amount,
    pl.currency,
    pl.description,
    pl.status,
    pl.expires_at,
    pl.checkout_url,
    pl.created_at
  FROM public.payment_links pl
  WHERE pl.payment_link_token = p_payment_link_token
    AND (pl.status = 'active' OR (pl.status = 'completed' AND pl.expires_at > now()))
    AND (auth.uid() IS NULL OR auth.uid() = pl.merchant_user_id);
END;
$$;

-- Function to list merchant's payment links
CREATE OR REPLACE FUNCTION public.list_merchant_payment_links(
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  payment_link_token TEXT,
  amount NUMERIC,
  currency TEXT,
  description TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  checkout_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.payment_link_token,
    pl.amount,
    pl.currency,
    pl.description,
    pl.status,
    pl.expires_at,
    pl.checkout_url,
    pl.created_at
  FROM public.payment_links pl
  WHERE pl.merchant_user_id = auth.uid()
    AND (p_status IS NULL OR pl.status = p_status)
  ORDER BY pl.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

-- ===============================================================
-- 5. PERMISSIONS
-- ===============================================================

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.payment_links TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_merchant_payment_link(
  NUMERIC, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, INTEGER, TEXT, JSONB
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payment_link(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_merchant_payment_links(TEXT, INTEGER, INTEGER) TO authenticated;

-- Grant limited permissions to anonymous users (for payment link access)
GRANT EXECUTE ON FUNCTION public.get_payment_link(TEXT) TO anon;

-- ===============================================================
-- 6. SCHEMA RELOAD
-- ===============================================================

NOTIFY pgrst, 'reload schema';

-- ===============================================================
-- 7. COMPLETION MESSAGE
-- ===============================================================

DO $$
BEGIN
  RAISE NOTICE 'OpenPay Payment Links System Created Successfully!';
  RAISE NOTICE '1. payment_links table with comprehensive schema';
  RAISE NOTICE '2. create_merchant_payment_link RPC function';
  RAISE NOTICE '3. Security policies enabled';
  RAISE NOTICE '4. Utility functions created';
  RAISE NOTICE '5. Production-ready Stripe-like architecture';
END $$;
