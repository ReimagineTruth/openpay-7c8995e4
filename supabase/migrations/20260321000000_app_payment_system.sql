-- App Payment System Migration
-- Creates tables for app payments, subscriptions, and analytics

-- Apps table - stores app information
CREATE TABLE IF NOT EXISTS public.app_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL,
  app_description TEXT,
  app_url TEXT,
  app_logo_url TEXT,
  developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_secret_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  app_public_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  webhook_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App payment plans table
CREATE TABLE IF NOT EXISTS public.app_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  plan_description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('one_time', 'recurring_monthly', 'recurring_yearly')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  trial_days INTEGER DEFAULT 0 CHECK (trial_days >= 0),
  setup_fee NUMERIC(12,2) DEFAULT 0 CHECK (setup_fee >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App subscriptions table
CREATE TABLE IF NOT EXISTS public.app_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.app_payment_plans(id) ON DELETE CASCADE,
  subscriber_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'expired', 'past_due')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  trial_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(app_id, subscriber_user_id)
);

-- App payment transactions table
CREATE TABLE IF NOT EXISTS public.app_payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.app_payment_plans(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.app_subscriptions(id) ON DELETE SET NULL,
  payer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  net_amount NUMERIC(12,2) NOT NULL CHECK (net_amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'card', 'bank_transfer')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('one_time', 'recurring', 'setup_fee', 'trial_conversion')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  external_transaction_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- App analytics table
CREATE TABLE IF NOT EXISTS public.app_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions INTEGER NOT NULL DEFAULT 0,
  canceled_subscriptions INTEGER NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  unique_payers INTEGER NOT NULL DEFAULT 0,
  refunds NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(app_id, date)
);

-- App payment links table (for embedding in apps/websites)
CREATE TABLE IF NOT EXISTS public.app_payment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES public.app_registry(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.app_payment_plans(id) ON DELETE CASCADE,
  link_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  link_name TEXT NOT NULL,
  link_description TEXT,
  redirect_url TEXT,
  custom_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  usage_count INTEGER NOT NULL DEFAULT 0,
  max_usage INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_payment_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- App registry policies
CREATE POLICY "Developers can view own apps" ON public.app_registry FOR SELECT USING (developer_user_id = auth.uid());
CREATE POLICY "Developers can insert own apps" ON public.app_registry FOR INSERT WITH CHECK (developer_user_id = auth.uid());
CREATE POLICY "Developers can update own apps" ON public.app_registry FOR UPDATE USING (developer_user_id = auth.uid());
CREATE POLICY "Developers can delete own apps" ON public.app_registry FOR DELETE USING (developer_user_id = auth.uid());

-- App payment plans policies
CREATE POLICY "Developers can view own app plans" ON public.app_payment_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_plans.app_id AND developer_user_id = auth.uid())
);
CREATE POLICY "Developers can insert own app plans" ON public.app_payment_plans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_plans.app_id AND developer_user_id = auth.uid())
);
CREATE POLICY "Developers can update own app plans" ON public.app_payment_plans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_plans.app_id AND developer_user_id = auth.uid())
);
CREATE POLICY "Developers can delete own app plans" ON public.app_payment_plans FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_plans.app_id AND developer_user_id = auth.uid())
);

-- App subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.app_subscriptions FOR SELECT USING (subscriber_user_id = auth.uid());
CREATE POLICY "Developers can view app subscriptions" ON public.app_subscriptions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_subscriptions.app_id AND developer_user_id = auth.uid())
);

-- App payment transactions policies
CREATE POLICY "Users can view own transactions" ON public.app_payment_transactions FOR SELECT USING (payer_user_id = auth.uid());
CREATE POLICY "Developers can view app transactions" ON public.app_payment_transactions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_transactions.app_id AND developer_user_id = auth.uid())
);

-- App analytics policies
CREATE POLICY "Developers can view own app analytics" ON public.app_analytics FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_analytics.app_id AND developer_user_id = auth.uid())
);

