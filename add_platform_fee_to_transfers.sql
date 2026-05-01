-- Add platform fee to all user transfers
-- Platform fee: 0.01 USD per transaction
-- Fee recipient: @openpay account (OPEA68BB7A9F964994A199A15786D680FA)

-- Drop and recreate transfer_funds function with platform fee
DROP FUNCTION IF EXISTS public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_currency_code TEXT DEFAULT 'OUSD',
  p_sender_amount NUMERIC DEFAULT NULL,
  p_sender_currency_code TEXT DEFAULT NULL,
  p_receiver_amount NUMERIC DEFAULT NULL,
  p_receiver_currency_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_balance NUMERIC(12,2);
  v_receiver_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_openpay_user_id UUID;
  v_transaction_id UUID;
  v_fee_transaction_id UUID;
  v_currency_code TEXT := UPPER(TRIM(COALESCE(p_currency_code, 'OUSD')));
  v_sender_amount NUMERIC := COALESCE(p_sender_amount, p_amount);
  v_sender_currency_code TEXT := UPPER(TRIM(COALESCE(p_sender_currency_code, v_currency_code, 'OUSD')));
  v_receiver_amount NUMERIC := COALESCE(p_receiver_amount, p_amount);
  v_receiver_currency_code TEXT := UPPER(TRIM(COALESCE(p_receiver_currency_code, 'OUSD')));
  v_platform_fee NUMERIC := 0.01; -- Fixed platform fee of 0.01 USD
BEGIN
  IF p_sender_id IS NULL OR p_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Missing sender or receiver';
  END IF;

  IF p_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Get sender wallet balance
  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = p_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;

  -- Get receiver wallet balance
  SELECT balance INTO v_receiver_balance
  FROM public.wallets
  WHERE user_id = p_receiver_id
  FOR UPDATE;

  IF v_receiver_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient wallet not found';
  END IF;

  -- Check if sender has enough balance (amount + platform fee)
  IF v_sender_balance < (p_amount + v_platform_fee) THEN
    RAISE EXCEPTION 'Insufficient balance (including platform fee)';
  END IF;

  -- Get OpenPay user ID for fee collection
  SELECT id INTO v_openpay_user_id
  FROM public.user_accounts ua
  WHERE UPPER(TRIM(COALESCE(ua.account_number, ''))) = 'OPEA68BB7A9F964994A199A15786D680FA'
  ORDER BY
    CASE
      WHEN UPPER(TRIM(COALESCE(ua.account_number, ''))) = 'OPEA68BB7A9F964994A199A15786D680FA' THEN 0
      ELSE 1
    END,
    ua.created_at ASC
  LIMIT 1;

  IF v_openpay_user_id IS NULL THEN
    RAISE EXCEPTION 'OpenPay fee collection account not found';
  END IF;

  -- Get OpenPay wallet balance
  SELECT balance INTO v_openpay_balance
  FROM public.wallets
  WHERE user_id = v_openpay_user_id
  FOR UPDATE;

  IF v_openpay_balance IS NULL THEN
    RAISE EXCEPTION 'OpenPay wallet not found';
  END IF;

  -- Deduct total amount (amount + platform fee) from sender
  UPDATE public.wallets
  SET balance = v_sender_balance - (p_amount + v_platform_fee),
      updated_at = now()
  WHERE user_id = p_sender_id;

  -- Add amount to receiver
  UPDATE public.wallets
  SET balance = v_receiver_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_receiver_id;

  -- Add platform fee to OpenPay account
  UPDATE public.wallets
  SET balance = v_openpay_balance + v_platform_fee,
      updated_at = now()
  WHERE user_id = v_openpay_user_id;

  -- Create main transaction record
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    currency_code,
    sender_amount,
    sender_currency_code,
    receiver_amount,
    receiver_currency_code
  )
  VALUES (
    p_sender_id,
    p_receiver_id,
    p_amount,
    COALESCE(p_note, ''),
    'completed',
    v_currency_code,
    v_sender_amount,
    v_sender_currency_code,
    v_receiver_amount,
    v_receiver_currency_code
  )
  RETURNING id INTO v_transaction_id;

  -- Create platform fee transaction record
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    currency_code,
    sender_amount,
    sender_currency_code,
    receiver_amount,
    receiver_currency_code
  )
  VALUES (
    p_sender_id,
    v_openpay_user_id,
    v_platform_fee,
    'Platform fee | To OPEA68BB7A9F964994A199A15786D680FA @openpay',
    'completed',
    'OUSD',
    v_platform_fee,
    'OUSD',
    v_platform_fee,
    'OUSD'
  )
  RETURNING id INTO v_fee_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO service_role;

