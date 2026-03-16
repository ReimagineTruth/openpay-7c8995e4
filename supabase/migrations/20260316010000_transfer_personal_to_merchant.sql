-- Create function to transfer from personal wallet to merchant wallet
CREATE OR REPLACE FUNCTION public.transfer_my_personal_wallet_to_merchant(
  p_amount NUMERIC,
  p_mode TEXT DEFAULT 'live',
  p_note TEXT DEFAULT ''
)
RETURNS TABLE (
  transfer_id UUID,
  personal_wallet_balance NUMERIC,
  merchant_available_balance NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_personal_wallet_balance NUMERIC(12,2);
  v_merchant_available NUMERIC(12,2);
  v_transfer_id UUID;
  v_merchant_account public.merchant_accounts%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  -- Lock the user's personal wallet
  SELECT balance INTO v_personal_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_personal_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Personal wallet not found';
  END IF;

  IF v_personal_wallet_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient personal wallet balance';
  END IF;

  -- Get and lock the merchant account
  SELECT * INTO v_merchant_account
  FROM public.merchant_accounts
  WHERE user_id = v_user_id AND mode = v_mode
  FOR UPDATE;

  IF v_merchant_account.id IS NULL THEN
    RAISE EXCEPTION 'Merchant account not found for mode: %', v_mode;
  END IF;

  -- Calculate current available balance
  SELECT COALESCE(
    SUM(CASE WHEN mp.status = 'succeeded' 
      THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) 
      ELSE 0 END) - 
    COALESCE(v_merchant_account.transferred_total, 0) -
    COALESCE(v_merchant_account.refunded_total, 0), 0
  ) INTO v_merchant_available
  FROM public.merchant_payments mp
  LEFT JOIN public.settlement_currencies sc ON mp.currency_code = sc.code
  WHERE mp.merchant_id = v_merchant_account.id;

  -- Deduct from personal wallet
  UPDATE public.wallets
  SET balance = v_personal_wallet_balance - v_amount,
      updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Add to merchant transferred_total
  UPDATE public.merchant_accounts
  SET transferred_total = COALESCE(transferred_total, 0) + v_amount,
      updated_at = NOW()
  WHERE id = v_merchant_account.id;

  -- Create transfer record
  v_transfer_id := gen_random_uuid();

  INSERT INTO public.merchant_activity (
    id,
    merchant_id,
    activity_type,
    amount,
    currency,
    status,
    note,
    source,
    created_at
  ) VALUES (
    v_transfer_id,
    v_merchant_account.id,
    'transfer_from_personal_wallet',
    v_amount,
    'OUSD',
    'completed',
    COALESCE(p_note, 'Transfer from personal wallet'),
    'Dashboard',
    NOW()
  );

  -- Return updated balances
  SELECT 
    v_transfer_id,
    v_personal_wallet_balance - v_amount,
    v_merchant_available + v_amount
  INTO personal_wallet_balance, merchant_available_balance;

  RETURN NEXT;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.transfer_my_personal_wallet_to_merchant(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_my_personal_wallet_to_merchant(NUMERIC, TEXT, TEXT) TO authenticated, service_role;
