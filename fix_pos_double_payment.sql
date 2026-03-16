-- Fix POS payment double crediting issue
-- The POS payment function was only creating transaction records but not actually transferring funds
-- This caused issues where payments appeared to be processed but wallet balances weren't updated correctly

-- Drop the old POS payment function
DROP FUNCTION IF EXISTS public.process_pos_payment_wallet(TEXT, UUID);

-- Create corrected POS payment function that properly transfers funds
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

  -- Get payer wallet balance
  SELECT balance INTO v_payer_balance
  FROM public.wallets
  WHERE user_id = p_payer_user_id
  FOR UPDATE;

  IF v_payer_balance IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Payer wallet not found'::TEXT;
    RETURN;
  END IF;

  IF v_payer_balance < v_pos_payment.total_amount THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Insufficient balance'::TEXT;
    RETURN;
  END IF;

  -- Get merchant wallet balance
  SELECT balance INTO v_merchant_balance
  FROM public.wallets
  WHERE user_id = v_pos_payment.merchant_user_id
  FOR UPDATE;

  IF v_merchant_balance IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, 'error', 'Merchant wallet not found'::TEXT;
    RETURN;
  END IF;

  -- Update wallet balances (this is the key fix - actually transfer the money)
  UPDATE public.wallets
  SET balance = v_payer_balance - v_pos_payment.total_amount,
      updated_at = now()
  WHERE user_id = p_payer_user_id;

  UPDATE public.wallets
  SET balance = v_merchant_balance + v_net_amount,
      updated_at = now()
  WHERE user_id = v_pos_payment.merchant_user_id;

  -- Create main transaction record
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
    jsonb_build_object('pos_payment_id', v_pos_payment.id, 'payment_method', 'wallet')
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

-- Grant permissions
REVOKE ALL ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_pos_payment_wallet(TEXT, UUID) TO authenticated, service_role;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
