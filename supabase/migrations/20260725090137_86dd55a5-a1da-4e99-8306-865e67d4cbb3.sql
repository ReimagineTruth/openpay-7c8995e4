
-- ============================================================
-- Partner Transfer API: tables, RLS, and server functions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  website TEXT DEFAULT '',
  allowed_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_apps_key_hash_uniq ON public.partner_apps(key_hash);
CREATE INDEX IF NOT EXISTS partner_apps_owner_idx ON public.partner_apps(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_apps TO authenticated;
GRANT ALL ON public.partner_apps TO service_role;

ALTER TABLE public.partner_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own partner apps" ON public.partner_apps
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Transfer log
CREATE TABLE IF NOT EXISTS public.partner_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_app_id UUID NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('debit','credit')),
  counterparty_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  counterparty_identifier TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'OUSD',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'completed',
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_transfers_idem_uniq
  ON public.partner_transfers(partner_app_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_transfers_owner_idx ON public.partner_transfers(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS partner_transfers_app_idx ON public.partner_transfers(partner_app_id, created_at DESC);

GRANT SELECT ON public.partner_transfers TO authenticated;
GRANT ALL ON public.partner_transfers TO service_role;

ALTER TABLE public.partner_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views own partner transfers" ON public.partner_transfers
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Updated_at trigger for partner_apps
CREATE OR REPLACE FUNCTION public.partner_apps_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_partner_apps_touch ON public.partner_apps;
CREATE TRIGGER trg_partner_apps_touch
  BEFORE UPDATE ON public.partner_apps
  FOR EACH ROW EXECUTE FUNCTION public.partner_apps_touch_updated_at();

-- ============================================================
-- Lookup helper (used by edge function)
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_lookup_account(p_identifier TEXT)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  avatar_url TEXT,
  account_number TEXT,
  balance NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id TEXT := TRIM(COALESCE(p_identifier,''));
  v_user UUID;
  v_norm TEXT;
BEGIN
  IF v_id = '' THEN RETURN; END IF;

  -- Account number (OP + hex of uuid)
  IF UPPER(v_id) LIKE 'OP%' AND LENGTH(v_id) = 34 THEN
    v_norm := LOWER(SUBSTRING(v_id, 3));
    v_norm := SUBSTRING(v_norm,1,8) || '-' || SUBSTRING(v_norm,9,4) || '-' ||
              SUBSTRING(v_norm,13,4) || '-' || SUBSTRING(v_norm,17,4) || '-' ||
              SUBSTRING(v_norm,21,12);
    BEGIN v_user := v_norm::uuid; EXCEPTION WHEN OTHERS THEN v_user := NULL; END;
  END IF;

  -- Username
  IF v_user IS NULL THEN
    SELECT id INTO v_user FROM public.profiles
    WHERE LOWER(username) = LOWER(REPLACE(v_id,'@',''))
    LIMIT 1;
  END IF;

  -- Email
  IF v_user IS NULL AND POSITION('@' IN v_id) > 0 THEN
    SELECT id INTO v_user FROM auth.users
    WHERE LOWER(email) = LOWER(v_id) LIMIT 1;
  END IF;

  IF v_user IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    'OP' || UPPER(REPLACE(p.id::TEXT,'-','')),
    COALESCE(w.balance, 0)::NUMERIC,
    'OUSD'::TEXT
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  WHERE p.id = v_user;
END; $$;

REVOKE ALL ON FUNCTION public.partner_lookup_account(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_lookup_account(TEXT) TO service_role;

-- ============================================================
-- Transfer function: debit p_sender_user_id, credit target
-- ============================================================
CREATE OR REPLACE FUNCTION public.partner_transfer_send(
  p_sender_user_id UUID,
  p_partner_app_id UUID,
  p_recipient_identifier TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT '',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
  transfer_id UUID,
  transaction_id UUID,
  sender_balance NUMERIC,
  recipient_user_id UUID,
  status TEXT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_amount NUMERIC(12,2) := ROUND(COALESCE(p_amount,0)::NUMERIC, 2);
  v_recipient UUID;
  v_sender_balance NUMERIC(12,2);
  v_tx_id UUID;
  v_transfer_id UUID;
  v_existing RECORD;
BEGIN
  IF p_sender_user_id IS NULL THEN RAISE EXCEPTION 'Sender required'; END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  -- Idempotency
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT pt.id, pt.transaction_id INTO v_existing
    FROM public.partner_transfers pt
    WHERE pt.partner_app_id = p_partner_app_id
      AND pt.idempotency_key = p_idempotency_key
    LIMIT 1;
    IF v_existing.id IS NOT NULL THEN
      SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = p_sender_user_id;
      RETURN QUERY SELECT v_existing.id, v_existing.transaction_id, v_sender_balance,
        (SELECT counterparty_user_id FROM public.partner_transfers WHERE id = v_existing.id),
        'duplicate'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Resolve recipient via lookup
  SELECT user_id INTO v_recipient FROM public.partner_lookup_account(p_recipient_identifier) LIMIT 1;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'Recipient not found'; END IF;
  IF v_recipient = p_sender_user_id THEN RAISE EXCEPTION 'Cannot transfer to self'; END IF;

  -- Lock sender wallet
  SELECT balance INTO v_sender_balance FROM public.wallets WHERE user_id = p_sender_user_id FOR UPDATE;
  IF v_sender_balance IS NULL THEN RAISE EXCEPTION 'Sender wallet not found'; END IF;
  IF v_sender_balance < v_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Debit sender, credit recipient
  UPDATE public.wallets SET balance = balance - v_amount, updated_at = now() WHERE user_id = p_sender_user_id;
  INSERT INTO public.wallets (user_id, balance) VALUES (v_recipient, v_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  -- Create the canonical transaction row
  INSERT INTO public.transactions (sender_id, receiver_id, amount, note, status)
  VALUES (p_sender_user_id, v_recipient, v_amount, COALESCE(NULLIF(p_note,''), 'Partner API transfer'), 'completed')
  RETURNING id INTO v_tx_id;

  -- Log
  v_transfer_id := gen_random_uuid();
  INSERT INTO public.partner_transfers (
    id, partner_app_id, owner_user_id, direction, counterparty_user_id,
    counterparty_identifier, amount, currency, note, status, transaction_id, idempotency_key
  ) VALUES (
    v_transfer_id, p_partner_app_id, p_sender_user_id, 'debit', v_recipient,
    p_recipient_identifier, v_amount, 'OUSD', COALESCE(p_note,''), 'completed', v_tx_id, p_idempotency_key
  );

  UPDATE public.partner_apps SET last_used_at = now() WHERE id = p_partner_app_id;

  RETURN QUERY SELECT v_transfer_id, v_tx_id, v_sender_balance - v_amount, v_recipient, 'completed'::TEXT;
END; $$;

REVOKE ALL ON FUNCTION public.partner_transfer_send(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.partner_transfer_send(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
