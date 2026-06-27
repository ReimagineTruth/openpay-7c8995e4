-- Restore and harden missing NFT backend features used by the app.

-- Needed by marketplace category filters.
ALTER TABLE public.nft_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.nft_store_profiles
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

CREATE INDEX IF NOT EXISTS idx_nft_items_category ON public.nft_items(category);
CREATE INDEX IF NOT EXISTS idx_nft_store_profiles_category ON public.nft_store_profiles(category);

-- Ensure transaction metadata and fee columns exist for admin/reporting.
ALTER TABLE public.nft_transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.nft_auction_bids
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'openpay_balance',
  ADD COLUMN IF NOT EXISTS fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Widen transaction kinds used by NFT features.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'nft_transactions'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%tx_kind%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.nft_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.nft_transactions
  ADD CONSTRAINT nft_transactions_tx_kind_check
  CHECK (tx_kind IN ('mint','sale','primary_sale','resale','gift','bid','bid_fee','auction_settle'));

-- Missing live chat table.
CREATE TABLE IF NOT EXISTS public.nft_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  item_id uuid REFERENCES public.nft_items(id) ON DELETE SET NULL,
  reply_to uuid REFERENCES public.nft_chat_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.nft_chat_messages TO authenticated;
GRANT ALL ON public.nft_chat_messages TO service_role;

ALTER TABLE public.nft_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in can read NFT chat" ON public.nft_chat_messages;
DROP POLICY IF EXISTS "Users can post their own messages" ON public.nft_chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.nft_chat_messages;

CREATE POLICY "Anyone signed in can read NFT chat"
  ON public.nft_chat_messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can post their own messages"
  ON public.nft_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON public.nft_chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nft_chat_created ON public.nft_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_chat_user ON public.nft_chat_messages(user_id);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_chat_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_auctions;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.nft_auction_bids;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- Runtime defaults for fees.
INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
VALUES
  ('nft_platform_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null)),
  ('nft_mint_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null)),
  ('nft_bid_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.nft_default_fee_json()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null)
$$;

CREATE OR REPLACE FUNCTION public.nft_get_platform_fee()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value_json FROM public.openpay_runtime_settings WHERE setting_key = 'nft_platform_fee'),
    public.nft_default_fee_json()
  )
$$;

CREATE OR REPLACE FUNCTION public.nft_get_mint_fee()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value_json FROM public.openpay_runtime_settings WHERE setting_key = 'nft_mint_fee'),
    public.nft_default_fee_json()
  )
$$;

CREATE OR REPLACE FUNCTION public.nft_get_bid_fee()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value_json FROM public.openpay_runtime_settings WHERE setting_key = 'nft_bid_fee'),
    public.nft_default_fee_json()
  )
$$;

