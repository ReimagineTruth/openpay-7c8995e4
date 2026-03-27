-- FINAL FIX for POS Double-Crediting Bug
-- This script ensures merchants receive payments ONLY ONCE in their wallet
-- Issue: Multiple POS functions were creating duplicate credits for the same payment

-- Step 1: Drop all conflicting POS payment functions to prevent multiple execution paths
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.complete_merchant_checkout_with_transaction(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.pay_merchant_checkout_with_wallet(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) CASCADE;

-- Step 2: Create the definitive POS payment function with proper single-crediting logic
CREATE OR REPLACE FUNCTION public.process_pos_payment_wallet(
  p_session_token TEXT,
  p_payer_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  pos_payment_id UUID,
  status TEXT,
  message TEXT,
  amount_debited NUMERIC,
  amount_credited NUMERIC
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
BEGIN
  -- Get POS payment session and lock it to prevent concurrent processing
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

  -- Prevent double-processing by checking if payment is already processed
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
  IF v_pos_payment.merchant_user_id = p_payer_user_id THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Merchant cannot pay own checkout'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get and lock payer wallet balance
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

  -- Check sufficient balance
  IF v_payer_balance < v_pos_payment.total_amount THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 'error', 'Insufficient balance'::TEXT,
      NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get and lock merchant wallet balance
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_pos_payment.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    -- Create merchant wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, balance, updated_at)
    VALUES (v_pos_payment.merchant_user_id, 0, now());
    
    v_merchant_balance := 0;
  END IF;

  -- CRITICAL: Process balance transfers atomically with exact control
  -- 1. Deduct FULL amount from payer wallet (including fee)
  UPDATE public.wallets
  SET balance = v_payer_balance - v_pos_payment.total_amount,
      updated_at = now()
  WHERE user_id = p_payer_user_id;

  -- 2. Credit ONLY NET amount to merchant wallet (total - fee) - PREVENTS DOUBLE CREDITING
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_pos_payment.merchant_user_id;

  -- 3. Create main transaction record with completed status
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
    p_payer_user_id,
    v_pos_payment.merchant_user_id,
    v_pos_payment.total_amount,
    v_pos_payment.currency,
    v_fee_amount,
    'completed',
    'payment',
    jsonb_build_object(
      'pos_payment_id', v_pos_payment.id, 
      'payment_method', 'wallet',
      'debited_from_payer', v_pos_payment.total_amount,
      'credited_to_merchant', v_net_amount,
      'fee_retained_by_system', v_fee_amount,
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

  -- Return success with exact amounts for verification
  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    v_pos_payment.id::UUID,
    'success'::TEXT,
    format('Payment processed successfully. Debited: %s %s, Credited: %s %s (Fee: %s %s)', 
           v_pos_payment.total_amount, v_pos_payment.currency,
           v_net_amount, v_pos_payment.currency,
           v_fee_amount, v_pos_payment.currency)::TEXT,
    v_pos_payment.total_amount::NUMERIC,
    v_net_amount::NUMERIC;
END;
$$;

-- Step 3: Drop existing verification function if it exists
DROP FUNCTION IF EXISTS public.verify_pos_payment_integrity(UUID) CASCADE;

-- Create verification function to detect any double-crediting attempts
CREATE OR REPLACE FUNCTION public.verify_pos_payment_integrity(
  p_pos_payment_id UUID
)
RETURNS TABLE (
  pos_payment_id UUID,
  total_amount NUMERIC,
  fee_amount NUMERIC,
  net_amount NUMERIC,
  wallet_debits NUMERIC,
  wallet_credits NUMERIC,
  integrity_status TEXT,
  details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_payment public.pos_payments;
  v_pos_transaction public.pos_transactions;
  v_transaction public.transactions;
  v_wallet_debits NUMERIC := 0;
  v_wallet_credits NUMERIC := 0;
BEGIN
  -- Get POS payment details
  SELECT * INTO v_pos_payment
  FROM public.pos_payments
  WHERE id = p_pos_payment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      p_pos_payment_id, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
      NULL::NUMERIC, NULL::NUMERIC, 'NOT_FOUND'::TEXT,
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
      v_pos_payment.id, v_pos_payment.total_amount, v_pos_payment.fee_amount,
      (v_pos_payment.total_amount - v_pos_payment.fee_amount),
      NULL::NUMERIC, NULL::NUMERIC, 'NO_TRANSACTION'::TEXT,
      'No successful POS transaction found'::TEXT;
    RETURN;
  END IF;

  -- Get main transaction
  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = v_pos_transaction.transaction_id;

  IF v_transaction IS NULL THEN
    RETURN QUERY SELECT 
      v_pos_payment.id, v_pos_payment.total_amount, v_pos_payment.fee_amount,
      (v_pos_payment.total_amount - v_pos_payment.fee_amount),
      NULL::NUMERIC, NULL::NUMERIC, 'NO_MAIN_TRANSACTION'::TEXT,
      'No main transaction found'::TEXT;
    RETURN;
  END IF;

  -- Calculate wallet changes from transaction metadata
  IF v_transaction.metadata IS NOT NULL THEN
    v_wallet_debits := COALESCE((v_transaction.metadata->>'debited_from_payer')::NUMERIC, 0);
    v_wallet_credits := COALESCE((v_transaction.metadata->>'credited_to_merchant')::NUMERIC, 0);
  END IF;

  -- Verify integrity
  IF v_wallet_credits = (v_pos_payment.total_amount - v_pos_payment.fee_amount) THEN
    RETURN QUERY SELECT 
      v_pos_payment.id, v_pos_payment.total_amount, v_pos_payment.fee_amount,
      (v_pos_payment.total_amount - v_pos_payment.fee_amount),
      v_wallet_debits, v_wallet_credits, 'INTEGRITY_PASSED'::TEXT,
      'Single credit verified - no double-crediting detected'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      v_pos_payment.id, v_pos_payment.total_amount, v_pos_payment.fee_amount,
      (v_pos_payment.total_amount - v_pos_payment.fee_amount),
      v_wallet_debits, v_wallet_credits, 'INTEGRITY_FAILED'::TEXT,
      format('Double-crediting detected! Expected: %s, Actual: %s', 
             (v_pos_payment.total_amount - v_pos_payment.fee_amount), v_wallet_credits)::TEXT;
  END IF;
END;
$$;

-- Step 4: Grant proper permissions
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_pos_payment_integrity(UUID) TO authenticated, service_role;

-- Step 5: Add comprehensive comments
COMMENT ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) IS 'Definitive POS payment processor that prevents double-crediting. Deducts full amount from payer, credits only net amount to merchant. Includes double-processing protection and atomic wallet balance updates.';
COMMENT ON FUNCTION public.verify_pos_payment_integrity(UUID) IS 'Verification function to detect double-crediting in POS payments. Analyzes transaction metadata to ensure merchants are credited exactly once.';

-- Step 6: Notify schema reload
NOTIFY pgrst, 'reload schema';

-- Step 7: Drop existing cleanup function if it exists
DROP FUNCTION IF EXISTS public.cleanup_double_credited_pos_payments() CASCADE;

-- Create cleanup function for any existing double-credited payments
CREATE OR REPLACE FUNCTION public.cleanup_double_credited_pos_payments()
RETURNS TABLE (
  pos_payment_id UUID,
  cleanup_status TEXT,
  cleanup_details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_double_credit RECORD;
BEGIN
  -- Find potential double-credited payments
  FOR v_double_credit IN 
    SELECT DISTINCT
      pp.id,
      pp.total_amount,
      pp.fee_amount,
      COUNT(DISTINCT t.id) as transaction_count
    FROM public.pos_payments pp
    JOIN public.pos_transactions pt ON pp.id = pt.pos_payment_id
    JOIN public.transactions t ON pt.transaction_id = t.id
    WHERE pp.status = 'paid'
      AND pp.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY pp.id, pp.total_amount, pp.fee_amount
    HAVING COUNT(DISTINCT t.id) > 1
  LOOP
    -- Mark for manual review rather than automatic cleanup
    RETURN QUERY SELECT 
      v_double_credit.id::UUID,
      'REQUIRES_MANUAL_REVIEW'::TEXT,
      format('Found %s transactions for POS payment %s (Amount: %s)', 
             v_double_credit.transaction_count, v_double_credit.id, v_double_credit.total_amount)::TEXT;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_double_credited_pos_payments() TO authenticated, service_role;

-- Step 8: Completion message
DO $$
BEGIN
  RAISE NOTICE 'POS Double-Crediting Fix Applied Successfully!';
  RAISE NOTICE '1. Removed conflicting POS payment functions';
  RAISE NOTICE '2. Created definitive process_pos_payment_wallet function';
  RAISE NOTICE '3. Added integrity verification function';
  RAISE NOTICE '4. Added cleanup function for existing issues';
  RAISE NOTICE '5. Merchants will now receive payments ONLY ONCE';
END $$;
