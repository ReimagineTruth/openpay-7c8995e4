-- Complete Fix for Merchant Onboarding & POS Double-Crediting Issues
-- This script addresses:
-- 1. Merchant onboarding wallet setup
-- 2. POS double-crediting between personal/merchant wallets
-- 3. Ensures merchants receive payments only once

-- Step 1: Drop existing functions that cause double-crediting
DROP FUNCTION IF EXISTS public.complete_merchant_checkout_with_transaction(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID) CASCADE;

-- Step 2: Create improved merchant onboarding wallet setup
CREATE OR REPLACE FUNCTION public.ensure_merchant_wallet_setup()
RETURNS TABLE (
  user_id UUID,
  wallet_created BOOLEAN,
  wallet_balance NUMERIC,
  merchant_profile_exists BOOLEAN,
  setup_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet_exists BOOLEAN := FALSE;
  v_wallet_balance NUMERIC := 0;
  v_merchant_profile_exists BOOLEAN := FALSE;
  v_setup_status TEXT := 'completed';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check if wallet exists
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id;
  
  v_wallet_exists := (v_wallet_balance IS NOT NULL);
  
  -- Create wallet if it doesn't exist
  IF NOT v_wallet_exists THEN
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_user_id, 0, now());
    
    v_wallet_balance := 0;
    v_wallet_exists := TRUE;
  END IF;

  -- Check merchant profile
  SELECT COUNT(*) > 0 INTO v_merchant_profile_exists
  FROM public.merchant_profiles
  WHERE user_id = v_user_id;

  -- Create basic merchant profile if it doesn't exist
  IF NOT v_merchant_profile_exists THEN
    INSERT INTO public.merchant_profiles (user_id, merchant_name, default_currency)
    VALUES (v_user_id, NULL, 'USD');
    
    v_merchant_profile_exists := TRUE;
  END IF;

  -- Determine setup status
  IF v_wallet_exists AND v_merchant_profile_exists THEN
    v_setup_status := 'completed';
  ELSIF v_wallet_exists THEN
    v_setup_status := 'wallet_only';
  ELSIF v_merchant_profile_exists THEN
    v_setup_status := 'profile_only';
  ELSE
    v_setup_status := 'setup_required';
  END IF;

  RETURN QUERY SELECT 
    v_user_id::UUID,
    v_wallet_exists::BOOLEAN,
    v_wallet_balance::NUMERIC,
    v_merchant_profile_exists::BOOLEAN,
    v_setup_status::TEXT;
END;
$$;

