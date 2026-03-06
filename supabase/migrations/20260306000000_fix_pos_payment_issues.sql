-- Fix POS payment issues
-- This migration fixes several issues with POS payment processing

-- 1. Ensure merchant_payments table has proper triggers for ledger updates
CREATE OR REPLACE FUNCTION public.update_merchant_payment_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into ledger_events when merchant payment is created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ledger_events (
      source_table,
      source_id,
      event_type,
      actor_user_id,
      related_user_id,
      amount,
      status,
      note,
      payload,
      occurred_at
    )
    VALUES (
      'merchant_payments',
      NEW.id,
      'merchant_payment_created',
      NEW.buyer_user_id,
      NEW.merchant_user_id,
      NEW.amount,
      NEW.status,
      'POS payment completed',
      jsonb_build_object(
        'session_id', NEW.session_id,
        'transaction_id', NEW.transaction_id,
        'currency', NEW.currency,
        'payment_method', 'wallet'
      ),
      NEW.created_at
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- 2. Create trigger for merchant payments ledger updates
DROP TRIGGER IF EXISTS trg_merchant_payment_ledger ON public.merchant_payments;
CREATE TRIGGER trg_merchant_payment_ledger
AFTER INSERT ON public.merchant_payments
FOR EACH ROW EXECUTE FUNCTION public.update_merchant_payment_ledger();

-- 3. Fix POS dashboard function to ensure it counts today's transactions correctly
CREATE OR REPLACE FUNCTION public.get_my_pos_dashboard(
  p_mode TEXT DEFAULT 'live'
)
RETURNS TABLE (
  merchant_name TEXT,
  merchant_username TEXT,
  wallet_balance NUMERIC,
  today_total_received NUMERIC,
  today_transactions INTEGER,
  refunded_transactions INTEGER,
  key_mode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  PERFORM public.upsert_my_merchant_profile(NULL, NULL, NULL, NULL);

  RETURN QUERY
  SELECT
    mpf.merchant_name,
    mpf.merchant_username,
    COALESCE(w.balance, 0)::NUMERIC AS wallet_balance,
    COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0)::NUMERIC AS today_total_received,
    COUNT(*) FILTER (WHERE p.status = 'succeeded')::INTEGER AS today_transactions,
    COUNT(*) FILTER (WHERE p.status = 'refunded')::INTEGER AS refunded_transactions,
    v_mode AS key_mode
  FROM public.merchant_profiles mpf
  LEFT JOIN public.wallets w
    ON w.user_id = mpf.user_id
  LEFT JOIN public.merchant_payments p
    ON p.merchant_user_id = mpf.user_id
   AND p.key_mode = v_mode
   AND DATE(p.created_at) = DATE(now())
  WHERE mpf.user_id = v_user_id
  GROUP BY mpf.merchant_name, mpf.merchant_username, w.balance;
END;
$$;

-- 4. Ensure merchant checkout sessions are properly updated with payment details
CREATE OR REPLACE FUNCTION public.update_checkout_session_payment_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When merchant payment is created, update the checkout session
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

-- 5. Create trigger for checkout session updates
DROP TRIGGER IF EXISTS trg_checkout_session_payment_update ON public.merchant_payments;
CREATE TRIGGER trg_checkout_session_payment_update
AFTER INSERT ON public.merchant_payments
FOR EACH ROW EXECUTE FUNCTION public.update_checkout_session_payment_details();

-- 6. Fix any existing checkout sessions that might be stuck
UPDATE public.merchant_checkout_sessions mcs
SET status = 'paid',
    paid_at = mp.created_at,
    updated_at = mp.created_at
FROM public.merchant_payments mp
WHERE mcs.id = mp.session_id
  AND mcs.status = 'open'
  AND mp.status = 'succeeded';

-- 7. Add function to get POS transactions with proper joins
CREATE OR REPLACE FUNCTION public.get_my_pos_transactions(
  p_mode TEXT DEFAULT 'live',
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  payment_id UUID,
  payment_created_at TIMESTAMPTZ,
  payment_status TEXT,
  amount NUMERIC,
  currency TEXT,
  payer_user_id UUID,
  payer_name TEXT,
  payer_username TEXT,
  transaction_id UUID,
  transaction_note TEXT,
  session_token TEXT,
  customer_name TEXT,
  customer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_status_filter TEXT := LOWER(TRIM(COALESCE(p_status, 'all')));
  v_search_term TEXT := '%' || LOWER(TRIM(COALESCE(p_search, ''))) || '%';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  RETURN QUERY
  SELECT
    mp.id::UUID,
    mp.created_at::TIMESTAMPTZ,
    mp.status::TEXT,
    mp.amount::NUMERIC,
    mp.currency::TEXT,
    mp.buyer_user_id::UUID,
    COALESCE(p.full_name, 'OpenPay Customer')::TEXT,
    p.username::TEXT,
    mp.transaction_id::UUID,
    t.note::TEXT,
    mcs.session_token::TEXT,
    mcs.customer_name::TEXT,
    mcs.customer_email::TEXT
  FROM public.merchant_payments mp
  LEFT JOIN public.profiles p ON p.id = mp.buyer_user_id
  LEFT JOIN public.transactions t ON t.id = mp.transaction_id
  LEFT JOIN public.merchant_checkout_sessions mcs ON mcs.id = mp.session_id
  WHERE mp.merchant_user_id = v_user_id
    AND mp.key_mode = v_mode
    AND (v_status_filter = 'all' OR LOWER(mp.status) = v_status_filter)
    AND (
      v_search_term = '%%' 
      OR LOWER(COALESCE(p.full_name, '')) LIKE v_search_term
      OR LOWER(COALESCE(p.username, '')) LIKE v_search_term
      OR LOWER(COALESCE(mcs.customer_name, '')) LIKE v_search_term
      OR LOWER(COALESCE(mcs.customer_email, '')) LIKE v_search_term
      OR LOWER(mcs.session_token) LIKE v_search_term
    )
  ORDER BY mp.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 1000)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.get_my_pos_dashboard(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_pos_transactions(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_pos_dashboard(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_pos_transactions(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