-- App payment links policies
CREATE POLICY "Developers can manage own app payment links" ON public.app_payment_links FOR ALL USING (
  EXISTS (SELECT 1 FROM public.app_registry WHERE id = app_payment_links.app_id AND developer_user_id = auth.uid())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_registry_developer ON public.app_registry(developer_user_id);
CREATE INDEX IF NOT EXISTS idx_app_payment_plans_app_id ON public.app_payment_plans(app_id);
CREATE INDEX IF NOT EXISTS idx_app_subscriptions_app_id ON public.app_subscriptions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_subscriptions_user_id ON public.app_subscriptions(subscriber_user_id);
CREATE INDEX IF NOT EXISTS idx_app_payment_transactions_app_id ON public.app_payment_transactions(app_id);
CREATE INDEX IF NOT EXISTS idx_app_payment_transactions_user_id ON public.app_payment_transactions(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_app_analytics_app_date ON public.app_analytics(app_id, date);
CREATE INDEX IF NOT EXISTS idx_app_payment_links_token ON public.app_payment_links(link_token);
CREATE INDEX IF NOT EXISTS idx_app_payment_links_app_id ON public.app_payment_links(app_id);

-- Function to create a new app
CREATE OR REPLACE FUNCTION public.create_app(
  p_app_name TEXT,
  p_app_description TEXT DEFAULT NULL,
  p_app_url TEXT DEFAULT NULL,
  p_app_logo_url TEXT DEFAULT NULL,
  p_webhook_url TEXT DEFAULT NULL
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
BEGIN
  -- Validate input
  IF p_app_name IS NULL OR TRIM(p_app_name) = '' THEN
    RAISE EXCEPTION 'App name is required';
  END IF;

  -- Create the app
  INSERT INTO public.app_registry (
    app_name,
    app_description,
    app_url,
    app_logo_url,
    webhook_url,
    developer_user_id
  ) VALUES (
    p_app_name,
    p_app_description,
    p_app_url,
    p_app_logo_url,
    p_webhook_url,
    auth.uid()
  ) RETURNING id, app_secret_key, app_public_key INTO v_app_id, v_secret_key, v_public_key;

  RETURN QUERY SELECT v_app_id, v_secret_key, v_public_key;
END;
$$;

-- Function to create a payment plan
CREATE OR REPLACE FUNCTION public.create_app_payment_plan(
  p_app_id UUID,
  p_plan_name TEXT,
  p_plan_description TEXT DEFAULT NULL,
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
BEGIN
  -- Validate app ownership
  IF NOT EXISTS (
    SELECT 1 FROM public.app_registry 
    WHERE id = p_app_id AND developer_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'App not found or access denied';
  END IF;

  -- Validate plan type
  IF p_plan_type NOT IN ('one_time', 'recurring_monthly', 'recurring_yearly') THEN
    RAISE EXCEPTION 'Invalid plan type';
  END IF;

  -- Create the plan
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
    p_plan_name,
    p_plan_description,
    p_plan_type,
    p_amount,
    p_currency,
    p_trial_days,
    p_setup_fee
  ) RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$$;

-- Function to process app payment
CREATE OR REPLACE FUNCTION public.process_app_payment(
  p_link_token TEXT,
  p_payer_user_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'wallet',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_plan RECORD;
  v_app RECORD;
  v_subscription_id UUID;
  v_transaction_id UUID;
  v_fee_amount NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
  v_payer_balance NUMERIC(12,2);
  v_dev_balance NUMERIC(12,2);
BEGIN
  -- Get payment link and validate
  SELECT * INTO v_link
  FROM public.app_payment_links
  WHERE link_token = p_link_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Invalid or expired payment link'::TEXT;
    RETURN;
  END IF;

  -- Check usage limit
  IF v_link.max_usage IS NOT NULL AND v_link.usage_count >= v_link.max_usage THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Payment link usage limit exceeded'::TEXT;
    RETURN;
  END IF;

  -- Get plan details
  SELECT * INTO v_plan
  FROM public.app_payment_plans
  WHERE id = v_link.plan_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Payment plan not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Get app details
  SELECT * INTO v_app
  FROM public.app_registry
  WHERE id = v_link.app_id AND status = 'active';

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'App not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Calculate fees (2% platform fee)
  v_fee_amount := v_plan.amount * 0.02;
  v_net_amount := v_plan.amount - v_fee_amount;

  -- Process wallet payment
  IF p_payment_method = 'wallet' THEN
    -- Get payer balance
    SELECT balance INTO v_payer_balance
    FROM public.wallets
    WHERE user_id = p_payer_user_id
    FOR UPDATE;

    IF v_payer_balance IS NULL THEN
      RETURN QUERY SELECT NULL::UUID, 'error', 'Payer wallet not found'::TEXT;
    RETURN;
    END IF;

    IF v_payer_balance < v_plan.amount THEN
      RETURN QUERY SELECT NULL::UUID, 'error', 'Insufficient balance'::TEXT;
    RETURN;
    END IF;

    -- Get developer wallet
    SELECT balance INTO v_dev_balance
    FROM public.wallets
    WHERE user_id = v_app.developer_user_id
    FOR UPDATE;

    IF v_dev_balance IS NULL THEN
      -- Create developer wallet if it doesn't exist
      INSERT INTO public.wallets (user_id, balance, updated_at)
      VALUES (v_app.developer_user_id, 0, now());
      
      v_dev_balance := 0;
    END IF;

    -- Process balance transfers
    UPDATE public.wallets
    SET balance = v_payer_balance - v_plan.amount,
        updated_at = now()
    WHERE user_id = p_payer_user_id;

    UPDATE public.wallets
    SET balance = v_dev_balance + v_net_amount,
        updated_at = now()
    WHERE user_id = v_app.developer_user_id;
  END IF;

  -- Handle subscription logic
  IF v_plan.plan_type IN ('recurring_monthly', 'recurring_yearly') THEN
    -- Check if subscription already exists
    SELECT id INTO v_subscription_id
    FROM public.app_subscriptions
    WHERE app_id = v_link.app_id
      AND subscriber_user_id = p_payer_user_id
      AND status = 'active'
    FOR UPDATE;

    IF v_subscription_id IS NULL THEN
      -- Create new subscription
      INSERT INTO public.app_subscriptions (
        app_id,
        plan_id,
        subscriber_user_id,
        current_period_start,
        current_period_end,
        trial_end
      ) VALUES (
        v_link.app_id,
        v_link.plan_id,
        p_payer_user_id,
        now(),
        CASE 
          WHEN v_plan.plan_type = 'recurring_monthly' THEN now() + INTERVAL '1 month'
          WHEN v_plan.plan_type = 'recurring_yearly' THEN now() + INTERVAL '1 year'
        END,
        CASE 
          WHEN v_plan.trial_days > 0 THEN now() + (v_plan.trial_days || ' days')::INTERVAL
          ELSE NULL
        END
      ) RETURNING id INTO v_subscription_id;
    END IF;
  END IF;

  -- Create transaction record
  INSERT INTO public.app_payment_transactions (
    app_id,
    plan_id,
    subscription_id,
    payer_user_id,
    amount,
    currency,
    fee_amount,
    net_amount,
    payment_method,
    transaction_type,
    status,
    metadata
  ) VALUES (
    v_link.app_id,
    v_link.plan_id,
    v_subscription_id,
    p_payer_user_id,
    v_plan.amount,
    v_plan.currency,
    v_fee_amount,
    v_net_amount,
    p_payment_method,
    CASE 
      WHEN v_plan.plan_type = 'one_time' THEN 'one_time'
      ELSE 'recurring'
    END,
    'completed',
    jsonb_build_object(
      'payment_link_id', v_link.id,
      'customer_name', p_customer_name,
      'customer_email', p_customer_email,
      'customer_phone', p_customer_phone
    )
  ) RETURNING id INTO v_transaction_id;

  -- Update link usage count
  UPDATE public.app_payment_links
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = v_link.id;

  -- Update analytics
  INSERT INTO public.app_analytics (
    app_id,
    date,
    total_revenue,
    total_transactions,
    unique_payers,
    new_subscriptions,
    active_subscriptions
  ) VALUES (
    v_link.app_id,
    CURRENT_DATE,
    v_net_amount,
    1,
    1,
    CASE WHEN v_subscription_id IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN v_subscription_id IS NOT NULL THEN 1 ELSE 0 END
  ) ON CONFLICT (app_id, date) DO UPDATE SET
    total_revenue = app_analytics.total_revenue + EXCLUDED.total_revenue,
    total_transactions = app_analytics.total_transactions + EXCLUDED.total_transactions,
    unique_payers = app_analytics.unique_payers + EXCLUDED.unique_payers,
    new_subscriptions = app_analytics.new_subscriptions + EXCLUDED.new_subscriptions,
    active_subscriptions = app_analytics.active_subscriptions + EXCLUDED.active_subscriptions,
    updated_at = now();

  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    'success'::TEXT,
    'Payment processed successfully'::TEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_app(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_app_payment_plan(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INTEGER, NUMERIC) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_app_payment(TEXT, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
