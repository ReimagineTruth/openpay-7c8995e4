-- POS workflow hotfix (merchant-pos)
-- Ensures POS sessions are linked to the configured Merchant Portal API key,
-- and ensures payment inserts update checkout session status for POS polling.

-- 1) Ensure POS API settings table exists (for api_key lookup).
CREATE TABLE IF NOT EXISTS public.merchant_pos_api_settings (
  merchant_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sandbox_api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
  live_api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_pos_api_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_pos_api_settings'
      AND policyname = 'Users can view own merchant pos api settings'
  ) THEN
    CREATE POLICY "Users can view own merchant pos api settings"
      ON public.merchant_pos_api_settings
      FOR SELECT TO authenticated
      USING (merchant_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_pos_api_settings'
      AND policyname = 'Users can insert own merchant pos api settings'
  ) THEN
    CREATE POLICY "Users can insert own merchant pos api settings"
      ON public.merchant_pos_api_settings
      FOR INSERT TO authenticated
      WITH CHECK (merchant_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_pos_api_settings'
      AND policyname = 'Users can update own merchant pos api settings'
  ) THEN
    CREATE POLICY "Users can update own merchant pos api settings"
      ON public.merchant_pos_api_settings
      FOR UPDATE TO authenticated
      USING (merchant_user_id = auth.uid())
      WITH CHECK (merchant_user_id = auth.uid());
  END IF;
END $$;

-- 2) Ensure checkout sessions can reference the API key used by POS/checkout.
ALTER TABLE public.merchant_checkout_sessions
ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.merchant_api_keys(id) ON DELETE SET NULL;

-- 3) POS session creation must attach the active API key for the selected mode.
DROP FUNCTION IF EXISTS public.create_my_pos_checkout_session(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.create_my_pos_checkout_session(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.create_my_pos_checkout_session(
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'USD',
  p_mode TEXT DEFAULT 'live',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_qr_style TEXT DEFAULT 'dynamic',
  p_expires_in_minutes INTEGER DEFAULT 30,
  p_secret_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  qr_payload TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_currency TEXT := UPPER(TRIM(COALESCE(p_currency, 'USD')));
  v_qr_style TEXT := LOWER(TRIM(COALESCE(p_qr_style, 'dynamic')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_expires_minutes INTEGER := GREATEST(5, LEAST(COALESCE(p_expires_in_minutes, 30), 10080));
  v_secret_hash TEXT := md5(COALESCE(p_secret_key, ''));
  v_api_key_id UUID;
  v_api_key_ok BOOLEAN := false;
  v_session public.merchant_checkout_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF char_length(v_currency) <> 3 THEN
    RAISE EXCEPTION 'Currency must be 3 letters';
  END IF;

  IF v_qr_style NOT IN ('dynamic', 'static') THEN
    RAISE EXCEPTION 'QR style must be dynamic or static';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- If a secret key is provided, validate it; else use merchant POS settings for the mode.
  IF NULLIF(TRIM(COALESCE(p_secret_key, '')), '') IS NOT NULL THEN
    SELECT mak.id
    INTO v_api_key_id
    FROM public.merchant_api_keys mak
    WHERE mak.merchant_user_id = v_user_id
      AND mak.key_mode = v_mode
      AND mak.is_active = true
      AND mak.secret_key_hash = v_secret_hash
    LIMIT 1;
  ELSE
    SELECT
      CASE
        WHEN v_mode = 'sandbox' THEN s.sandbox_api_key_id
        ELSE s.live_api_key_id
      END
    INTO v_api_key_id
    FROM public.merchant_pos_api_settings s
    WHERE s.merchant_user_id = v_user_id
    LIMIT 1;
  END IF;

  IF v_api_key_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.merchant_api_keys mak
      WHERE mak.id = v_api_key_id
        AND mak.merchant_user_id = v_user_id
        AND mak.key_mode = v_mode
        AND mak.is_active = true
    )
    INTO v_api_key_ok;
  END IF;

  IF NOT v_api_key_ok THEN
    RAISE EXCEPTION 'Set your % POS API key in Settings first (from Merchant Portal / API keys)', v_mode;
  END IF;

  PERFORM public.upsert_my_merchant_profile(NULL, NULL, NULL, v_currency);

  IF v_qr_style = 'static' THEN
    v_expires_minutes := GREATEST(v_expires_minutes, 1440);
  END IF;

  INSERT INTO public.merchant_checkout_sessions (
    merchant_user_id,
    api_key_id,
    key_mode,
    session_token,
    status,
    currency,
    subtotal_amount,
    fee_amount,
    total_amount,
    customer_email,
    customer_name,
    metadata,
    expires_at
  )
  VALUES (
    v_user_id,
    v_api_key_id,
    v_mode,
    'opsess_' || public.random_token_hex(24),
    'open',
    v_currency,
    v_amount,
    0,
    v_amount,
    NULLIF(TRIM(COALESCE(p_customer_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    jsonb_strip_nulls(
      jsonb_build_object(
        'channel', 'pos',
        'source', 'merchant_pos',
        'api_key_id', v_api_key_id::TEXT,
        'qr_style', v_qr_style,
        'reference', NULLIF(TRIM(COALESCE(p_reference, '')), '')
      )
    ),
    now() + make_interval(mins => v_expires_minutes)
  )
  RETURNING * INTO v_session;

  INSERT INTO public.merchant_checkout_session_items (
    session_id,
    product_id,
    item_name,
    unit_amount,
    quantity,
    line_total
  )
  VALUES (
    v_session.id,
    NULL,
    'POS Payment',
    v_amount,
    1,
    v_amount
  );

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.status,
    v_session.expires_at,
    'openpay-pos://checkout/' || v_session.session_token;
END;
$$;

-- 4) When a merchant payment is created, ensure the checkout session is marked paid (POS polling relies on this).
CREATE OR REPLACE FUNCTION public.update_checkout_session_payment_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.merchant_checkout_sessions mcs
    SET
      status = 'paid',
      paid_at = NEW.created_at,
      updated_at = NEW.created_at
    WHERE mcs.id = NEW.session_id
      AND mcs.status = 'open';
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkout_session_payment_update ON public.merchant_payments;
CREATE TRIGGER trg_checkout_session_payment_update
AFTER INSERT ON public.merchant_payments
FOR EACH ROW EXECUTE FUNCTION public.update_checkout_session_payment_details();

-- 4b) Ensure authenticated users can view merchant_payments if they are the merchant or buyer.
ALTER TABLE public.merchant_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_payments'
      AND policyname = 'Merchant or buyer can view merchant payments'
  ) THEN
    CREATE POLICY "Merchant or buyer can view merchant payments"
      ON public.merchant_payments
      FOR SELECT TO authenticated
      USING (merchant_user_id = auth.uid() OR buyer_user_id = auth.uid());
  END IF;
END $$;

-- 5) Backfill any sessions stuck in open despite succeeded merchant_payments.
UPDATE public.merchant_checkout_sessions mcs
SET status = 'paid',
    paid_at = mp.created_at,
    updated_at = mp.created_at
FROM public.merchant_payments mp
WHERE mcs.id = mp.session_id
  AND mcs.status = 'open'
  AND mp.status = 'succeeded';

-- Notify schema reload for PostgREST.
NOTIFY pgrst, 'reload schema';
