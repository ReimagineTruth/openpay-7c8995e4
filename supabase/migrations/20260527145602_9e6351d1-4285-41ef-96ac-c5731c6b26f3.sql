
CREATE TABLE public.stripe_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  amount_usd numeric(12,2) NOT NULL CHECK (amount_usd > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed')),
  environment text NOT NULL DEFAULT 'sandbox',
  credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_topups_user ON public.stripe_topups(user_id, created_at DESC);

GRANT SELECT ON public.stripe_topups TO authenticated;
GRANT ALL ON public.stripe_topups TO service_role;

ALTER TABLE public.stripe_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topups"
  ON public.stripe_topups FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role manages topups"
  ON public.stripe_topups FOR ALL
  USING (auth.role() = 'service_role');

-- Idempotent crediting RPC, callable only by service role from edge function.
CREATE OR REPLACE FUNCTION public.credit_stripe_topup(
  p_session_id text,
  p_user_id uuid,
  p_amount numeric,
  p_environment text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing record;
BEGIN
  -- Upsert the topup row, lock it so concurrent webhook deliveries are safe.
  INSERT INTO public.stripe_topups(user_id, stripe_session_id, amount_usd, status, environment)
  VALUES (p_user_id, p_session_id, p_amount, 'pending', p_environment)
  ON CONFLICT (stripe_session_id) DO NOTHING;

  SELECT * INTO v_existing
  FROM public.stripe_topups
  WHERE stripe_session_id = p_session_id
  FOR UPDATE;

  IF v_existing.status = 'completed' THEN
    RETURN; -- Already credited, no-op.
  END IF;

  -- Ensure wallet exists then credit it.
  INSERT INTO public.wallets(user_id, balance)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.wallets
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id;

  UPDATE public.stripe_topups
  SET status = 'completed',
      credited_at = now(),
      updated_at = now()
  WHERE stripe_session_id = p_session_id;
END;
$$;
