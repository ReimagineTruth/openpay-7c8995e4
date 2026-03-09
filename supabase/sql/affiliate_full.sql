-- OpenPay Affiliate / Referral system (full SQL)
-- This script provisions:
--  - profiles.referral_code + profiles.referred_by_user_id
--  - referral_rewards table (pending/claimed rewards)
--  - claim_referral_rewards() RPC (moves pending rewards into wallet + creates transaction)
--
-- Notes:
--  - The referrer is detected during signup via auth.users.raw_user_meta_data.referral_code.
--  - Ensure your auth trigger exists:
--      CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--  - Your project may have a customized handle_new_user() (e.g., sign-up code enforcement). Keep the referral portion consistent.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) profiles: referral columns + constraints/indexes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT,
ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_no_self_referral;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_no_self_referral
CHECK (referred_by_user_id IS NULL OR referred_by_user_id <> id);

CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_user_id
ON public.profiles (referred_by_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code_unique
ON public.profiles (LOWER(referral_code))
WHERE referral_code IS NOT NULL;

-- Backfill referral_code for existing users (safe to re-run)
DO $$
DECLARE
  rec RECORD;
  base_code TEXT;
  candidate_code TEXT;
  code_counter INTEGER;
BEGIN
  FOR rec IN
    SELECT p.id, p.username
    FROM public.profiles p
    WHERE p.referral_code IS NULL
  LOOP
    base_code := LOWER(
      REGEXP_REPLACE(
        COALESCE(NULLIF(BTRIM(rec.username), ''), 'user_' || REPLACE(SUBSTRING(rec.id::text, 1, 12), '-', '')),
        '[^a-z0-9_]',
        '',
        'g'
      )
    );

    IF base_code IS NULL OR base_code = '' THEN
      base_code := 'user_' || REPLACE(SUBSTRING(rec.id::text, 1, 12), '-', '');
    END IF;

    candidate_code := base_code;
    code_counter := 0;

    WHILE EXISTS (
      SELECT 1
      FROM public.profiles p2
      WHERE p2.id <> rec.id
        AND LOWER(p2.referral_code) = candidate_code
    ) LOOP
      code_counter := code_counter + 1;
      candidate_code := base_code || code_counter::text;
    END LOOP;

    UPDATE public.profiles
    SET referral_code = candidate_code
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Enforce referral_code not null once backfill is done
ALTER TABLE public.profiles
ALTER COLUMN referral_code SET NOT NULL;

-- Normalize referral_code
UPDATE public.profiles
SET referral_code = LOWER(referral_code)
WHERE referral_code IS NOT NULL;

-- 2) referral_rewards table
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_amount NUMERIC(12,2) NOT NULL DEFAULT 1.00 CHECK (reward_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ
);

ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'referral_rewards'
      AND policyname = 'Users can view own referral rewards'
  ) THEN
    CREATE POLICY "Users can view own referral rewards"
      ON public.referral_rewards
      FOR SELECT
      TO authenticated
      USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid());
  END IF;
END;
$$;

-- 3) claim_referral_rewards() RPC
CREATE OR REPLACE FUNCTION public.claim_referral_rewards()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_claim_count INTEGER := 0;
  v_claim_amount NUMERIC(12,2) := 0;
  v_balance NUMERIC(12,2) := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH claimed AS (
    UPDATE public.referral_rewards rr
    SET status = 'claimed',
        claimed_at = now()
    WHERE rr.referrer_user_id = v_user_id
      AND rr.status = 'pending'
    RETURNING rr.reward_amount
  )
  SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(reward_amount), 0)
  INTO v_claim_count, v_claim_amount
  FROM claimed;

  -- Ensure wallet exists
  INSERT INTO public.wallets (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_claim_count = 0 OR v_claim_amount <= 0 THEN
    SELECT w.balance INTO v_balance
    FROM public.wallets w
    WHERE w.user_id = v_user_id;

    RETURN jsonb_build_object(
      'claimed', false,
      'count', 0,
      'amount', 0,
      'balance', COALESCE(v_balance, 0)
    );
  END IF;

  UPDATE public.wallets w
  SET balance = w.balance + v_claim_amount,
      updated_at = now()
  WHERE w.user_id = v_user_id
  RETURNING w.balance INTO v_balance;

  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (
    v_user_id,
    v_user_id,
    v_claim_amount,
    format('Affiliate referral rewards (%s invite%s)', v_claim_count, CASE WHEN v_claim_count = 1 THEN '' ELSE 's' END),
    'completed'
  );

  RETURN jsonb_build_object(
    'claimed', true,
    'count', v_claim_count,
    'amount', v_claim_amount,
    'balance', v_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_referral_rewards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_referral_rewards() TO authenticated;

