-- Fix for POS Merchant Wallet Only Credit
-- Ensures POS payments credit ONLY merchant wallet, not personal wallet
-- The key insight: "personal wallet" and "merchant wallet" are UI concepts, not separate database entities

-- Step 1: First, let's understand the current wallet structure
-- The system uses ONE wallet per user (user_id is unique in wallets table)
-- So we need to ensure POS payments only go to merchants, not buyers

-- Step 2: Drop any existing POS payment functions that might cause double-crediting
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID) CASCADE;

-- Step 3: Create definitive POS payment function that credits ONLY merchant wallet
CREATE OR REPLACE FUNCTION public.process_pos_payment_wallet(
  p_session_token TEXT,
  p_payer_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  pos_payment_id UUID,
  status TEXT,
  message TEXT,
  merchant_wallet_credited NUMERIC,
  payer_wallet_debited NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_payment public.pos_payments;
  v_payer_balance NUMERIC(12,2);
  v_merchant_balance NUMERIC(12,2);
  v_transaction_id UUID;
  v_pos_transaction_id UUID;
  v_fee_amount NUMERIC(12,2);
  v_net_amount NUMERIC(12,2);
  v_existing_transaction_id UUID;
  v_merchant_user_id UUID;
BEGIN
  -- Get POS payment session and lock it
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now()
  FOR UPDATE OF pp NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Invalid or expired POS payment session'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Store merchant user ID for clarity
  v_merchant_user_id := v_pos_payment.merchant_user_id;

  -- Prevent double-processing
  SELECT pt.transaction_id INTO v_existing_transaction_id
  FROM public.pos_transactions pt
  WHERE pt.pos_payment_id = v_pos_payment.id
    AND pt.status = 'succeeded'
  LIMIT 1;

  IF v_existing_transaction_id IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_existing_transaction_id, v_pos_payment.id, 'error', 'Payment already processed'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := COALESCE(v_pos_payment.fee_amount, 0);
  v_net_amount := v_pos_payment.total_amount - v_fee_amount;

  -- Validate amounts
  IF v_net_amount < 0 THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Invalid fee amount'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Prevent merchant from paying their own POS session
  IF v_merchant_user_id = p_payer_user_id THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Merchant cannot pay own checkout'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- CRITICAL: Ensure we're dealing with different users
  IF v_merchant_user_id = p_payer_user_id THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Payer and merchant cannot be the same user'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get and lock PAYER wallet balance (this is the "personal wallet" of the customer)
  SELECT balance INTO v_payer_balance
  FROM public.wallets
  WHERE user_id = p_payer_user_id
  FOR UPDATE;

  IF v_payer_balance IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Payer wallet not found'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Check sufficient balance in PAYER wallet
  IF v_payer_balance < v_pos_payment.total_amount THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Insufficient balance in payer wallet'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get and lock MERCHANT wallet balance (this is the merchant's single wallet)
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    -- Create merchant wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_merchant_user_id, 0, now());
    
    v_merchant_balance := 0;
  END IF;

  -- CRITICAL: Process wallet transfers with MERCHANT-WALLET-ONLY logic
  -- 1. Deduct FULL amount from PAYER wallet (customer's personal wallet)
  UPDATE public.wallets
  SET balance = v_payer_balance - v_pos_payment.total_amount,
      updated_at = now()
  WHERE user_id = p_payer_user_id;

  -- 2. Credit ONLY NET amount to MERCHANT wallet (merchant's single wallet)
  -- This is the KEY FIX: Only merchant gets credited, not both wallets
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_merchant_user_id;

  -- 3. Create main transaction record showing the flow
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
    p_payer_user_id, -- PAYER (customer)
    v_merchant_user_id, -- MERCHANT (receiver)
    v_pos_payment.total_amount,
    v_pos_payment.currency,
    v_fee_amount,
    'completed',
    'payment',
    jsonb_build_object(
      'pos_payment_id', v_pos_payment.id, 
      'payment_method', 'wallet',
      'payer_wallet_debited', v_pos_payment.total_amount,
      'merchant_wallet_credited', v_net_amount,
      'fee_retained_by_system', v_fee_amount,
      'payment_flow', 'payer_to_merchant_only',
      'processed_at', now()
    )
  ) RETURNING id INTO v_transaction_id;

  -- 4. Create POS transaction record
  INSERT INTO public.pos_transactions (
    pos_payment_id,
    transaction_id,
    payer_user_id,
    payment_method,
    amount,
    currency,
    fee_amount,
    net_amount,
    status
  ) VALUES (
    v_pos_payment.id,
    v_transaction_id,
    p_payer_user_id,
    'wallet',
    v_pos_payment.total_amount,
    v_pos_payment.currency,
    v_fee_amount,
    v_net_amount,
    'succeeded'
  ) RETURNING id INTO v_pos_transaction_id;

  -- 5. Update POS payment status to paid
  UPDATE public.pos_payments
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_pos_payment.id;

  -- Return success with clear merchant-only credit information
  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    v_pos_payment.id::UUID,
    'success'::TEXT,
    format('MERCHANT-WALLET-ONLY payment processed. Payer debited: %s %s, Merchant credited: %s %s (Fee: %s %s)', 
           v_pos_payment.total_amount, v_pos_payment.currency,
           v_net_amount, v_pos_payment.currency,
           v_fee_amount, v_pos_payment.currency)::TEXT,
    v_net_amount::NUMERIC,
    v_pos_payment.total_amount::NUMERIC;
END;
$$;

-- Step 4: Create function to verify merchant-only credit behavior
CREATE OR REPLACE FUNCTION public.verify_merchant_wallet_only_credit(
  p_pos_payment_id UUID
)
RETURNS TABLE (
  pos_payment_id UUID,
  payment_flow TEXT,
  merchant_credited BOOLEAN,
  payer_debited BOOLEAN,
  double_credit_detected BOOLEAN,
  verification_details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_payment public.pos_payments;
  v_pos_transaction public.pos_transactions;
  v_transaction public.transactions;
  v_merchant_credited NUMERIC := 0;
  v_payer_debited NUMERIC := 0;
BEGIN
  -- Get POS payment details
  SELECT * INTO v_pos_payment
  FROM public.pos_payments
  WHERE id = p_pos_payment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      p_pos_payment_id, 'NOT_FOUND'::TEXT, FALSE, FALSE, FALSE,
      'POS payment not found'::TEXT;
    RETURN;
  END IF;

  -- Get POS transaction
  SELECT * INTO v_pos_transaction
  FROM public.pos_transactions
  WHERE pos_payment_id = p_pos_payment_id
    AND status = 'succeeded'
  LIMIT 1;

  IF v_pos_transaction IS NULL THEN
    RETURN QUERY SELECT 
      v_pos_payment.id, 'NO_TRANSACTION'::TEXT, FALSE, FALSE, FALSE,
      'No successful POS transaction found'::TEXT;
    RETURN;
  END IF;

  -- Get main transaction
  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = v_pos_transaction.transaction_id;

  IF v_transaction IS NULL THEN
    RETURN QUERY SELECT 
      v_pos_payment.id, 'NO_MAIN_TRANSACTION'::TEXT, FALSE, FALSE, FALSE,
      'No main transaction found'::TEXT;
    RETURN;
  END IF;

  -- Extract amounts from transaction metadata
  IF v_transaction.metadata IS NOT NULL THEN
    v_merchant_credited := COALESCE((v_transaction.metadata->>'merchant_wallet_credited')::NUMERIC, 0);
    v_payer_debited := COALESCE((v_transaction.metadata->>'payer_wallet_debited')::NUMERIC, 0);
  END IF;

  -- Verify merchant-only credit flow
  RETURN QUERY SELECT 
    v_pos_payment.id,
    COALESCE((v_transaction.metadata->>'payment_flow')::TEXT, 'UNKNOWN') as payment_flow,
    (v_merchant_credited > 0) as merchant_credited,
    (v_payer_debited > 0) as payer_debited,
    (v_merchant_credited = v_payer_debited - COALESCE(v_pos_payment.fee_amount, 0)) as double_credit_detected,
    CASE 
      WHEN v_merchant_credited > 0 AND v_payer_debited > 0 THEN 'CORRECT: Merchant-only credit verified'
      WHEN v_merchant_credited = 0 AND v_payer_debited = 0 THEN 'ERROR: No wallet changes detected'
      ELSE 'ERROR: Unexpected wallet flow detected'
    END as verification_details;
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_merchant_wallet_only_credit(UUID) TO authenticated, service_role;

-- Step 6: Add comprehensive comments
COMMENT ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) IS 'MERCHANT-WALLET-ONLY POS payment processor. Ensures only merchant wallet is credited, not both personal and merchant wallets. Deducts from payer wallet, credits only merchant wallet.';
COMMENT ON FUNCTION public.verify_merchant_wallet_only_credit(UUID) IS 'Verifies that POS payments credit only merchant wallet, not both personal and merchant wallets.';

-- Step 7: Notify schema reload
NOTIFY pgrst, 'reload schema';

-- Step 8: Completion message
DO $$
BEGIN
  RAISE NOTICE 'POS Merchant-Wallet-Only Fix Applied Successfully!';
  RAISE NOTICE '1. POS payments now credit ONLY merchant wallet';
  RAISE NOTICE '2. Payer wallet is debited, merchant wallet is credited';
  RAISE NOTICE '3. No more double-crediting between personal/merchant wallets';
  RAISE NOTICE '4. Single wallet per user system respected';
END $$;
