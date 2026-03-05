-- Update staking lock options and reward rates (adds 365 days and new rates)

ALTER TABLE public.staking_positions
  DROP CONSTRAINT IF EXISTS staking_positions_lock_days_check;

ALTER TABLE public.staking_positions
  ADD CONSTRAINT staking_positions_lock_days_check
  CHECK (lock_days IN (7, 30, 90, 365));

CREATE OR REPLACE FUNCTION public.create_stake(
  p_amount NUMERIC,
  p_lock_days INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount, 0), 2);
  v_lock_days INTEGER := COALESCE(p_lock_days, 0);
  v_reward_rate NUMERIC(6,4);
  v_reward_amount NUMERIC(12,2);
  v_wallet_balance NUMERIC(12,2);
  v_position_id UUID;
  v_ends_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF v_amount < 1 THEN
    RAISE EXCEPTION 'Minimum stake is 1 OPEN USD';
  END IF;

  IF v_lock_days NOT IN (7, 30, 90, 365) THEN
    RAISE EXCEPTION 'Invalid lock duration';
  END IF;

  v_reward_rate := CASE v_lock_days
    WHEN 7 THEN 0.02
    WHEN 30 THEN 0.05
    WHEN 90 THEN 0.10
    WHEN 365 THEN 0.20
    ELSE 0
  END;

  v_reward_amount := ROUND(v_amount * v_reward_rate, 2);
  v_ends_at := now() + (v_lock_days || ' days')::INTERVAL;

  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  UPDATE public.wallets
  SET balance = v_wallet_balance - v_amount,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.staking_positions (
    user_id,
    amount,
    lock_days,
    reward_rate,
    reward_amount,
    status,
    ends_at
  )
  VALUES (
    v_user_id,
    v_amount,
    v_lock_days,
    v_reward_rate,
    v_reward_amount,
    'active',
    v_ends_at
  )
  RETURNING id INTO v_position_id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_user_id,
    v_user_id,
    v_amount,
    CONCAT('Stake lock | ', v_lock_days, ' days | Reward ', v_reward_amount::TEXT, ' OPEN USD'),
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'position_id', v_position_id,
    'reward_amount', v_reward_amount,
    'ends_at', v_ends_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stake(NUMERIC, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stake(NUMERIC, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