-- Step 3: Create definitive merchant checkout completion with proper wallet crediting
CREATE OR REPLACE FUNCTION public.complete_merchant_checkout_with_transaction(
  p_session_token TEXT,
  p_transaction_id UUID,
  p_note TEXT DEFAULT '',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_user_id UUID := auth.uid();
  v_session public.merchant_checkout_sessions;
  v_tx public.transactions;
  v_existing_tx UUID;
  v_payment_link_id UUID;
  v_payment_link_token TEXT;
  v_customer_name TEXT := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_customer_email TEXT := NULLIF(TRIM(COALESCE(p_customer_email, '')), '');
  v_customer_phone TEXT := NULLIF(TRIM(COALESCE(p_customer_phone, '')), '');
  v_customer_address TEXT := NULLIF(TRIM(COALESCE(p_customer_address, '')), '');
  v_merchant_balance NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
BEGIN
  IF v_buyer_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction id is required';
  END IF;

  -- Get checkout session and lock it
  SELECT *
  INTO v_session
  FROM public.merchant_checkout_sessions mcs
  WHERE mcs.session_token = TRIM(COALESCE(p_session_token, ''))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Checkout session not found';
  END IF;

  -- Check if already paid
  IF v_session.status = 'paid' THEN
    SELECT mp.transaction_id
    INTO v_existing_tx
    FROM public.merchant_payments mp
    WHERE mp.session_id = v_session.id
    LIMIT 1;

    UPDATE public.merchant_checkout_sessions mcs
    SET customer_name = COALESCE(v_customer_name, mcs.customer_name),
        customer_email = COALESCE(v_customer_email, mcs.customer_email),
        metadata = COALESCE(mcs.metadata, '{}'::jsonb) || jsonb_strip_nulls(
          jsonb_build_object(
            'customer_phone', v_customer_phone,
            'customer_address', v_customer_address
          )
        ),
        updated_at = now()
    WHERE mcs.id = v_session.id;

    RETURN COALESCE(v_existing_tx, p_transaction_id);
  END IF;

  -- Validate session
  IF v_session.status <> 'open' THEN
    RAISE EXCEPTION 'Checkout session is not open';
  END IF;

  IF v_session.expires_at < now() THEN
    UPDATE public.merchant_checkout_sessions
    SET status = 'expired'
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Checkout session expired';
  END IF;

  IF v_session.merchant_user_id = v_buyer_user_id THEN
    RAISE EXCEPTION 'Merchant cannot pay own checkout';
  END IF;

  -- Get transaction and validate
  SELECT *
  INTO v_tx
  FROM public.transactions t
  WHERE t.id = p_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_tx.status <> 'completed' THEN
    RAISE EXCEPTION 'Transaction is not completed';
  END IF;

  IF v_tx.sender_id <> v_buyer_user_id THEN
    RAISE EXCEPTION 'Transaction sender does not match buyer';
  END IF;

  IF v_tx.receiver_id <> v_session.merchant_user_id THEN
    RAISE EXCEPTION 'Transaction receiver does not match merchant';
  END IF;

  IF ABS(COALESCE(v_tx.amount, 0) - COALESCE(v_session.total_amount, 0)) > 0.02 THEN
    RAISE EXCEPTION 'Transaction amount does not match checkout amount';
  END IF;

  -- Calculate net amount (total - fee)
  v_net_amount := v_session.total_amount - COALESCE(v_session.fee_amount, 0);

  -- CRITICAL: Credit ONLY merchant wallet (prevents double-crediting)
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_session.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    -- Create merchant wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_session.merchant_user_id, 0, now());
    
    v_merchant_balance := 0;
  END IF;

  -- Credit merchant wallet with NET amount only
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_session.merchant_user_id;

  -- Create merchant payment record
  INSERT INTO public.merchant_payments (
    session_id,
    merchant_user_id,
    buyer_user_id,
    transaction_id,
    amount,
    currency,
    api_key_id,
    key_mode,
    payment_link_id,
    payment_link_token,
    status
  )
  VALUES (
    v_session.id,
    v_session.merchant_user_id,
    v_buyer_user_id,
    v_tx.id,
    v_session.total_amount,
    v_session.currency,
    v_session.api_key_id,
    v_session.key_mode,
    NULLIF((v_session.metadata->>'payment_link_id')::UUID, NULL),
    NULLIF(TRIM(COALESCE(v_session.metadata->>'payment_link_token', '')), ''),
    'succeeded'
  )
  ON CONFLICT (session_id) DO NOTHING;

  -- Update checkout session
  UPDATE public.merchant_checkout_sessions mcs
  SET status = 'paid',
      paid_at = now(),
      customer_name = COALESCE(v_customer_name, mcs.customer_name),
      customer_email = COALESCE(v_customer_email, mcs.customer_email),
      metadata = COALESCE(mcs.metadata, '{}'::jsonb) || jsonb_strip_nulls(
        jsonb_build_object(
          'customer_phone', v_customer_phone,
          'customer_address', v_customer_address,
          'merchant_wallet_credited', v_net_amount,
          'payment_flow', 'buyer_to_merchant_only',
          'processed_at', now()
        )
      ),
      updated_at = now()
  WHERE mcs.id = v_session.id;

  -- Update transaction note if provided
  IF COALESCE(TRIM(p_note), '') <> '' THEN
    UPDATE public.transactions
    SET note = CONCAT(COALESCE(note, ''), ' | ', TRIM(p_note))
    WHERE id = v_tx.id;
  END IF;

  RETURN v_tx.id;
END;
$$;

