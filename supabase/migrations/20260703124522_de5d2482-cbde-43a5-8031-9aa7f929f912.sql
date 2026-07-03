
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
    SELECT 1 FROM public.nft_auctions a
    WHERE a.item_id = p_item_id AND a.status = 'active' AND a.ends_at > now()
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
        AND COALESCE(is_locked, false) = false
    ) THEN
      RAISE EXCEPTION 'Invalid virtual card details';
    END IF;
    -- Virtual cards are funded from the OpenPay wallet — actually charge it.
    UPDATE public.wallets
    SET balance = balance - v_total, updated_at = now()
    WHERE user_id = v_buyer AND balance >= v_total;
    IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient card balance. Top up your OpenPay wallet.'; END IF;

  ELSIF p_payment_method = 'pi' THEN
    IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
      RAISE EXCEPTION 'Pi payment requires payment id and txid';
    END IF;
    -- Prevent reuse of the same Pi txid for another NFT purchase.
    IF EXISTS (
      SELECT 1 FROM public.nft_transactions
      WHERE metadata->>'pi_txid' = p_pi_txid AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'Pi transaction already used';
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
  v_debit numeric := 0;
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
        AND COALESCE(is_locked, false) = false
    ) THEN
      RAISE EXCEPTION 'Invalid virtual card details';
    END IF;
  ELSIF p_payment_method = 'pi' THEN
    IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
      RAISE EXCEPTION 'Pi payment requires payment id and txid';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.nft_auction_bids
      WHERE metadata->>'pi_txid' = p_pi_txid
    ) THEN
      RAISE EXCEPTION 'Pi transaction already used';
    END IF;
  END IF;

  SELECT public.nft_get_bid_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_fee_amount := round((p_amount * v_fee_rate / 100)::numeric, 2);
  END IF;

  -- openpay_balance and virtual_card both draw from the OpenPay wallet (card is wallet-backed).
  -- Pi funds the bid off-chain, but the bid fee still comes from wallet.
  IF p_payment_method IN ('openpay_balance','virtual_card') THEN
    v_debit := p_amount + v_fee_amount;
  ELSE
    v_debit := v_fee_amount;
  END IF;

  IF v_debit > 0 THEN
    SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
    IF COALESCE(v_wallet_bal, 0) < v_debit THEN
      RAISE EXCEPTION 'insufficient balance (need %)', v_debit;
    END IF;
    UPDATE public.wallets
    SET balance = balance - v_debit, updated_at = now()
    WHERE user_id = v_uid;
  END IF;

  IF v_fee_amount > 0 AND v_fee_collector IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_fee_collector, v_fee_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  -- Refund previous bidder's escrow.
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