-- Update transfer_funds_authenticated function to include platform fee
DROP FUNCTION IF EXISTS public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.transfer_funds_authenticated(
  p_receiver_id UUID,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_currency_code TEXT DEFAULT 'OUSD',
  p_sender_amount NUMERIC DEFAULT NULL,
  p_sender_currency_code TEXT DEFAULT NULL,
  p_receiver_amount NUMERIC DEFAULT NULL,
  p_receiver_currency_code TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_balance NUMERIC(12,2);
  v_receiver_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_openpay_user_id UUID;
  v_transaction_id UUID;
  v_fee_transaction_id UUID;
  v_currency_code TEXT := UPPER(TRIM(COALESCE(p_currency_code, 'OUSD')));
  v_sender_amount NUMERIC := COALESCE(p_sender_amount, p_amount);
  v_sender_currency_code TEXT := UPPER(TRIM(COALESCE(p_sender_currency_code, v_currency_code, 'OUSD')));
  v_receiver_amount NUMERIC := COALESCE(p_receiver_amount, p_amount);
  v_receiver_currency_code TEXT := UPPER(TRIM(COALESCE(p_receiver_currency_code, 'OUSD')));
  v_platform_fee NUMERIC := 0.01; -- Fixed platform fee of 0.01 USD
BEGIN
  -- Get authenticated user ID
  SELECT auth.uid() INTO v_sender_id;
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_receiver_id IS NULL THEN
    RAISE EXCEPTION 'Missing receiver';
  END IF;

  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Get sender wallet balance
  SELECT balance INTO v_sender_balance
  FROM public.wallets
  WHERE user_id = v_sender_id
  FOR UPDATE;

  IF v_sender_balance IS NULL THEN
    RAISE EXCEPTION 'Sender wallet not found';
  END IF;

  -- Get receiver wallet balance
  SELECT balance INTO v_receiver_balance
  FROM public.wallets
  WHERE user_id = p_receiver_id
  FOR UPDATE;

  IF v_receiver_balance IS NULL THEN
    RAISE EXCEPTION 'Recipient wallet not found';
  END IF;

  -- Check if sender has enough balance (amount + platform fee)
  IF v_sender_balance < (p_amount + v_platform_fee) THEN
    RAISE EXCEPTION 'Insufficient balance (including platform fee)';
  END IF;

  -- Get OpenPay user ID for fee collection
  SELECT id INTO v_openpay_user_id
  FROM public.user_accounts ua
  WHERE UPPER(TRIM(COALESCE(ua.account_number, ''))) = 'OPEA68BB7A9F964994A199A15786D680FA'
  ORDER BY
    CASE
      WHEN UPPER(TRIM(COALESCE(ua.account_number, ''))) = 'OPEA68BB7A9F964994A199A15786D680FA' THEN 0
      ELSE 1
    END,
    ua.created_at ASC
  LIMIT 1;

  IF v_openpay_user_id IS NULL THEN
    RAISE EXCEPTION 'OpenPay fee collection account not found';
  END IF;

  -- Get OpenPay wallet balance
  SELECT balance INTO v_openpay_balance
  FROM public.wallets
  WHERE user_id = v_openpay_user_id
  FOR UPDATE;

  IF v_openpay_balance IS NULL THEN
    RAISE EXCEPTION 'OpenPay wallet not found';
  END IF;

  -- Deduct total amount (amount + platform fee) from sender
  UPDATE public.wallets
  SET balance = v_sender_balance - (p_amount + v_platform_fee),
      updated_at = now()
  WHERE user_id = v_sender_id;

  -- Add amount to receiver
  UPDATE public.wallets
  SET balance = v_receiver_balance + p_amount,
      updated_at = now()
  WHERE user_id = p_receiver_id;

  -- Add platform fee to OpenPay account
  UPDATE public.wallets
  SET balance = v_openpay_balance + v_platform_fee,
      updated_at = now()
  WHERE user_id = v_openpay_user_id;

  -- Create main transaction record
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    currency_code,
    sender_amount,
    sender_currency_code,
    receiver_amount,
    receiver_currency_code
  )
  VALUES (
    v_sender_id,
    p_receiver_id,
    p_amount,
    COALESCE(p_note, ''),
    'completed',
    v_currency_code,
    v_sender_amount,
    v_sender_currency_code,
    v_receiver_amount,
    v_receiver_currency_code
  )
  RETURNING id INTO v_transaction_id;

  -- Create platform fee transaction record
  INSERT INTO public.transactions (
    sender_id,
    receiver_id,
    amount,
    note,
    status,
    currency_code,
    sender_amount,
    sender_currency_code,
    receiver_amount,
    receiver_currency_code
  )
  VALUES (
    v_sender_id,
    v_openpay_user_id,
    v_platform_fee,
    'Platform fee | To OPEA68BB7A9F964994A199A15786D680FA @openpay',
    'completed',
    'OUSD',
    v_platform_fee,
    'OUSD',
    v_platform_fee,
    'OUSD'
  )
  RETURNING id INTO v_fee_transaction_id;

  RETURN v_transaction_id;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds_authenticated(UUID, NUMERIC, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO authenticated, service_role;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