-- Step 4: Create merchant wallet verification function
CREATE OR REPLACE FUNCTION public.verify_merchant_wallet_credit(
  p_merchant_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  merchant_user_id UUID,
  wallet_balance NUMERIC,
  total_received NUMERIC,
  expected_balance NUMERIC,
  credit_pattern TEXT,
  double_credit_detected BOOLEAN,
  verification_details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_user_id UUID := COALESCE(p_merchant_user_id, auth.uid());
  v_wallet_balance NUMERIC := 0;
  v_total_received NUMERIC := 0;
  v_expected_balance NUMERIC := 0;
BEGIN
  IF v_merchant_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized or merchant user ID required';
  END IF;

  -- Get current wallet balance
  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_merchant_user_id;

  -- Calculate total received from merchant payments
  SELECT COALESCE(SUM(amount), 0) INTO v_total_received
  FROM public.merchant_payments
  WHERE merchant_user_id = v_merchant_user_id
    AND status = 'succeeded';

  -- Expected balance should be total received (since wallet starts at 0)
  v_expected_balance := v_total_received;

  -- Determine credit pattern
  RETURN QUERY SELECT 
    v_merchant_user_id::UUID,
    v_wallet_balance::NUMERIC,
    v_total_received::NUMERIC,
    v_expected_balance::NUMERIC,
    CASE 
      WHEN v_wallet_balance = v_expected_balance THEN 'NORMAL_CREDITING'
      WHEN v_wallet_balance >= (v_expected_balance * 2) THEN 'POTENTIAL_DOUBLE_CREDITING'
      WHEN v_wallet_balance > v_expected_balance THEN 'OVER_CREDITING'
      WHEN v_wallet_balance < v_expected_balance THEN 'UNDER_CREDITING'
      ELSE 'UNKNOWN_PATTERN'
    END as credit_pattern,
    (v_wallet_balance >= (v_expected_balance * 2)) as double_credit_detected,
    CASE 
      WHEN v_wallet_balance = v_expected_balance THEN 'Correct: Merchant wallet credited once per payment'
      WHEN v_wallet_balance >= (v_expected_balance * 2) THEN 'Warning: Possible double-crediting detected'
      WHEN v_wallet_balance > v_expected_balance THEN 'Warning: Over-crediting detected'
      WHEN v_wallet_balance < v_expected_balance THEN 'Warning: Under-crediting detected'
      ELSE 'Unknown credit pattern'
    END as verification_details;
END;
$$;

-- Step 5: Create merchant onboarding completion check
CREATE OR REPLACE FUNCTION public.check_merchant_onboarding_status()
RETURNS TABLE (
  user_id UUID,
  has_wallet BOOLEAN,
  has_merchant_profile BOOLEAN,
  has_api_keys BOOLEAN,
  has_pos_sessions BOOLEAN,
  has_received_payments BOOLEAN,
  onboarding_percentage INTEGER,
  next_step TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_has_wallet BOOLEAN := FALSE;
  v_has_merchant_profile BOOLEAN := FALSE;
  v_has_api_keys BOOLEAN := FALSE;
  v_has_pos_sessions BOOLEAN := FALSE;
  v_has_received_payments BOOLEAN := FALSE;
  v_onboarding_percentage INTEGER := 0;
  v_next_step TEXT := '';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Check wallet
  SELECT COUNT(*) > 0 INTO v_has_wallet
  FROM public.wallets
  WHERE user_id = v_user_id;

  -- Check merchant profile
  SELECT COUNT(*) > 0 INTO v_has_merchant_profile
  FROM public.merchant_profiles
  WHERE user_id = v_user_id;

  -- Check API keys
  SELECT COUNT(*) > 0 INTO v_has_api_keys
  FROM public.merchant_api_keys
  WHERE merchant_user_id = v_user_id;

  -- Check POS sessions
  SELECT COUNT(*) > 0 INTO v_has_pos_sessions
  FROM public.merchant_checkout_sessions
  WHERE merchant_user_id = v_user_id;

  -- Check received payments
  SELECT COUNT(*) > 0 INTO v_has_received_payments
  FROM public.merchant_payments
  WHERE merchant_user_id = v_user_id
    AND status = 'succeeded';

  -- Calculate onboarding percentage
  v_onboarding_percentage := (
    (CASE WHEN v_has_wallet THEN 25 ELSE 0 END) +
    (CASE WHEN v_has_merchant_profile THEN 25 ELSE 0 END) +
    (CASE WHEN v_has_api_keys THEN 25 ELSE 0 END) +
    (CASE WHEN v_has_pos_sessions THEN 25 ELSE 0 END)
  );

  -- Determine next step
  IF NOT v_has_wallet THEN
    v_next_step := 'Create wallet account';
  ELSIF NOT v_has_merchant_profile THEN
    v_next_step := 'Complete merchant profile';
  ELSIF NOT v_has_api_keys THEN
    v_next_step := 'Generate API keys';
  ELSIF NOT v_has_pos_sessions THEN
    v_next_step := 'Create first POS session';
  ELSE
    v_next_step := 'Onboarding complete';
  END IF;

  RETURN QUERY SELECT 
    v_user_id::UUID,
    v_has_wallet::BOOLEAN,
    v_has_merchant_profile::BOOLEAN,
    v_has_api_keys::BOOLEAN,
    v_has_pos_sessions::BOOLEAN,
    v_has_received_payments::BOOLEAN,
    v_onboarding_percentage::INTEGER,
    v_next_step::TEXT;
END;
$$;

-- Step 6: Grant permissions
GRANT EXECUTE ON FUNCTION public.ensure_merchant_wallet_setup() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_merchant_checkout_with_transaction(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_merchant_wallet_credit(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_merchant_onboarding_status() TO authenticated, service_role;

-- Step 7: Add comprehensive comments
COMMENT ON FUNCTION public.ensure_merchant_wallet_setup() IS 'Ensures merchant has proper wallet setup during onboarding. Creates wallet and merchant profile if missing.';
COMMENT ON FUNCTION public.complete_merchant_checkout_with_transaction(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS 'Complete merchant checkout with proper merchant-only wallet crediting. Prevents double-crediting by ensuring only merchant wallet receives payment.';
COMMENT ON FUNCTION public.verify_merchant_wallet_credit(UUID) IS 'Verifies merchant wallet credit patterns and detects double-crediting issues.';
COMMENT ON FUNCTION public.check_merchant_onboarding_status() IS 'Checks merchant onboarding completion status and provides next steps.';

-- Step 8: Notify schema reload
NOTIFY pgrst, 'reload schema';

-- Step 9: Completion message
DO $$
BEGIN
  RAISE NOTICE 'Merchant Onboarding & POS Double-Crediting Fix Applied Successfully!';
  RAISE NOTICE '1. Merchant wallet setup function created';
  RAISE NOTICE '2. Merchant checkout completion with proper wallet crediting';
  RAISE NOTICE '3. Merchant wallet verification function';
  RAISE NOTICE '4. Merchant onboarding status check';
  RAISE NOTICE '5. Double-crediting prevention implemented';
  RAISE NOTICE '6. Single wallet per user system respected';
END $$;
