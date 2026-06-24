
-- ============ NFT COLLECTIONS ============
CREATE TABLE public.nft_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  cover_url text,
  royalty_pct numeric NOT NULL DEFAULT 5 CHECK (royalty_pct >= 0 AND royalty_pct <= 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_collections TO authenticated;
GRANT ALL ON public.nft_collections TO service_role;
ALTER TABLE public.nft_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_collections_select_all" ON public.nft_collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "nft_collections_insert_own" ON public.nft_collections FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "nft_collections_update_own" ON public.nft_collections FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "nft_collections_delete_own" ON public.nft_collections FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- ============ NFT ITEMS ============
CREATE TABLE public.nft_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES public.nft_collections(id) ON DELETE SET NULL,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  description text,
  image_url text,
  media_url text,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','gif','video','audio')),
  quantity_total integer NOT NULL CHECK (quantity_total > 0),
  quantity_minted integer NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'OUSD',
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_items TO authenticated;
GRANT ALL ON public.nft_items TO service_role;
ALTER TABLE public.nft_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_items_select_all" ON public.nft_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "nft_items_insert_own" ON public.nft_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "nft_items_update_own" ON public.nft_items FOR UPDATE TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "nft_items_delete_own" ON public.nft_items FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE INDEX nft_items_creator_idx ON public.nft_items(creator_id);
CREATE INDEX nft_items_collection_idx ON public.nft_items(collection_id);

-- ============ NFT OWNERSHIP ============
CREATE TABLE public.nft_ownership (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, owner_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_ownership TO authenticated;
GRANT ALL ON public.nft_ownership TO service_role;
ALTER TABLE public.nft_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_ownership_select_all" ON public.nft_ownership FOR SELECT TO authenticated USING (true);
CREATE INDEX nft_ownership_owner_idx ON public.nft_ownership(owner_id);

-- ============ NFT LISTINGS (resale) ============
CREATE TABLE public.nft_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price >= 0),
  quantity integer NOT NULL CHECK (quantity > 0),
  currency text NOT NULL DEFAULT 'OUSD',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_listings TO authenticated;
GRANT ALL ON public.nft_listings TO service_role;
ALTER TABLE public.nft_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_listings_select_all" ON public.nft_listings FOR SELECT TO authenticated USING (true);
CREATE POLICY "nft_listings_insert_own" ON public.nft_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "nft_listings_update_own" ON public.nft_listings FOR UPDATE TO authenticated USING (auth.uid() = seller_id);

-- ============ NFT TRANSACTIONS (transparent log) ============
CREATE TABLE public.nft_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.nft_listings(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  price_each numeric NOT NULL CHECK (price_each >= 0),
  total numeric NOT NULL CHECK (total >= 0),
  royalty_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'OUSD',
  payment_method text NOT NULL DEFAULT 'openpay_balance' CHECK (payment_method IN ('openpay_balance','pi','virtual_card','gift')),
  tx_kind text NOT NULL DEFAULT 'sale' CHECK (tx_kind IN ('mint','sale','resale','gift')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','refunded')),
  tx_ref text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nft_transactions TO authenticated;
GRANT ALL ON public.nft_transactions TO service_role;
ALTER TABLE public.nft_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_transactions_select_all" ON public.nft_transactions FOR SELECT TO authenticated USING (true);
CREATE INDEX nft_tx_item_idx ON public.nft_transactions(item_id);
CREATE INDEX nft_tx_buyer_idx ON public.nft_transactions(buyer_id);
CREATE INDEX nft_tx_seller_idx ON public.nft_transactions(seller_id);

-- ============ NFT GIFTS ============
CREATE TABLE public.nft_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  message text,
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending','delivered','claimed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nft_gifts TO authenticated;
GRANT ALL ON public.nft_gifts TO service_role;
ALTER TABLE public.nft_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_gifts_select_involved" ON public.nft_gifts FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- ============ NFT EARNINGS ============
CREATE TABLE public.nft_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.nft_items(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.nft_transactions(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'OUSD',
  source text NOT NULL CHECK (source IN ('primary_sale','royalty','resale')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nft_earnings TO authenticated;
GRANT ALL ON public.nft_earnings TO service_role;
ALTER TABLE public.nft_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_earnings_select_own" ON public.nft_earnings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX nft_earnings_user_idx ON public.nft_earnings(user_id);

-- ============ updated_at trigger reuse ============
CREATE OR REPLACE FUNCTION public.nft_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_nft_collections_touch BEFORE UPDATE ON public.nft_collections FOR EACH ROW EXECUTE FUNCTION public.nft_touch_updated_at();
CREATE TRIGGER trg_nft_items_touch BEFORE UPDATE ON public.nft_items FOR EACH ROW EXECUTE FUNCTION public.nft_touch_updated_at();
CREATE TRIGGER trg_nft_ownership_touch BEFORE UPDATE ON public.nft_ownership FOR EACH ROW EXECUTE FUNCTION public.nft_touch_updated_at();
CREATE TRIGGER trg_nft_listings_touch BEFORE UPDATE ON public.nft_listings FOR EACH ROW EXECUTE FUNCTION public.nft_touch_updated_at();

-- ============ MINT FUNCTION ============
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
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;

  INSERT INTO public.nft_items(collection_id, creator_id, name, code, description, image_url, media_url, media_type, quantity_total, quantity_minted, price, currency, properties)
  VALUES (p_collection_id, v_uid, p_name, p_code, p_description, p_image_url, COALESCE(p_media_url, p_image_url), COALESCE(p_media_type,'image'), p_quantity, p_quantity, COALESCE(p_price,0), COALESCE(p_currency,'OUSD'), COALESCE(p_properties,'{}'::jsonb))
  RETURNING id INTO v_item_id;

  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (v_item_id, v_uid, p_quantity)
  ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  INSERT INTO public.nft_transactions(item_id, seller_id, buyer_id, quantity, price_each, total, currency, payment_method, tx_kind, status)
  VALUES (v_item_id, NULL, v_uid, p_quantity, COALESCE(p_price,0), 0, COALESCE(p_currency,'OUSD'), 'openpay_balance', 'mint', 'completed');

  RETURN v_item_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_mint_item(uuid,text,text,text,text,text,text,integer,numeric,text,jsonb) TO authenticated;

-- ============ BUY FUNCTION ============
CREATE OR REPLACE FUNCTION public.nft_buy_item(
  p_item_id uuid,
  p_quantity integer,
  p_payment_method text,
  p_listing_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_buyer uuid := auth.uid();
  v_seller uuid;
  v_item public.nft_items%ROWTYPE;
  v_listing public.nft_listings%ROWTYPE;
  v_price numeric;
  v_total numeric;
  v_royalty numeric := 0;
  v_seller_net numeric;
  v_tx_id uuid;
  v_creator_royalty_pct numeric := 0;
  v_creator uuid;
  v_kind text;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  IF NOT v_item.is_active THEN RAISE EXCEPTION 'item not active'; END IF;
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
    -- Buy from creator (primary sale)
    v_seller := v_item.creator_id;
    v_price := v_item.price;
    v_kind := 'sale';
  END IF;

  IF v_buyer = v_seller THEN RAISE EXCEPTION 'cannot buy from yourself'; END IF;

  v_total := v_price * p_quantity;

  -- Check seller has enough owned
  IF NOT EXISTS (SELECT 1 FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_seller AND quantity >= p_quantity) THEN
    RAISE EXCEPTION 'seller has insufficient supply';
  END IF;

  -- Payment via OpenPay balance debits wallet
  IF p_payment_method = 'openpay_balance' THEN
    UPDATE public.wallets SET balance = balance - v_total WHERE user_id = v_buyer AND balance >= v_total;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient balance'; END IF;

    -- Royalty to creator if resale
    IF v_kind = 'resale' AND v_creator IS NOT NULL AND v_creator <> v_seller AND v_creator_royalty_pct > 0 THEN
      v_royalty := round((v_total * v_creator_royalty_pct / 100)::numeric, 2);
      UPDATE public.wallets SET balance = balance + v_royalty WHERE user_id = v_creator;
      IF NOT FOUND THEN
        INSERT INTO public.wallets(user_id, balance) VALUES (v_creator, v_royalty);
      END IF;
      INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
        VALUES (v_creator, p_item_id, v_royalty, v_item.currency, 'royalty');
    END IF;

    v_seller_net := v_total - v_royalty;
    UPDATE public.wallets SET balance = balance + v_seller_net WHERE user_id = v_seller;
    IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_seller, v_seller_net); END IF;

    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
      VALUES (v_seller, p_item_id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);
  END IF;
  -- pi / virtual_card: assumed external auth, recorded but no wallet debit

  -- Ownership transfer
  UPDATE public.nft_ownership SET quantity = quantity - p_quantity WHERE item_id = p_item_id AND owner_id = v_seller;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (p_item_id, v_buyer, p_quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  -- Listing update
  IF p_listing_id IS NOT NULL THEN
    UPDATE public.nft_listings SET quantity = quantity - p_quantity, status = CASE WHEN quantity - p_quantity <= 0 THEN 'sold' ELSE status END WHERE id = p_listing_id;
  END IF;

  INSERT INTO public.nft_transactions(item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, currency, payment_method, tx_kind, status)
  VALUES (p_item_id, p_listing_id, v_seller, v_buyer, p_quantity, v_price, v_total, v_royalty, v_item.currency, p_payment_method, v_kind, 'completed')
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_buy_item(uuid,integer,text,uuid) TO authenticated;

-- ============ GIFT FUNCTION ============
CREATE OR REPLACE FUNCTION public.nft_gift_item(
  p_item_id uuid,
  p_recipient_id uuid,
  p_quantity integer,
  p_message text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_gift_id uuid;
  v_item public.nft_items%ROWTYPE;
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF v_sender = p_recipient_id THEN RAISE EXCEPTION 'cannot gift to yourself'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'invalid quantity'; END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_sender AND quantity >= p_quantity) THEN
    RAISE EXCEPTION 'insufficient supply';
  END IF;

  UPDATE public.nft_ownership SET quantity = quantity - p_quantity WHERE item_id = p_item_id AND owner_id = v_sender;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (p_item_id, p_recipient_id, p_quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  INSERT INTO public.nft_gifts(item_id, sender_id, recipient_id, quantity, message, status)
  VALUES (p_item_id, v_sender, p_recipient_id, p_quantity, p_message, 'delivered')
  RETURNING id INTO v_gift_id;

  INSERT INTO public.nft_transactions(item_id, seller_id, buyer_id, quantity, price_each, total, currency, payment_method, tx_kind, status)
  VALUES (p_item_id, v_sender, p_recipient_id, p_quantity, 0, 0, v_item.currency, 'gift', 'gift', 'completed');

  RETURN v_gift_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_gift_item(uuid,uuid,integer,text) TO authenticated;
