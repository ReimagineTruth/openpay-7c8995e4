
-- 1. Table
CREATE TABLE IF NOT EXISTS public.partner_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_app_id UUID NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'OUSD',
  description TEXT,
  reference TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_url TEXT,
  cancel_url TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','canceled','expired')),
  buyer_user_id UUID,
  transfer_id UUID,
  transaction_id UUID,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '2 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_charges_app ON public.partner_charges(partner_app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_charges_owner ON public.partner_charges(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_charges_buyer ON public.partner_charges(buyer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_charges_status ON public.partner_charges(status);

GRANT SELECT ON public.partner_charges TO authenticated;
GRANT ALL ON public.partner_charges TO service_role;

ALTER TABLE public.partner_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Charges: owner can view own"
  ON public.partner_charges FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR buyer_user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.partner_charges_touch() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_partner_charges_touch ON public.partner_charges;
CREATE TRIGGER trg_partner_charges_touch BEFORE UPDATE ON public.partner_charges
  FOR EACH ROW EXECUTE FUNCTION public.partner_charges_touch();

-- 2. Create charge (called from edge function with service role, so SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.partner_charge_create(
  p_partner_app_id UUID,
  p_owner_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_description TEXT,
  p_reference TEXT,
  p_success_url TEXT,
  p_cancel_url TEXT,
  p_metadata JSONB
) RETURNS TABLE(charge_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_exp TIMESTAMPTZ;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  INSERT INTO public.partner_charges(
    partner_app_id, owner_user_id, amount, currency, description, reference,
    success_url, cancel_url, metadata
  ) VALUES (
    p_partner_app_id, p_owner_user_id, p_amount, COALESCE(NULLIF(p_currency,''),'OUSD'),
    NULLIF(p_description,''), NULLIF(p_reference,''),
    NULLIF(p_success_url,''), NULLIF(p_cancel_url,''),
    COALESCE(p_metadata,'{}'::jsonb)
  ) RETURNING id, expires_at INTO v_id, v_exp;
  RETURN QUERY SELECT v_id, v_exp;
END $$;

GRANT EXECUTE ON FUNCTION public.partner_charge_create(UUID,UUID,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO service_role;

-- 3. Public getter for hosted checkout page (authenticated buyers)
CREATE OR REPLACE FUNCTION public.partner_charge_get_public(p_charge_id UUID)
RETURNS TABLE(
  id UUID, amount NUMERIC, currency TEXT, description TEXT,
  status TEXT, expires_at TIMESTAMPTZ, success_url TEXT, cancel_url TEXT,
  partner_app_id UUID, partner_app_name TEXT, partner_app_website TEXT,
  owner_user_id UUID, owner_full_name TEXT, owner_username TEXT, owner_avatar_url TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT c.id, c.amount, c.currency, c.description,
    CASE WHEN c.status = 'created' AND c.expires_at < now() THEN 'expired' ELSE c.status END,
    c.expires_at, c.success_url, c.cancel_url,
    c.partner_app_id, pa.name, pa.website,
    c.owner_user_id, p.full_name, p.username, p.avatar_url
  FROM public.partner_charges c
  JOIN public.partner_apps pa ON pa.id = c.partner_app_id
  LEFT JOIN public.profiles p ON p.id = c.owner_user_id
  WHERE c.id = p_charge_id;
$$;

GRANT EXECUTE ON FUNCTION public.partner_charge_get_public(UUID) TO authenticated, anon, service_role;

-- 4. Approve/pay charge (buyer is auth.uid())
CREATE OR REPLACE FUNCTION public.partner_charge_approve(p_charge_id UUID)
RETURNS TABLE(charge_id UUID, transaction_id UUID, buyer_balance NUMERIC, success_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer UUID := auth.uid();
  v_charge public.partner_charges%ROWTYPE;
  v_buyer_balance NUMERIC;
  v_tx_id UUID;
  v_transfer_id UUID;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_charge FROM public.partner_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Charge not found'; END IF;
  IF v_charge.status <> 'created' THEN RAISE EXCEPTION 'Charge is % and cannot be paid', v_charge.status; END IF;
  IF v_charge.expires_at < now() THEN
    UPDATE public.partner_charges SET status='expired' WHERE id = p_charge_id;
    RAISE EXCEPTION 'Charge expired';
  END IF;
  IF v_charge.owner_user_id = v_buyer THEN RAISE EXCEPTION 'You cannot pay your own charge'; END IF;

  SELECT balance INTO v_buyer_balance FROM public.wallets WHERE user_id = v_buyer FOR UPDATE;
  IF v_buyer_balance IS NULL THEN
    INSERT INTO public.wallets(user_id, balance) VALUES (v_buyer, 0)
      ON CONFLICT (user_id) DO NOTHING;
    v_buyer_balance := 0;
  END IF;
  IF v_buyer_balance < v_charge.amount THEN RAISE EXCEPTION 'Insufficient OpenPay balance'; END IF;

  -- Move funds
  UPDATE public.wallets SET balance = balance - v_charge.amount, updated_at = now()
    WHERE user_id = v_buyer;
  INSERT INTO public.wallets(user_id, balance) VALUES (v_charge.owner_user_id, v_charge.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  -- Ledger transaction
  INSERT INTO public.transactions(sender_id, receiver_id, amount, note, status)
  VALUES (v_buyer, v_charge.owner_user_id, v_charge.amount,
    COALESCE('PayButton: ' || v_charge.description, 'OpenPay PayButton'), 'completed')
  RETURNING id INTO v_tx_id;

  -- Partner transfer log (credit to partner owner)
  INSERT INTO public.partner_transfers(
    partner_app_id, owner_user_id, direction, counterparty_user_id, counterparty_identifier,
    amount, currency, note, status, transaction_id, metadata
  ) VALUES (
    v_charge.partner_app_id, v_charge.owner_user_id, 'credit', v_buyer,
    'paybutton:' || v_charge.id::text, v_charge.amount, v_charge.currency,
    v_charge.description, 'completed', v_tx_id,
    jsonb_build_object('charge_id', v_charge.id, 'reference', v_charge.reference)
  ) RETURNING id INTO v_transfer_id;

  UPDATE public.partner_charges
    SET status='paid', buyer_user_id=v_buyer, transaction_id=v_tx_id,
        transfer_id=v_transfer_id, paid_at=now()
    WHERE id = p_charge_id;

  RETURN QUERY SELECT p_charge_id, v_tx_id, v_buyer_balance - v_charge.amount, v_charge.success_url;
END $$;

GRANT EXECUTE ON FUNCTION public.partner_charge_approve(UUID) TO authenticated, service_role;

-- 5. Cancel charge
CREATE OR REPLACE FUNCTION public.partner_charge_cancel(p_charge_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_row public.partner_charges%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.partner_charges WHERE id = p_charge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_row.status <> 'created' THEN RETURN FALSE; END IF;
  IF v_uid IS NOT NULL AND v_uid <> v_row.owner_user_id AND v_uid <> COALESCE(v_row.buyer_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.partner_charges SET status='canceled' WHERE id = p_charge_id;
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.partner_charge_cancel(UUID) TO authenticated, service_role;