CREATE OR REPLACE FUNCTION public.nft_admin_set_mint_fee(
  p_enabled boolean,
  p_rate numeric,
  p_collector uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF COALESCE(p_rate, 0) < 0 OR COALESCE(p_rate, 0) > 50 THEN
    RAISE EXCEPTION 'rate must be 0..50';
  END IF;

  v_val := jsonb_build_object(
    'enabled', COALESCE(p_enabled, false),
    'rate', COALESCE(p_rate, 0),
    'collector_user_id', p_collector
  );

  INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
  VALUES ('nft_mint_fee', v_val)
  ON CONFLICT (setting_key)
  DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now();

  RETURN v_val;
END $$;

CREATE OR REPLACE FUNCTION public.nft_admin_set_bid_fee(
  p_enabled boolean,
  p_rate numeric,
  p_collector uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_val jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF COALESCE(p_rate, 0) < 0 OR COALESCE(p_rate, 0) > 50 THEN
    RAISE EXCEPTION 'rate must be 0..50';
  END IF;

  v_val := jsonb_build_object(
    'enabled', COALESCE(p_enabled, false),
    'rate', COALESCE(p_rate, 0),
    'collector_user_id', p_collector
  );

  INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
  VALUES ('nft_bid_fee', v_val)
  ON CONFLICT (setting_key)
  DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now();

  RETURN v_val;
END $$;

CREATE OR REPLACE FUNCTION public.nft_mint_item(
  p_collection_id uuid,
  p_name text,
  p_code text,
  p_description text,
  p_image_url text,
  p_media_url text,
  p_media_type text,
  p_quantity integer,
  p_price numeric,
  p_currency text,
  p_properties jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
  v_fee_cfg jsonb;
  v_fee_enabled boolean := false;
  v_fee_rate numeric := 0;
  v_fee_collector uuid;
  v_fee_amount numeric := 0;
  v_base numeric := 0;
  v_category text := 'general';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'name required'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'code required'; END IF;

  v_category := COALESCE(NULLIF(p_properties->>'category',''), 'general');

  SELECT public.nft_get_mint_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;

  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_base := COALESCE(p_price, 0) * p_quantity;
    IF v_base <= 0 THEN v_base := p_quantity; END IF;
    v_fee_amount := round((v_base * v_fee_rate / 100)::numeric, 2);

    IF v_fee_amount > 0 THEN
      UPDATE public.wallets
      SET balance = balance - v_fee_amount, updated_at = now()
      WHERE user_id = v_uid AND balance >= v_fee_amount;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'insufficient OpenPay balance for mint fee (% required)', v_fee_amount;
      END IF;

      IF v_fee_collector IS NOT NULL THEN
        INSERT INTO public.wallets(user_id, balance)
        VALUES (v_fee_collector, v_fee_amount)
        ON CONFLICT (user_id)
        DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
      END IF;
    END IF;
  END IF;

  INSERT INTO public.nft_items(
    collection_id, creator_id, name, code, description, image_url, media_url, media_type,
    quantity_total, quantity_minted, price, currency, properties, category
  )
  VALUES (
    p_collection_id, v_uid, btrim(p_name), btrim(p_code), p_description, p_image_url,
    COALESCE(p_media_url, p_image_url), COALESCE(p_media_type, 'image'), p_quantity,
    p_quantity, COALESCE(p_price, 0), COALESCE(NULLIF(p_currency,''), 'OUSD'),
    COALESCE(p_properties, '{}'::jsonb), v_category
  )
  RETURNING id INTO v_item_id;

  INSERT INTO public.nft_ownership(item_id, owner_id, quantity)
  VALUES (v_item_id, v_uid, p_quantity)
  ON CONFLICT (item_id, owner_id)
  DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity, updated_at = now();

  INSERT INTO public.nft_transactions(
    item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount,
    platform_fee, currency, payment_method, tx_kind, status, metadata
  )
  VALUES (
    v_item_id, NULL, v_uid, p_quantity, COALESCE(p_price, 0), 0, 0,
    v_fee_amount, COALESCE(NULLIF(p_currency,''), 'OUSD'), 'openpay_balance', 'mint', 'completed',
    jsonb_build_object('mint_fee', v_fee_amount, 'mint_fee_rate', v_fee_rate, 'category', v_category)
  );

  RETURN v_item_id;
END $$;

CREATE OR REPLACE FUNCTION public.nft_buy_item(
  p_item_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_listing_id uuid DEFAULT NULL,
  p_pi_payment_id text DEFAULT NULL,
  p_pi_txid text DEFAULT NULL,
  p_card_number text DEFAULT NULL,
  p_card_cvc text DEFAULT NULL,
  p_card_exp_month integer DEFAULT NULL,
  p_card_exp_year integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_item public.nft_items%ROWTYPE;
  v_listing public.nft_listings%ROWTYPE;
  v_price numeric;
  v_total numeric;
  v_royalty numeric := 0;
  v_platform_fee numeric := 0;
  v_seller_net numeric;
  v_tx_id uuid;
  v_creator_royalty_pct numeric := 0;
  v_creator uuid;
  v_kind text;
  v_fee_cfg jsonb;
  v_fee_rate numeric := 0;
  v_fee_enabled boolean := false;
  v_collector uuid;
  v_card_san text;
  v_cvc_san text;
  v_meta jsonb;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'item not active'; END IF;

  IF EXISTS (
    SELECT 1
    FROM public.nft_auctions a
    WHERE a.item_id = p_item_id
      AND a.status = 'active'
      AND a.ends_at > now()
  ) THEN
    RAISE EXCEPTION 'auction in progress; fixed-price buying is disabled until the auction settles';
  END IF;

  v_creator := v_item.creator_id;
  IF v_item.collection_id IS NOT NULL THEN
    SELECT royalty_pct INTO v_creator_royalty_pct FROM public.nft_collections WHERE id = v_item.collection_id;
  END IF;
  v_creator_royalty_pct := COALESCE(v_creator_royalty_pct, 0);

  IF p_listing_id IS NOT NULL THEN
    SELECT * INTO v_listing FROM public.nft_listings WHERE id = p_listing_id AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'listing not available'; END IF;
    IF v_listing.item_id <> p_item_id THEN RAISE EXCEPTION 'listing mismatch'; END IF;
    IF v_listing.quantity < p_quantity THEN RAISE EXCEPTION 'not enough listed'; END IF;
    v_seller := v_listing.seller_id;
    v_price := v_listing.price;
    v_kind := 'resale';
  ELSE
    v_seller := v_item.creator_id;
    v_price := v_item.price;
    v_kind := 'primary_sale';
  END IF;

  IF v_buyer = v_seller THEN RAISE EXCEPTION 'cannot buy from yourself'; END IF;
  v_total := v_price * p_quantity;

  IF NOT EXISTS (
    SELECT 1 FROM public.nft_ownership
    WHERE item_id = p_item_id AND owner_id = v_seller AND quantity >= p_quantity
  ) THEN
    RAISE EXCEPTION 'seller has insufficient supply';
  END IF;

  SELECT public.nft_get_platform_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_platform_fee := round((v_total * v_fee_rate / 100)::numeric, 2);
  END IF;

  IF v_kind = 'resale' AND v_creator IS NOT NULL AND v_creator <> v_seller AND v_creator_royalty_pct > 0 THEN
    v_royalty := round((v_total * v_creator_royalty_pct / 100)::numeric, 2);
  END IF;
  v_seller_net := v_total - v_royalty - v_platform_fee;

  IF p_payment_method = 'openpay_balance' THEN
    UPDATE public.wallets
    SET balance = balance - v_total, updated_at = now()
    WHERE user_id = v_buyer AND balance >= v_total;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient balance'; END IF;
  ELSIF p_payment_method = 'virtual_card' THEN
    v_card_san := regexp_replace(COALESCE(p_card_number,''), '\D', '', 'g');
    v_cvc_san := regexp_replace(COALESCE(p_card_cvc,''), '\D', '', 'g');
    IF char_length(v_card_san) <> 16 THEN RAISE EXCEPTION 'Card number must be 16 digits'; END IF;
    IF char_length(v_cvc_san) <> 3 THEN RAISE EXCEPTION 'Invalid CVC'; END IF;
    IF p_card_exp_month IS NULL OR p_card_exp_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid expiry month'; END IF;
    IF p_card_exp_year IS NULL OR p_card_exp_year < EXTRACT(year FROM now())::int THEN RAISE EXCEPTION 'Invalid expiry year'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.virtual_cards
      WHERE user_id = v_buyer
        AND card_number = v_card_san
        AND cvc = v_cvc_san
        AND expiry_month = p_card_exp_month
        AND expiry_year = p_card_exp_year
        AND is_active = true
        AND is_locked = false
    ) THEN
      RAISE EXCEPTION 'Invalid virtual card details';
    END IF;
  ELSIF p_payment_method = 'pi' THEN
    IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
      RAISE EXCEPTION 'Pi payment requires payment id and txid';
    END IF;
  END IF;

  IF v_royalty > 0 THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_creator, v_royalty)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
    VALUES (v_creator, p_item_id, v_royalty, v_item.currency, 'royalty');
  END IF;

  IF v_platform_fee > 0 AND v_collector IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_collector, v_platform_fee)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  INSERT INTO public.wallets(user_id, balance)
  VALUES (v_seller, v_seller_net)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
  VALUES (v_seller, p_item_id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);

  UPDATE public.nft_ownership
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE item_id = p_item_id AND owner_id = v_seller;

  INSERT INTO public.nft_ownership(item_id, owner_id, quantity)
  VALUES (p_item_id, v_buyer, p_quantity)
  ON CONFLICT (item_id, owner_id)
  DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity, updated_at = now();

  IF p_listing_id IS NOT NULL THEN
    UPDATE public.nft_listings
    SET quantity = quantity - p_quantity,
        status = CASE WHEN quantity - p_quantity <= 0 THEN 'sold' ELSE status END,
        updated_at = now()
    WHERE id = p_listing_id;
  END IF;

  v_meta := jsonb_build_object(
    'platform_fee', v_platform_fee,
    'platform_fee_rate', v_fee_rate,
    'pi_payment_id', p_pi_payment_id,
    'pi_txid', p_pi_txid,
    'card_last4', CASE WHEN p_payment_method = 'virtual_card' THEN right(v_card_san, 4) ELSE NULL END
  );

  INSERT INTO public.nft_transactions(
    item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount,
    platform_fee, currency, payment_method, tx_kind, status, metadata
  )
  VALUES (
    p_item_id, p_listing_id, v_seller, v_buyer, p_quantity, v_price, v_total, v_royalty,
    v_platform_fee, v_item.currency, p_payment_method, v_kind, 'completed', v_meta
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END $$;

CREATE OR REPLACE FUNCTION public.nft_place_bid_with_payment(
  p_auction_id uuid,
  p_amount numeric,
  p_payment_method text DEFAULT 'openpay_balance',
  p_pi_payment_id text DEFAULT NULL,
  p_pi_txid text DEFAULT NULL,
  p_card_number text DEFAULT NULL,
  p_card_cvc text DEFAULT NULL,
  p_card_exp_month integer DEFAULT NULL,
  p_card_exp_year integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auction public.nft_auctions%ROWTYPE;
  v_min_required numeric;
  v_bid_id uuid;
  v_wallet_bal numeric;
  v_card_san text;
  v_cvc_san text;
  v_fee_cfg jsonb;
  v_fee_enabled boolean := false;
  v_fee_rate numeric := 0;
  v_fee_collector uuid;
  v_fee_amount numeric := 0;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'invalid bid amount'; END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction not active'; END IF;
  IF v_auction.ends_at <= now() THEN RAISE EXCEPTION 'auction ended'; END IF;
  IF v_auction.seller_id = v_uid THEN RAISE EXCEPTION 'cannot bid on your own auction'; END IF;

  v_min_required := COALESCE(v_auction.current_bid, v_auction.start_price)
    + CASE WHEN v_auction.current_bid IS NULL THEN 0 ELSE v_auction.min_increment END;
  IF p_amount < v_min_required THEN RAISE EXCEPTION 'bid too low (min %)', v_min_required; END IF;

  IF p_payment_method = 'virtual_card' THEN
    v_card_san := regexp_replace(COALESCE(p_card_number,''), '\D', '', 'g');
    v_cvc_san := regexp_replace(COALESCE(p_card_cvc,''), '\D', '', 'g');
    IF char_length(v_card_san) <> 16 THEN RAISE EXCEPTION 'Card number must be 16 digits'; END IF;
    IF char_length(v_cvc_san) <> 3 THEN RAISE EXCEPTION 'Invalid CVC'; END IF;
    IF p_card_exp_month IS NULL OR p_card_exp_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid expiry month'; END IF;
    IF p_card_exp_year IS NULL OR p_card_exp_year < EXTRACT(year FROM now())::int THEN RAISE EXCEPTION 'Invalid expiry year'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.virtual_cards
      WHERE user_id = v_uid
        AND card_number = v_card_san
        AND cvc = v_cvc_san
        AND expiry_month = p_card_exp_month
        AND expiry_year = p_card_exp_year
        AND is_active = true
        AND is_locked = false
    ) THEN
      RAISE EXCEPTION 'Invalid virtual card details';
    END IF;
  ELSIF p_payment_method = 'pi' THEN
    IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
      RAISE EXCEPTION 'Pi payment requires payment id and txid';
    END IF;
  END IF;

  SELECT public.nft_get_bid_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_fee_amount := round((p_amount * v_fee_rate / 100)::numeric, 2);
  END IF;

  IF p_payment_method = 'openpay_balance' THEN
    SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE(v_wallet_bal, 0) < (p_amount + v_fee_amount) THEN
      RAISE EXCEPTION 'insufficient balance to escrow bid and fee (need %)', (p_amount + v_fee_amount);
    END IF;

    UPDATE public.wallets
    SET balance = balance - (p_amount + v_fee_amount), updated_at = now()
    WHERE user_id = v_uid;
  ELSE
    IF v_fee_amount > 0 THEN
      SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
      IF COALESCE(v_wallet_bal, 0) < v_fee_amount THEN
        RAISE EXCEPTION 'insufficient OpenPay balance for bid fee (need %)', v_fee_amount;
      END IF;
      UPDATE public.wallets
      SET balance = balance - v_fee_amount, updated_at = now()
      WHERE user_id = v_uid;
    END IF;
  END IF;

  IF v_fee_amount > 0 AND v_fee_collector IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_fee_collector, v_fee_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  IF v_auction.current_bidder IS NOT NULL AND v_auction.current_bid IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_auction.current_bidder, v_auction.current_bid)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  v_meta := jsonb_build_object(
    'bid_fee_rate', v_fee_rate,
    'pi_payment_id', p_pi_payment_id,
    'pi_txid', p_pi_txid,
    'card_last4', CASE WHEN p_payment_method = 'virtual_card' THEN right(v_card_san, 4) ELSE NULL END
  );

  UPDATE public.nft_auctions
  SET current_bid = p_amount, current_bidder = v_uid, updated_at = now()
  WHERE id = p_auction_id;

  INSERT INTO public.nft_auction_bids(auction_id, bidder_id, amount, payment_method, fee_amount, metadata)
  VALUES (p_auction_id, v_uid, p_amount, p_payment_method, v_fee_amount, v_meta)
  RETURNING id INTO v_bid_id;

  INSERT INTO public.nft_transactions(
    item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount,
    platform_fee, currency, payment_method, tx_kind, status, metadata
  )
  VALUES (
    v_auction.item_id, v_auction.seller_id, v_uid, v_auction.quantity,
    p_amount / NULLIF(v_auction.quantity, 0), p_amount, 0,
    v_fee_amount, v_auction.currency, p_payment_method, 'bid', 'pending', v_meta
  );

  RETURN v_bid_id;
END $$;

CREATE OR REPLACE FUNCTION public.nft_finalize_auction(p_auction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auction public.nft_auctions%ROWTYPE;
  v_item public.nft_items%ROWTYPE;
  v_royalty numeric := 0;
  v_seller_net numeric;
  v_tx_id uuid;
  v_creator_royalty_pct numeric := 0;
  v_kind text;
  v_new_unit_price numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction not active'; END IF;
  IF v_auction.ends_at > now() THEN RAISE EXCEPTION 'auction still running'; END IF;
  IF v_uid <> v_auction.seller_id AND v_uid <> COALESCE(v_auction.current_bidder, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'only seller or winning bidder can finalize';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = v_auction.item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;

  IF v_auction.current_bidder IS NULL OR v_auction.current_bid IS NULL THEN
    UPDATE public.nft_auctions SET status = 'ended', updated_at = now() WHERE id = p_auction_id;
    RETURN NULL;
  END IF;

  v_kind := CASE WHEN v_auction.seller_id = v_item.creator_id THEN 'primary_sale' ELSE 'resale' END;

  IF v_item.collection_id IS NOT NULL THEN
    SELECT royalty_pct INTO v_creator_royalty_pct FROM public.nft_collections WHERE id = v_item.collection_id;
  END IF;
  v_creator_royalty_pct := COALESCE(v_creator_royalty_pct, 0);

  IF v_kind = 'resale' AND v_item.creator_id <> v_auction.seller_id AND v_creator_royalty_pct > 0 THEN
    v_royalty := round((v_auction.current_bid * v_creator_royalty_pct / 100)::numeric, 2);
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_item.creator_id, v_royalty)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
    VALUES (v_item.creator_id, v_item.id, v_royalty, v_item.currency, 'royalty');
  END IF;

  v_seller_net := v_auction.current_bid - v_royalty;
  INSERT INTO public.wallets(user_id, balance)
  VALUES (v_auction.seller_id, v_seller_net)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
  VALUES (v_auction.seller_id, v_item.id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);

  UPDATE public.nft_ownership
  SET quantity = quantity - v_auction.quantity, updated_at = now()
  WHERE item_id = v_item.id AND owner_id = v_auction.seller_id;

  INSERT INTO public.nft_ownership(item_id, owner_id, quantity)
  VALUES (v_item.id, v_auction.current_bidder, v_auction.quantity)
  ON CONFLICT (item_id, owner_id)
  DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity, updated_at = now();

  v_new_unit_price := round((v_auction.current_bid / NULLIF(v_auction.quantity, 0))::numeric, 2);

  INSERT INTO public.nft_transactions(
    item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount,
    platform_fee, currency, payment_method, tx_kind, status, metadata
  )
  VALUES (
    v_item.id, v_auction.seller_id, v_auction.current_bidder, v_auction.quantity,
    v_new_unit_price, v_auction.current_bid, v_royalty, 0, v_item.currency,
    'openpay_balance', v_kind, 'completed',
    jsonb_build_object('auction_id', p_auction_id, 'settled_price_each', v_new_unit_price)
  )
  RETURNING id INTO v_tx_id;

  IF v_new_unit_price IS NOT NULL AND v_new_unit_price > COALESCE(v_item.price, 0) THEN
    UPDATE public.nft_items SET price = v_new_unit_price, updated_at = now() WHERE id = v_item.id;
  END IF;

  UPDATE public.nft_transactions
  SET status = 'completed', tx_kind = 'auction_settle', metadata = metadata || jsonb_build_object('settlement_tx_id', v_tx_id)
  WHERE item_id = v_item.id
    AND buyer_id = v_auction.current_bidder
    AND tx_kind = 'bid'
    AND status = 'pending';

  UPDATE public.nft_auctions
  SET status = 'settled', winner_id = v_auction.current_bidder, updated_at = now()
  WHERE id = p_auction_id;

  RETURN v_tx_id;
END $$;

-- Grants for restored/updated RPCs.
GRANT EXECUTE ON FUNCTION public.nft_get_platform_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_get_mint_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_get_bid_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_set_mint_fee(boolean, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_set_bid_fee(boolean, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_mint_item(uuid,text,text,text,text,text,text,integer,numeric,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_buy_item(uuid,integer,text,uuid,text,text,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_place_bid_with_payment(uuid,numeric,text,text,text,text,text,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.nft_admin_set_mint_fee(boolean, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_admin_set_bid_fee(boolean, numeric, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_mint_item(uuid,text,text,text,text,text,text,integer,numeric,text,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_buy_item(uuid,integer,text,uuid,text,text,text,text,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_place_bid_with_payment(uuid,numeric,text,text,text,text,text,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';