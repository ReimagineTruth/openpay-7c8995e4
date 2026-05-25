CREATE OR REPLACE FUNCTION public.transfer_my_merchant_balance(p_amount numeric, p_mode text DEFAULT 'live'::text, p_destination text DEFAULT 'wallet'::text, p_note text DEFAULT ''::text)
 RETURNS TABLE(transfer_id uuid, available_balance numeric, wallet_balance numeric, savings_balance numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_mode TEXT := LOWER(TRIM(COALESCE(p_mode, 'live')));
  v_destination TEXT := LOWER(TRIM(COALESCE(p_destination, 'wallet')));
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0)::NUMERIC, 2);
  v_gross NUMERIC(14,2) := 0;
  v_refunded NUMERIC(14,2) := 0;
  v_transferred NUMERIC(14,2) := 0;
  v_available NUMERIC(14,2) := 0;
  v_wallet NUMERIC(14,2) := 0;
  v_savings NUMERIC(14,2) := 0;
  v_transfer_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_mode NOT IN ('sandbox', 'live') THEN
    RAISE EXCEPTION 'Mode must be sandbox or live';
  END IF;

  IF v_destination NOT IN ('wallet', 'savings') THEN
    RAISE EXCEPTION 'Destination must be wallet or savings';
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':' || v_mode));

  SELECT
    COALESCE(SUM(CASE WHEN mp.status = 'succeeded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN mp.status = 'refunded' THEN ROUND(mp.amount / COALESCE(NULLIF(sc.usd_rate, 0), 1), 2) ELSE 0 END), 0)
  INTO v_gross, v_refunded
  FROM public.merchant_payments mp
  LEFT JOIN public.supported_currencies sc
    ON sc.iso_code = UPPER(COALESCE(mp.currency, 'USD'))
  WHERE mp.merchant_user_id = v_user_id
    AND mp.key_mode = v_mode;

  SELECT COALESCE(SUM(mbt.amount), 0)
  INTO v_transferred
  FROM public.merchant_balance_transfers mbt
  WHERE mbt.merchant_user_id = v_user_id
    AND mbt.key_mode = v_mode;

  v_available := GREATEST(v_gross - v_refunded - v_transferred, 0);
  IF v_available < v_amount THEN
    RAISE EXCEPTION 'Insufficient merchant available balance';
  END IF;

  -- Lock wallet
  SELECT COALESCE(w.balance, 0)
  INTO v_wallet
  FROM public.wallets w
  WHERE w.user_id = v_user_id
  FOR UPDATE;

  IF v_destination = 'savings' THEN
    -- Money is already in wallet from payment receive, so we must debit
    -- wallet first, then credit savings (one-for-one move).
    IF v_wallet < v_amount THEN
      RAISE EXCEPTION 'Insufficient wallet balance to move to savings';
    END IF;

    UPDATE public.wallets
    SET balance = v_wallet - v_amount,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_wallet;

    PERFORM public.upsert_my_savings_account();

    UPDATE public.user_savings_accounts
    SET balance = balance + v_amount,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_savings;

    INSERT INTO public.user_savings_transfers (user_id, direction, amount, fee_amount, note)
    VALUES (
      v_user_id,
      'wallet_to_savings',
      v_amount,
      0,
      CONCAT('Merchant balance transfer (', v_mode, ')')
    );
  END IF;
  -- For destination = 'wallet': do NOTHING to the wallet balance.
  -- Payment already credited the wallet at receive time. Recording
  -- the transfer below simply marks this amount as "settled" so the
  -- merchant available_balance reduces (prevents double-counting).

  INSERT INTO public.merchant_balance_transfers (
    merchant_user_id,
    key_mode,
    destination,
    amount,
    currency,
    note
  )
  VALUES (
    v_user_id,
    v_mode,
    v_destination,
    v_amount,
    'USD',
    COALESCE(p_note, '')
  )
  RETURNING id INTO v_transfer_id;

  IF v_destination <> 'savings' THEN
    PERFORM public.upsert_my_savings_account();
    SELECT COALESCE(usa.balance, 0)
    INTO v_savings
    FROM public.user_savings_accounts usa
    WHERE usa.user_id = v_user_id;
  END IF;

  RETURN QUERY
  SELECT
    v_transfer_id,
    GREATEST(v_available - v_amount, 0),
    COALESCE(v_wallet, 0),
    COALESCE(v_savings, 0);
END;
$function$;