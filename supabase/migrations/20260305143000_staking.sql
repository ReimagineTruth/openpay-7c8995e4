-- Staking system: lock balance and earn yield after lock period

CREATE TABLE IF NOT EXISTS public.staking_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  lock_days INTEGER NOT NULL CHECK (lock_days IN (7, 30, 90, 365)),
  reward_rate NUMERIC(6,4) NOT NULL CHECK (reward_rate >= 0),
  reward_amount NUMERIC(12,2) NOT NULL CHECK (reward_amount >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'claimed', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staking_positions_user_created
  ON public.staking_positions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staking_positions_status_end
  ON public.staking_positions(status, ends_at DESC);

ALTER TABLE public.staking_positions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staking_positions' AND policyname = 'Users can view own staking positions'
  ) THEN
    CREATE POLICY "Users can view own staking positions"
      ON public.staking_positions
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_staking_positions_updated_at ON public.staking_positions;
CREATE TRIGGER trg_staking_positions_updated_at
BEFORE UPDATE ON public.staking_positions
FOR EACH ROW
EXECUTE FUNCTION public.set_common_updated_at();

-- Create stake: lock funds and create staking position
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

-- Claim stake after lock period
CREATE OR REPLACE FUNCTION public.claim_stake(
  p_position_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_position public.staking_positions%ROWTYPE;
  v_wallet_balance NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_position
  FROM public.staking_positions
  WHERE id = p_position_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stake not found';
  END IF;

  IF v_position.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF v_position.status <> 'active' THEN
    RAISE EXCEPTION 'Stake already claimed';
  END IF;

  IF v_position.ends_at > now() THEN
    RAISE EXCEPTION 'Stake is still locked';
  END IF;

  SELECT balance INTO v_wallet_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  v_total := v_position.amount + v_position.reward_amount;

  UPDATE public.wallets
  SET balance = v_wallet_balance + v_total,
      updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE public.staking_positions
  SET status = 'claimed',
      claimed_at = now()
  WHERE id = v_position.id;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_user_id,
    v_user_id,
    v_total,
    CONCAT('Stake claim | Principal ', v_position.amount::TEXT, ' + Reward ', v_position.reward_amount::TEXT),
    'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_position.amount,
    'reward', v_position.reward_amount,
    'total', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stake(NUMERIC, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_stake(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stake(NUMERIC, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stake(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
