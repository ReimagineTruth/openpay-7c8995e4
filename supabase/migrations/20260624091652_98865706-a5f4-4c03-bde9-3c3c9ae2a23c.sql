
-- ============ AUCTIONS ============
CREATE TABLE public.nft_auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.nft_items(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  start_price numeric NOT NULL CHECK (start_price >= 0),
  min_increment numeric NOT NULL DEFAULT 1 CHECK (min_increment > 0),
  current_bid numeric,
  current_bidder uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'OUSD',
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','cancelled','settled')),
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nft_auctions TO authenticated;
GRANT ALL ON public.nft_auctions TO service_role;
ALTER TABLE public.nft_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_auctions_select_all" ON public.nft_auctions FOR SELECT TO authenticated USING (true);
CREATE INDEX nft_auctions_item_idx ON public.nft_auctions(item_id);
CREATE INDEX nft_auctions_status_idx ON public.nft_auctions(status);

CREATE TRIGGER trg_nft_auctions_touch BEFORE UPDATE ON public.nft_auctions FOR EACH ROW EXECUTE FUNCTION public.nft_touch_updated_at();

CREATE TABLE public.nft_auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.nft_auctions(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.nft_auction_bids TO authenticated;
GRANT ALL ON public.nft_auction_bids TO service_role;
ALTER TABLE public.nft_auction_bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nft_auction_bids_select_all" ON public.nft_auction_bids FOR SELECT TO authenticated USING (true);
CREATE INDEX nft_auction_bids_auction_idx ON public.nft_auction_bids(auction_id);

-- ============ LISTING RPCS ============
CREATE OR REPLACE FUNCTION public.nft_create_listing(p_item_id uuid, p_price numeric, p_quantity integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_owned integer; v_id uuid; v_item public.nft_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 OR p_price < 0 THEN RAISE EXCEPTION 'invalid input'; END IF;
  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT quantity INTO v_owned FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_uid;
  IF COALESCE(v_owned,0) < p_quantity THEN RAISE EXCEPTION 'not enough owned'; END IF;
  INSERT INTO public.nft_listings(item_id, seller_id, price, quantity, currency, status)
  VALUES (p_item_id, v_uid, p_price, p_quantity, v_item.currency, 'active') RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_create_listing(uuid,numeric,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_create_listing(uuid,numeric,integer) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.nft_update_listing_price(p_listing_id uuid, p_new_price numeric)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_new_price < 0 THEN RAISE EXCEPTION 'invalid price'; END IF;
  UPDATE public.nft_listings SET price = p_new_price
  WHERE id = p_listing_id AND seller_id = v_uid AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found or not yours'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_update_listing_price(uuid,numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_update_listing_price(uuid,numeric) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.nft_cancel_listing(p_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.nft_listings SET status = 'cancelled'
  WHERE id = p_listing_id AND seller_id = v_uid AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'listing not found or not yours'; END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_cancel_listing(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_cancel_listing(uuid) FROM PUBLIC, anon;

-- ============ AUCTION RPCS ============
CREATE OR REPLACE FUNCTION public.nft_create_auction(
  p_item_id uuid, p_quantity integer, p_start_price numeric, p_min_increment numeric, p_duration_hours integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_owned integer; v_id uuid; v_item public.nft_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 OR p_start_price < 0 OR p_min_increment <= 0 OR p_duration_hours <= 0 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;
  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;
  SELECT quantity INTO v_owned FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_uid;
  IF COALESCE(v_owned,0) < p_quantity THEN RAISE EXCEPTION 'not enough owned'; END IF;

  INSERT INTO public.nft_auctions(item_id, seller_id, quantity, start_price, min_increment, currency, ends_at)
  VALUES (p_item_id, v_uid, p_quantity, p_start_price, p_min_increment, v_item.currency, now() + (p_duration_hours || ' hours')::interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_create_auction(uuid,integer,numeric,numeric,integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_create_auction(uuid,integer,numeric,numeric,integer) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.nft_place_bid(p_auction_id uuid, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auction public.nft_auctions%ROWTYPE;
  v_min_required numeric;
  v_bid_id uuid;
  v_wallet_bal numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction not active'; END IF;
  IF v_auction.ends_at <= now() THEN RAISE EXCEPTION 'auction ended'; END IF;
  IF v_uid = v_auction.seller_id THEN RAISE EXCEPTION 'cannot bid on your own auction'; END IF;

  v_min_required := COALESCE(v_auction.current_bid, v_auction.start_price) + CASE WHEN v_auction.current_bid IS NULL THEN 0 ELSE v_auction.min_increment END;
  IF p_amount < v_min_required THEN RAISE EXCEPTION 'bid too low (min %)', v_min_required; END IF;

  -- escrow buyer funds
  SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid;
  IF COALESCE(v_wallet_bal,0) < p_amount THEN RAISE EXCEPTION 'insufficient balance to escrow bid'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = v_uid;

  -- refund previous bidder
  IF v_auction.current_bidder IS NOT NULL AND v_auction.current_bid IS NOT NULL THEN
    UPDATE public.wallets SET balance = balance + v_auction.current_bid WHERE user_id = v_auction.current_bidder;
    IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_auction.current_bidder, v_auction.current_bid); END IF;
  END IF;

  UPDATE public.nft_auctions SET current_bid = p_amount, current_bidder = v_uid WHERE id = p_auction_id;
  INSERT INTO public.nft_auction_bids(auction_id, bidder_id, amount) VALUES (p_auction_id, v_uid, p_amount) RETURNING id INTO v_bid_id;
  RETURN v_bid_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_place_bid(uuid,numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_place_bid(uuid,numeric) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.nft_finalize_auction(p_auction_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_auction public.nft_auctions%ROWTYPE;
  v_item public.nft_items%ROWTYPE;
  v_royalty numeric := 0;
  v_seller_net numeric;
  v_tx_id uuid;
  v_creator_royalty_pct numeric := 0;
  v_kind text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction not active'; END IF;
  IF v_auction.ends_at > now() THEN RAISE EXCEPTION 'auction still running'; END IF;
  IF v_uid <> v_auction.seller_id AND v_uid <> COALESCE(v_auction.current_bidder, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'only seller or winning bidder can finalize';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = v_auction.item_id;
  v_kind := CASE WHEN v_auction.seller_id = v_item.creator_id THEN 'sale' ELSE 'resale' END;

  IF v_auction.current_bidder IS NULL OR v_auction.current_bid IS NULL THEN
    UPDATE public.nft_auctions SET status = 'ended' WHERE id = p_auction_id;
    RETURN NULL;
  END IF;

  IF v_item.collection_id IS NOT NULL THEN
    SELECT royalty_pct INTO v_creator_royalty_pct FROM public.nft_collections WHERE id = v_item.collection_id;
  END IF;
  v_creator_royalty_pct := COALESCE(v_creator_royalty_pct, 0);

  -- royalty (only on resale)
  IF v_kind = 'resale' AND v_item.creator_id <> v_auction.seller_id AND v_creator_royalty_pct > 0 THEN
    v_royalty := round((v_auction.current_bid * v_creator_royalty_pct / 100)::numeric, 2);
    UPDATE public.wallets SET balance = balance + v_royalty WHERE user_id = v_item.creator_id;
    IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_item.creator_id, v_royalty); END IF;
    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
      VALUES (v_item.creator_id, v_item.id, v_royalty, v_item.currency, 'royalty');
  END IF;

  v_seller_net := v_auction.current_bid - v_royalty;
  UPDATE public.wallets SET balance = balance + v_seller_net WHERE user_id = v_auction.seller_id;
  IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_auction.seller_id, v_seller_net); END IF;
  INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
    VALUES (v_auction.seller_id, v_item.id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);

  -- transfer ownership
  UPDATE public.nft_ownership SET quantity = quantity - v_auction.quantity WHERE item_id = v_item.id AND owner_id = v_auction.seller_id;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (v_item.id, v_auction.current_bidder, v_auction.quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  INSERT INTO public.nft_transactions(item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, currency, payment_method, tx_kind, status)
  VALUES (v_item.id, v_auction.seller_id, v_auction.current_bidder, v_auction.quantity, v_auction.current_bid/v_auction.quantity, v_auction.current_bid, v_royalty, v_item.currency, 'openpay_balance', v_kind, 'completed')
  RETURNING id INTO v_tx_id;

  UPDATE public.nft_auctions SET status = 'settled', winner_id = v_auction.current_bidder WHERE id = p_auction_id;
  RETURN v_tx_id;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.nft_cancel_auction(p_auction_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_auction public.nft_auctions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.seller_id <> v_uid THEN RAISE EXCEPTION 'not your auction'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'cannot cancel'; END IF;
  IF v_auction.current_bid IS NOT NULL THEN RAISE EXCEPTION 'cannot cancel after bid'; END IF;
  UPDATE public.nft_auctions SET status = 'cancelled' WHERE id = p_auction_id;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.nft_cancel_auction(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_cancel_auction(uuid) FROM PUBLIC, anon;
