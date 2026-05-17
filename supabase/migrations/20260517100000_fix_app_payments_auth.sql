-- Fix authenticated access for the app payments dashboard.
-- The edge function now executes dashboard queries with the signed-in user's JWT,
-- so the underlying tables need explicit grants and a proper INSERT policy.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_payment_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.app_payment_links TO authenticated;
GRANT SELECT ON TABLE public.app_analytics TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.app_subscriptions TO authenticated;
GRANT SELECT ON TABLE public.app_payment_transactions TO authenticated;

DROP POLICY IF EXISTS "Developers can manage own app payment links" ON public.app_payment_links;

CREATE POLICY "Developers can view own app payment links"
ON public.app_payment_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = app_payment_links.app_id
      AND developer_user_id = auth.uid()
  )
);

CREATE POLICY "Developers can insert own app payment links"
ON public.app_payment_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = app_payment_links.app_id
      AND developer_user_id = auth.uid()
  )
);

CREATE POLICY "Developers can update own app payment links"
ON public.app_payment_links
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = app_payment_links.app_id
      AND developer_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = app_payment_links.app_id
      AND developer_user_id = auth.uid()
  )
);

CREATE POLICY "Developers can delete own app payment links"
ON public.app_payment_links
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = app_payment_links.app_id
      AND developer_user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.create_app(
  p_app_name TEXT,
  p_app_description TEXT,
  p_app_url TEXT,
  p_app_logo_url TEXT,
  p_webhook_url TEXT
)
RETURNS TABLE (
  app_id UUID,
  app_secret_key TEXT,
  app_public_key TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app_id UUID;
  v_secret_key TEXT;
  v_public_key TEXT;
  v_developer_user_id UUID;
BEGIN
  v_developer_user_id := auth.uid();

  IF v_developer_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create an app';
  END IF;

  IF p_app_name IS NULL OR TRIM(p_app_name) = '' THEN
    RAISE EXCEPTION 'App name is required';
  END IF;

  INSERT INTO public.app_registry (
    app_name,
    app_description,
    app_url,
    app_logo_url,
    webhook_url,
    developer_user_id
  ) VALUES (
    TRIM(p_app_name),
    NULLIF(TRIM(COALESCE(p_app_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_app_url, '')), ''),
    NULLIF(TRIM(COALESCE(p_app_logo_url, '')), ''),
    NULLIF(TRIM(COALESCE(p_webhook_url, '')), ''),
    v_developer_user_id
  )
  RETURNING id, app_secret_key, app_public_key
  INTO v_app_id, v_secret_key, v_public_key;

  RETURN QUERY SELECT v_app_id, v_secret_key, v_public_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_app_payment_plan(
  p_app_id UUID,
  p_plan_name TEXT,
  p_plan_description TEXT,
  p_plan_type TEXT,
  p_amount NUMERIC(12,2),
  p_currency TEXT DEFAULT 'USD',
  p_trial_days INTEGER DEFAULT 0,
  p_setup_fee NUMERIC(12,2) DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
  v_developer_user_id UUID;
BEGIN
  v_developer_user_id := auth.uid();

  IF v_developer_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a payment plan';
  END IF;

  IF p_plan_name IS NULL OR TRIM(p_plan_name) = '' THEN
    RAISE EXCEPTION 'Plan name is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than 0';
  END IF;

  IF p_plan_type NOT IN ('one_time', 'recurring_monthly', 'recurring_yearly') THEN
    RAISE EXCEPTION 'Invalid plan type';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.app_registry
    WHERE id = p_app_id
      AND developer_user_id = v_developer_user_id
  ) THEN
    RAISE EXCEPTION 'App not found or access denied';
  END IF;

  INSERT INTO public.app_payment_plans (
    app_id,
    plan_name,
    plan_description,
    plan_type,
    amount,
    currency,
    trial_days,
    setup_fee
  ) VALUES (
    p_app_id,
    TRIM(p_plan_name),
    NULLIF(TRIM(COALESCE(p_plan_description, '')), ''),
    p_plan_type,
    p_amount,
    COALESCE(NULLIF(TRIM(COALESCE(p_currency, '')), ''), 'USD'),
    COALESCE(p_trial_days, 0),
    COALESCE(p_setup_fee, 0)
  )
  RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$$;
