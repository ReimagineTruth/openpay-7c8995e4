-- Add checkout settings for merchant payment links (shipping/tax/discount/handling/quantity)

CREATE TABLE IF NOT EXISTS public.merchant_payment_link_checkout_settings (
  link_id UUID PRIMARY KEY REFERENCES public.merchant_payment_links(id) ON DELETE CASCADE,
  require_shipping_address BOOLEAN NOT NULL DEFAULT false,
  shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
  tax_rate NUMERIC(8,6) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 1),
  discount_type TEXT NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'percent', 'fixed')),
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  handling_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (handling_fee >= 0),
  allow_quantity BOOLEAN NOT NULL DEFAULT false,
  max_quantity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (max_quantity IS NULL OR max_quantity >= 1)
);

CREATE INDEX IF NOT EXISTS idx_mpl_checkout_settings_link
ON public.merchant_payment_link_checkout_settings (link_id);

ALTER TABLE public.merchant_payment_link_checkout_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_payment_link_checkout_settings'
      AND policyname = 'Users can view own payment link checkout settings'
  ) THEN
    CREATE POLICY "Users can view own payment link checkout settings"
      ON public.merchant_payment_link_checkout_settings
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.merchant_payment_links mpl
          WHERE mpl.id = link_id
            AND mpl.merchant_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_payment_link_checkout_settings'
      AND policyname = 'Users can insert own payment link checkout settings'
  ) THEN
    CREATE POLICY "Users can insert own payment link checkout settings"
      ON public.merchant_payment_link_checkout_settings
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.merchant_payment_links mpl
          WHERE mpl.id = link_id
            AND mpl.merchant_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_payment_link_checkout_settings'
      AND policyname = 'Users can update own payment link checkout settings'
  ) THEN
    CREATE POLICY "Users can update own payment link checkout settings"
      ON public.merchant_payment_link_checkout_settings
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.merchant_payment_links mpl
          WHERE mpl.id = link_id
            AND mpl.merchant_user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.merchant_payment_links mpl
          WHERE mpl.id = link_id
            AND mpl.merchant_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'merchant_payment_link_checkout_settings'
      AND policyname = 'Users can delete own payment link checkout settings'
  ) THEN
    CREATE POLICY "Users can delete own payment link checkout settings"
      ON public.merchant_payment_link_checkout_settings
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.merchant_payment_links mpl
          WHERE mpl.id = link_id
            AND mpl.merchant_user_id = auth.uid()
        )
      );
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_mpl_checkout_settings_updated_at ON public.merchant_payment_link_checkout_settings;
CREATE TRIGGER trg_mpl_checkout_settings_updated_at
  BEFORE UPDATE ON public.merchant_payment_link_checkout_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_common_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_my_payment_link_checkout_settings(
  p_link_id UUID,
  p_require_shipping_address BOOLEAN DEFAULT NULL,
  p_shipping_fee NUMERIC DEFAULT NULL,
  p_tax_rate NUMERIC DEFAULT NULL,
  p_discount_type TEXT DEFAULT NULL,
  p_discount_value NUMERIC DEFAULT NULL,
  p_handling_fee NUMERIC DEFAULT NULL,
  p_allow_quantity BOOLEAN DEFAULT NULL,
  p_max_quantity INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.merchant_payment_links;
BEGIN
  SELECT *
  INTO v_link
  FROM public.merchant_payment_links mpl
  WHERE mpl.id = p_link_id
    AND mpl.merchant_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment link not found or access denied';
  END IF;

  INSERT INTO public.merchant_payment_link_checkout_settings (
    link_id,
    require_shipping_address,
    shipping_fee,
    tax_rate,
    discount_type,
    discount_value,
    handling_fee,
    allow_quantity,
    max_quantity
  )
  VALUES (
    p_link_id,
    COALESCE(p_require_shipping_address, false),
    ROUND(COALESCE(p_shipping_fee, 0)::NUMERIC, 2),
    COALESCE(p_tax_rate, 0),
    COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_discount_type, 'none'))), ''), 'none'),
    ROUND(COALESCE(p_discount_value, 0)::NUMERIC, 2),
    ROUND(COALESCE(p_handling_fee, 0)::NUMERIC, 2),
    COALESCE(p_allow_quantity, false),
    p_max_quantity
  )
  ON CONFLICT (link_id) DO UPDATE
  SET require_shipping_address = COALESCE(p_require_shipping_address, public.merchant_payment_link_checkout_settings.require_shipping_address),
      shipping_fee = ROUND(COALESCE(p_shipping_fee, public.merchant_payment_link_checkout_settings.shipping_fee)::NUMERIC, 2),
      tax_rate = COALESCE(p_tax_rate, public.merchant_payment_link_checkout_settings.tax_rate),
      discount_type = COALESCE(NULLIF(LOWER(TRIM(COALESCE(p_discount_type, public.merchant_payment_link_checkout_settings.discount_type))), ''), public.merchant_payment_link_checkout_settings.discount_type),
      discount_value = ROUND(COALESCE(p_discount_value, public.merchant_payment_link_checkout_settings.discount_value)::NUMERIC, 2),
      handling_fee = ROUND(COALESCE(p_handling_fee, public.merchant_payment_link_checkout_settings.handling_fee)::NUMERIC, 2),
      allow_quantity = COALESCE(p_allow_quantity, public.merchant_payment_link_checkout_settings.allow_quantity),
      max_quantity = COALESCE(p_max_quantity, public.merchant_payment_link_checkout_settings.max_quantity),
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_my_payment_link_checkout_settings(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_my_payment_link_checkout_settings(UUID, BOOLEAN, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, BOOLEAN, INTEGER) TO authenticated, service_role;

-- Apply checkout settings when creating sessions from payment links, and expose the breakdown publicly.

CREATE OR REPLACE FUNCTION public.create_checkout_session_from_payment_link(
  p_link_token TEXT,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  session_id UUID,
  session_token TEXT,
  total_amount NUMERIC,
  currency TEXT,
  expires_at TIMESTAMPTZ,
  after_payment_type TEXT,
  confirmation_message TEXT,
  redirect_url TEXT,
  call_to_action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.merchant_payment_links;
  v_settings public.merchant_payment_link_checkout_settings;
  v_session public.merchant_checkout_sessions;

  v_items_subtotal NUMERIC(12,2) := 0;
  v_shipping_fee NUMERIC(12,2) := 0;
  v_handling_fee NUMERIC(12,2) := 0;
  v_tax_rate NUMERIC(8,6) := 0;
  v_tax_amount NUMERIC(12,2) := 0;
  v_discount_type TEXT := 'none';
  v_discount_value NUMERIC(12,2) := 0;
  v_discount_amount NUMERIC(12,2) := 0;
  v_total_before_fee NUMERIC(12,2) := 0;

  v_require_shipping_address BOOLEAN := false;
  v_allow_quantity BOOLEAN := false;
  v_max_quantity INTEGER := NULL;

  v_fee_payer TEXT := 'customer';
  v_fee_amount NUMERIC(12,2) := 0;
  v_total_due NUMERIC(12,2) := 0;
  v_merchant_settlement NUMERIC(12,2) := 0;
BEGIN
  SELECT *
  INTO v_link
  FROM public.merchant_payment_links mpl
  WHERE mpl.link_token = TRIM(COALESCE(p_link_token, ''))
    AND mpl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment link not found';
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RAISE EXCEPTION 'Payment link expired';
  END IF;

  SELECT *
  INTO v_settings
  FROM public.merchant_payment_link_checkout_settings s
  WHERE s.link_id = v_link.id
  LIMIT 1;

  IF FOUND THEN
    v_require_shipping_address := COALESCE(v_settings.require_shipping_address, false);
    v_shipping_fee := ROUND(COALESCE(v_settings.shipping_fee, 0), 2);
    v_handling_fee := ROUND(COALESCE(v_settings.handling_fee, 0), 2);
    v_tax_rate := COALESCE(v_settings.tax_rate, 0);
    v_discount_type := COALESCE(NULLIF(LOWER(TRIM(COALESCE(v_settings.discount_type, 'none'))), ''), 'none');
    v_discount_value := ROUND(COALESCE(v_settings.discount_value, 0), 2);
    v_allow_quantity := COALESCE(v_settings.allow_quantity, false);
    v_max_quantity := v_settings.max_quantity;
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
    success_url,
    cancel_url,
    metadata,
    expires_at
  )
  VALUES (
    v_link.merchant_user_id,
    v_link.api_key_id,
    v_link.key_mode,
    'opsess_' || public.random_token_hex(24),
    'open',
    v_link.currency,
    0,
    0,
    0,
    NULLIF(TRIM(COALESCE(p_customer_email, '')), ''),
    NULLIF(TRIM(COALESCE(p_customer_name, '')), ''),
    NULL,
    NULL,
    jsonb_build_object(
      'payment_link_id', v_link.id,
      'payment_link_token', v_link.link_token,
      'api_key_id', v_link.api_key_id,
      'after_payment_type', v_link.after_payment_type,
      'confirmation_message', v_link.confirmation_message,
      'redirect_url', v_link.redirect_url,
      'call_to_action', v_link.call_to_action,
      'require_shipping_address', v_require_shipping_address,
      'allow_quantity', v_allow_quantity,
      'max_quantity', v_max_quantity
    ),
    now() + INTERVAL '60 minutes'
  )
  RETURNING * INTO v_session;

  IF v_link.link_type = 'custom_amount' THEN
    v_items_subtotal := ROUND(COALESCE(v_link.custom_amount, 0), 2);

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
      v_link.title,
      v_items_subtotal,
      1,
      v_items_subtotal
    );
  ELSE
    INSERT INTO public.merchant_checkout_session_items (
      session_id,
      product_id,
      item_name,
      unit_amount,
      quantity,
      line_total
    )
    SELECT
      v_session.id,
      mpli.product_id,
      mpli.item_name,
      mpli.unit_amount,
      mpli.quantity,
      mpli.line_total
    FROM public.merchant_payment_link_items mpli
    WHERE mpli.link_id = v_link.id;

    SELECT COALESCE(SUM(mpli.line_total), 0)
    INTO v_items_subtotal
    FROM public.merchant_payment_link_items mpli
    WHERE mpli.link_id = v_link.id;

    SELECT LOWER(COALESCE(NULLIF(TRIM(prod.metadata->>'fee_payer'), ''), 'customer'))
    INTO v_fee_payer
    FROM public.merchant_payment_link_items mpli
    JOIN public.merchant_products prod
      ON prod.id = mpli.product_id
    WHERE mpli.link_id = v_link.id
    ORDER BY mpli.created_at ASC
    LIMIT 1;
  END IF;

  IF v_items_subtotal <= 0 THEN
    RAISE EXCEPTION 'Payment link total must be positive';
  END IF;

  IF v_discount_type = 'percent' THEN
    v_discount_amount := ROUND(v_items_subtotal * (LEAST(GREATEST(v_discount_value, 0), 100) / 100), 2);
  ELSIF v_discount_type = 'fixed' THEN
    v_discount_amount := ROUND(LEAST(GREATEST(v_discount_value, 0), v_items_subtotal), 2);
  ELSE
    v_discount_amount := 0;
  END IF;

  v_total_before_fee := ROUND(v_items_subtotal - v_discount_amount + v_shipping_fee + v_handling_fee, 2);
  v_tax_amount := ROUND(GREATEST(v_total_before_fee, 0) * LEAST(GREATEST(v_tax_rate, 0), 1), 2);
  v_total_before_fee := ROUND(GREATEST(v_total_before_fee + v_tax_amount, 0), 2);

  v_fee_amount := ROUND(v_total_before_fee * 0.02, 2);
  v_total_due := CASE WHEN v_fee_payer = 'customer' THEN ROUND(v_total_before_fee + v_fee_amount, 2) ELSE ROUND(v_total_before_fee, 2) END;
  v_merchant_settlement := CASE WHEN v_fee_payer = 'merchant' THEN GREATEST(ROUND(v_total_before_fee - v_fee_amount, 2), 0) ELSE ROUND(v_total_before_fee, 2) END;

  UPDATE public.merchant_checkout_sessions
  SET subtotal_amount = v_items_subtotal,
      fee_amount = v_fee_amount,
      total_amount = v_total_due,
      metadata = COALESCE(v_session.metadata, '{}'::jsonb) || jsonb_build_object(
        'fee_percent', 2,
        'fee_payer', v_fee_payer,
        'merchant_settlement_amount', v_merchant_settlement,
        'openpay_fee_amount', v_fee_amount,
        'checkout_items_subtotal', v_items_subtotal,
        'shipping_fee', v_shipping_fee,
        'handling_fee', v_handling_fee,
        'discount_type', v_discount_type,
        'discount_value', v_discount_value,
        'discount_amount', v_discount_amount,
        'tax_rate', v_tax_rate,
        'tax_amount', v_tax_amount,
        'total_before_fee', v_total_before_fee
      )
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.session_token,
    v_session.total_amount,
    v_session.currency,
    v_session.expires_at,
    v_link.after_payment_type,
    v_link.confirmation_message,
    v_link.redirect_url,
    v_link.call_to_action;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_merchant_checkout_session(
  p_session_token TEXT
)
RETURNS TABLE (
  session_id UUID,
  status TEXT,
  mode TEXT,
  currency TEXT,
  amount NUMERIC,
  subtotal_amount NUMERIC,
  fee_amount NUMERIC,
  fee_payer TEXT,
  merchant_settlement_amount NUMERIC,
  shipping_fee NUMERIC,
  handling_fee NUMERIC,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  total_before_fee NUMERIC,
  require_shipping_address BOOLEAN,
  expires_at TIMESTAMPTZ,
  merchant_user_id UUID,
  merchant_name TEXT,
  merchant_username TEXT,
  merchant_logo_url TEXT,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.merchant_checkout_sessions;
  v_fee_payer TEXT;
  v_settlement NUMERIC(12,2);
  v_shipping NUMERIC(12,2);
  v_handling NUMERIC(12,2);
  v_discount_type TEXT;
  v_discount_value NUMERIC(12,2);
  v_discount_amount NUMERIC(12,2);
  v_tax_rate NUMERIC(8,6);
  v_tax_amount NUMERIC(12,2);
  v_total_before_fee NUMERIC(12,2);
  v_require_shipping BOOLEAN;
BEGIN
  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_session.status = 'open' AND v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id
      AND status = 'open';

    SELECT *
    INTO v_session
    FROM public.merchant_checkout_sessions
    WHERE id = v_session.id;
  END IF;

  v_fee_payer := LOWER(COALESCE(NULLIF(TRIM(v_session.metadata->>'fee_payer'), ''), 'customer'));
  v_settlement := COALESCE(
    NULLIF(TRIM(v_session.metadata->>'merchant_settlement_amount'), '')::NUMERIC,
    CASE
      WHEN v_fee_payer = 'merchant' THEN GREATEST(COALESCE(v_session.subtotal_amount, 0) - COALESCE(v_session.fee_amount, 0), 0)
      ELSE COALESCE(v_session.subtotal_amount, COALESCE(v_session.total_amount, 0))
    END
  );

  v_shipping := COALESCE(NULLIF(TRIM(v_session.metadata->>'shipping_fee'), '')::NUMERIC, 0);
  v_handling := COALESCE(NULLIF(TRIM(v_session.metadata->>'handling_fee'), '')::NUMERIC, 0);
  v_discount_type := COALESCE(NULLIF(LOWER(TRIM(v_session.metadata->>'discount_type')), ''), 'none');
  v_discount_value := COALESCE(NULLIF(TRIM(v_session.metadata->>'discount_value'), '')::NUMERIC, 0);
  v_discount_amount := COALESCE(NULLIF(TRIM(v_session.metadata->>'discount_amount'), '')::NUMERIC, 0);
  v_tax_rate := COALESCE(NULLIF(TRIM(v_session.metadata->>'tax_rate'), '')::NUMERIC, 0);
  v_tax_amount := COALESCE(NULLIF(TRIM(v_session.metadata->>'tax_amount'), '')::NUMERIC, 0);
  v_total_before_fee := COALESCE(NULLIF(TRIM(v_session.metadata->>'total_before_fee'), '')::NUMERIC, COALESCE(v_session.subtotal_amount, 0));
  v_require_shipping := COALESCE(NULLIF(TRIM(v_session.metadata->>'require_shipping_address'), '')::BOOLEAN, false);

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.status,
    v_session.key_mode,
    v_session.currency,
    v_session.total_amount,
    v_session.subtotal_amount,
    v_session.fee_amount,
    v_fee_payer,
    v_settlement,
    v_shipping,
    v_handling,
    v_discount_type,
    v_discount_value,
    v_discount_amount,
    v_tax_rate,
    v_tax_amount,
    v_total_before_fee,
    v_require_shipping,
    v_session.expires_at,
    mp.user_id,
    mp.merchant_name,
    mp.merchant_username,
    mp.merchant_logo_url,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', mcsi.product_id,
            'item_name', mcsi.item_name,
            'quantity', mcsi.quantity,
            'unit_amount', mcsi.unit_amount,
            'line_total', mcsi.line_total,
            'item_image_url', prod.image_url,
            'item_images', CASE
              WHEN jsonb_typeof(prod.metadata->'product_images') = 'array' THEN prod.metadata->'product_images'
              ELSE '[]'::jsonb
            END,
            'product_kind', LOWER(COALESCE(prod.metadata->>'product_kind', 'physical')),
            'delivery_type', LOWER(NULLIF(COALESCE(prod.metadata->>'digital_delivery_type', ''), '')),
            'delivery_file_name', NULLIF(COALESCE(prod.metadata->>'digital_file_name', ''), ''),
            'delivery_file_data_url', NULLIF(COALESCE(prod.metadata->>'digital_file_data_url', ''), ''),
            'delivery_link_url', NULLIF(COALESCE(prod.metadata->>'digital_download_link', ''), '')
          )
          ORDER BY mcsi.created_at ASC
        )
        FROM public.merchant_checkout_session_items mcsi
        LEFT JOIN public.merchant_products prod
          ON prod.id = mcsi.product_id
        WHERE mcsi.session_id = v_session.id
      ),
      '[]'::jsonb
    )
  FROM public.merchant_profiles mp
  WHERE mp.user_id = v_session.merchant_user_id;
END;
$$;

