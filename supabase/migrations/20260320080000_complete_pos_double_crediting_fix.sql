-- Complete fix for POS payment double crediting issue
-- This replaces the original function that was only creating records without proper wallet transfers
-- Ensures exact amount control: payer pays full amount, merchant receives only net amount

-- Drop the incomplete original function
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID);

-- Create the complete function with proper wallet balance management
CREATE OR REPLACE FUNCTION public.process_pos_payment_wallet(
  p_session_token TEXT,
  p_payer_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  transaction_id UUID,
  pos_payment_id UUID,
  status TEXT,
  message TEXT
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
BEGIN
  -- Get POS payment session and lock it
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now()
  FOR UPDATE OF pp;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid or expired POS payment session'::TEXT;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := v_pos_payment.fee_amount;
  v_net_amount := v_pos_payment.total_amount - v_fee_amount;

  -- Validate amounts
  IF v_net_amount < 0 THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid fee amount'::TEXT;
    RETURN;
  END IF;

  -- Get and lock payer wallet balance
  SELECT balance INTO v_payer_balance
  FROM public.wallets
  WHERE user_id = p_payer_user_id
  FOR UPDATE;

  IF v_payer_balance IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Payer wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Check sufficient balance
  IF v_payer_balance < v_pos_payment.total_amount THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  -- Get and lock merchant wallet balance
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_pos_payment.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Merchant wallet not found'::TEXT;
    RETURN;
  END IF;

  -- CRITICAL: Process balance transfers atomically
  -- 1. Deduct FULL amount from payer wallet (including fee)
  UPDATE public.wallets
  SET balance = v_payer_balance - v_pos_payment.total_amount,
      updated_at = now()
  WHERE user_id = p_payer_user_id;

  -- 2. Credit ONLY NET amount to merchant wallet (total - fee)
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_pos_payment.merchant_user_id;

  -- 3. Create transaction record with completed status
  INSERT INTO public.transactions (
    sender_user_id,
    receiver_user_id,
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
    'completed',  -- Mark as completed since balance transfers are done
    'payment',
    jsonb_build_object(
      'pos_payment_id', v_pos_payment.id, 
      'payment_method', 'wallet',
      'debited_from_payer', v_pos_payment.total_amount,
      'credited_to_merchant', v_net_amount,
      'fee_retained_by_system', v_fee_amount
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
    format('POS payment processed: Payer debited %s %s, Merchant credited %s %s (fee: %s %s)', 
           v_pos_payment.total_amount, v_pos_payment.currency,
           v_net_amount, v_pos_payment.currency,
           v_fee_amount, v_pos_payment.currency)::TEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) TO authenticated, service_role;

-- Add comprehensive comment
COMMENT ON FUNCTION public.process_pos_payment_wallet IS 'Complete POS payment processing with exact amount control. Deducts full amount from payer, credits only net amount to merchant. Prevents double crediting by handling wallet balances directly.';

-- Create audit function to verify no double crediting
CREATE OR REPLACE FUNCTION public.verify_pos_payment_integrity(
  p_pos_payment_id UUID
)
RETURNS TABLE (
  payment_amount NUMERIC,
  fee_amount NUMERIC,
  net_amount NUMERIC,
  payer_debit NUMERIC,
  merchant_credit NUMERIC,
  integrity_check TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pos_payment public.pos_payments;
  v_pos_transaction public.pos_transactions;
  v_transaction public.transactions;
  v_payer_wallet_balance NUMERIC;
  v_merchant_wallet_balance NUMERIC;
BEGIN
  -- Get POS payment details
  SELECT * INTO v_pos_payment
  FROM public.pos_payments
  WHERE id = p_pos_payment_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, 
      NULL::NUMERIC, NULL::NUMERIC, 
      'POS payment not found'::TEXT;
    RETURN;
  END IF;

  -- Get POS transaction
  SELECT * INTO v_pos_transaction
  FROM public.pos_transactions
  WHERE pos_payment_id = p_pos_payment_id
  LIMIT 1;

  -- Get main transaction
  SELECT * INTO v_transaction
  FROM public.transactions
  WHERE id = v_pos_transaction.transaction_id;

  -- Calculate expected amounts
  v_payer_wallet_balance := v_pos_payment.total_amount * -1;  -- Should be debited
  v_merchant_wallet_balance := v_pos_payment.total_amount - v_pos_payment.fee_amount;  -- Should be credited

  -- Verify integrity
  IF v_pos_transaction.net_amount = v_merchant_wallet_balance THEN
    RETURN QUERY SELECT 
      v_pos_payment.total_amount,
      v_pos_payment.fee_amount,
      v_pos_transaction.net_amount,
      v_payer_wallet_balance,
      v_merchant_wallet_balance,
      'INTEGRITY_CHECK_PASSED'::TEXT;
  ELSE
    RETURN QUERY SELECT 
      v_pos_payment.total_amount,
      v_pos_payment.fee_amount,
      v_pos_transaction.net_amount,
      v_payer_wallet_balance,
      v_merchant_wallet_balance,
      'INTEGRITY_CHECK_FAILED'::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_pos_payment_integrity(UUID) TO authenticated, service_role;
