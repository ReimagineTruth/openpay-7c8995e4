
ALTER TABLE public.user_swap_withdrawals
  ADD COLUMN IF NOT EXISTS mrwn_wallet_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ousd_wallet_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ousd_sol_wallet_address TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS withdrawal_type TEXT NOT NULL DEFAULT 'PI';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_swap_withdrawals_withdrawal_type_check'
  ) THEN
    ALTER TABLE public.user_swap_withdrawals
      ADD CONSTRAINT user_swap_withdrawals_withdrawal_type_check
      CHECK (withdrawal_type IN ('PI','OUSD','OUSD_SOL','MRWN'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_swap_withdrawal(
  p_amount NUMERIC,
  p_openpay_account_name TEXT,
  p_openpay_account_username TEXT,
  p_openpay_account_number TEXT,
  p_pi_wallet_address TEXT DEFAULT NULL,
  p_mrwn_wallet_address TEXT DEFAULT NULL,
  p_ousd_wallet_address TEXT DEFAULT NULL,
  p_ousd_sol_wallet_address TEXT DEFAULT NULL,
  p_withdrawal_type TEXT DEFAULT 'PI'
)
RETURNS public.user_swap_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_fee_rate NUMERIC(6,4) := 0.02;
  v_fee_amount NUMERIC(12,2);
  v_payout_amount NUMERIC(12,2);
  v_openpay_user_id UUID;
  v_wallet_balance NUMERIC(12,2);
  v_openpay_balance NUMERIC(12,2);
  v_tx_id UUID;
  v_row public.user_swap_withdrawals;
  v_settlement_account TEXT := 'OPEA68BB7A9F964994A199A15786D680FA';
  v_type TEXT := UPPER(COALESCE(NULLIF(TRIM(p_withdrawal_type), ''), 'PI'));
  v_name TEXT := LEFT(TRIM(COALESCE(p_openpay_account_name, '')), 160);
  v_account TEXT := UPPER(TRIM(COALESCE(p_openpay_account_number, '')));
  v_username TEXT := LEFT(TRIM(COALESCE(p_openpay_account_username, '')), 120);
  v_pi TEXT := LEFT(TRIM(COALESCE(p_pi_wallet_address, '')), 240);
  v_mrwn TEXT := LEFT(TRIM(COALESCE(p_mrwn_wallet_address, '')), 240);
  v_ousd TEXT := LEFT(TRIM(COALESCE(p_ousd_wallet_address, '')), 240);
  v_ousd_sol TEXT := LEFT(TRIM(COALESCE(p_ousd_sol_wallet_address, '')), 240);
  v_active_wallet TEXT;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF v_type NOT IN ('PI','OUSD','OUSD_SOL','MRWN') THEN
    RAISE EXCEPTION 'Invalid withdrawal type';
  END IF;
  IF v_amount < 1 THEN RAISE EXCEPTION 'Minimum withdrawal is 1 OPEN USD'; END IF;

  v_fee_amount := ROUND(v_amount * v_fee_rate, 2);
  v_payout_amount := ROUND(v_amount - v_fee_amount, 2);
  IF v_payout_amount <= 0 THEN RAISE EXCEPTION 'Withdrawal amount too low after fees'; END IF;

  v_active_wallet := CASE v_type
    WHEN 'PI' THEN v_pi
    WHEN 'OUSD' THEN v_ousd
    WHEN 'OUSD_SOL' THEN v_ousd_sol
    WHEN 'MRWN' THEN v_mrwn
  END;

  IF v_name = '' OR v_username = '' OR v_account = '' OR COALESCE(v_active_wallet, '') = '' THEN
    RAISE EXCEPTION 'Complete all required withdrawal fields';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_accounts ua
    WHERE ua.user_id = v_user_id AND UPPER(ua.account_number) = v_account
  ) THEN
    RAISE EXCEPTION 'OpenPay account number does not match your profile';
  END IF;

  SELECT ua.user_id INTO v_openpay_user_id
  FROM public.user_accounts ua
  WHERE ua.account_number = v_settlement_account LIMIT 1;
  IF v_openpay_user_id IS NULL THEN RAISE EXCEPTION 'Settlement account not found'; END IF;
  IF v_openpay_user_id = v_user_id THEN RAISE EXCEPTION 'Settlement account invalid'; END IF;

  SELECT balance INTO v_wallet_balance FROM public.wallets WHERE user_id = v_user_id FOR UPDATE;
  IF v_wallet_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_wallet_balance < v_amount THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  SELECT balance INTO v_openpay_balance FROM public.wallets WHERE user_id = v_openpay_user_id FOR UPDATE;
  IF v_openpay_balance IS NULL THEN RAISE EXCEPTION 'Settlement wallet not found'; END IF;

  UPDATE public.wallets SET balance = v_wallet_balance - v_amount, updated_at = now() WHERE user_id = v_user_id;
  UPDATE public.wallets SET balance = v_openpay_balance + v_amount, updated_at = now() WHERE user_id = v_openpay_user_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_user_id, v_openpay_user_id, v_amount,
    CONCAT('Swap withdrawal request to ', v_type, ' | Wallet ', LEFT(v_active_wallet, 80),
           ' | OpenPay ', LEFT(v_username, 40), ' ', LEFT(v_account, 60)),
    'completed'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.user_swap_withdrawals (
    user_id, amount, fee_rate, fee_amount, payout_amount,
    openpay_account_name, openpay_account_username, openpay_account_number,
    pi_wallet_address, mrwn_wallet_address, ousd_wallet_address, ousd_sol_wallet_address,
    withdrawal_type, status, transfer_transaction_id
  )
  VALUES (
    v_user_id, v_amount, v_fee_rate, v_fee_amount, v_payout_amount,
    v_name, v_username, v_account,
    COALESCE(v_pi,''), COALESCE(v_mrwn,''), COALESCE(v_ousd,''), COALESCE(v_ousd_sol,''),
    v_type, 'pending', v_tx_id
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_swap_withdrawal(NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
