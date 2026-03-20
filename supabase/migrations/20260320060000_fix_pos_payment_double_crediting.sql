-- Fix POS payment double crediting issue
-- The current POS payment function credits the merchant balance system, but users want it to go directly to merchant wallet
-- This fix ensures POS payments credit only the merchant wallet with the exact net amount

-- Drop the existing function and recreate it with proper wallet handling
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID);

-- Recreate the POS payment wallet function to credit merchant wallet directly
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
  -- Get POS payment session
  SELECT *
  INTO v_pos_payment
  FROM public.pos_payments pp
  WHERE pp.session_token = TRIM(COALESCE(p_session_token, ''))
    AND pp.status = 'pending'
    AND pp.expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Invalid or expired POS payment session'::TEXT;
    RETURN;
  END IF;

  -- Calculate amounts
  v_fee_amount := v_pos_payment.fee_amount;
  v_net_amount := v_pos_payment.total_amount - v_fee_amount;

  -- Get payer wallet balance and lock for update
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

  -- Get merchant wallet balance and lock for update
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_pos_payment.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Merchant wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Process balance transfers
  -- Deduct FULL amount from payer wallet
  UPDATE public.wallets
  SET balance = v_payer_balance - v_pos_payment.total_amount,
      updated_at = now()
  WHERE user_id = p_payer_user_id;

  -- Credit ONLY NET amount to merchant wallet (exact amount, no double crediting)
  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_pos_payment.merchant_user_id;

  -- Create main transaction with completed status
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
    'completed',
    'payment',
    jsonb_build_object('pos_payment_id', v_pos_payment.id, 'payment_method', 'wallet', 'credited_amount', v_net_amount)
  ) RETURNING id INTO v_transaction_id;

  -- Create POS transaction record
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

  -- Update POS payment status
  UPDATE public.pos_payments
  SET status = 'paid',
      paid_at = now(),
      updated_at = now()
  WHERE id = v_pos_payment.id;

  RETURN QUERY SELECT 
    v_transaction_id::UUID,
    v_pos_payment.id::UUID,
    'success'::TEXT,
    'POS payment processed successfully'::TEXT;
END;
$$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) TO authenticated, service_role;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.process_pos_payment_wallet IS 'Fixed version that credits only merchant wallet with net amount (total - fee). Prevents double crediting by avoiding merchant balance system.';
