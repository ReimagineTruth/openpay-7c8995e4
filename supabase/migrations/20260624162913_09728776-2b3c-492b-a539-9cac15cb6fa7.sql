
-- Seed default mint fee row
INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
VALUES ('nft_mint_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
ON CONFLICT (setting_key) DO NOTHING;

-- Read mint fee (any authenticated user, mirrors platform fee getter)
CREATE OR REPLACE FUNCTION public.nft_get_mint_fee()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(value_json, jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
  FROM public.openpay_runtime_settings WHERE setting_key = 'nft_mint_fee'
$$;

-- Admin-only setter
CREATE OR REPLACE FUNCTION public.nft_admin_set_mint_fee(p_enabled boolean, p_rate numeric, p_collector uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_val jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_rate < 0 OR p_rate > 50 THEN RAISE EXCEPTION 'rate must be 0..50'; END IF;
  v_val := jsonb_build_object('enabled', p_enabled, 'rate', p_rate, 'collector_user_id', p_collector);
  INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
  VALUES ('nft_mint_fee', v_val)
  ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now();
  RETURN v_val;
END $$;

GRANT EXECUTE ON FUNCTION public.nft_get_mint_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_set_mint_fee(boolean, numeric, uuid) TO authenticated;

-- Update mint to charge the configured fee from creator wallet to collector wallet
CREATE OR REPLACE FUNCTION public.nft_mint_item(
  p_collection_id uuid, p_name text, p_code text, p_description text,
  p_image_url text, p_media_url text, p_media_type text,
  p_quantity integer, p_price numeric, p_currency text, p_properties jsonb
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
  v_base numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;

  -- Load mint fee config
  SELECT value_json INTO v_fee_cfg FROM public.openpay_runtime_settings WHERE setting_key = 'nft_mint_fee';
  IF v_fee_cfg IS NOT NULL THEN
    v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
    v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
    v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  END IF;

  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_base := COALESCE(p_price,0) * p_quantity;
    -- If listing price is 0, fall back to a flat per-quantity unit so the fee is meaningful
    IF v_base <= 0 THEN v_base := p_quantity; END IF;
    v_fee_amount := round((v_base * v_fee_rate / 100)::numeric, 2);

    IF v_fee_amount > 0 THEN
      -- Debit creator
      UPDATE public.wallets SET balance = balance - v_fee_amount WHERE user_id = v_uid AND balance >= v_fee_amount;
      IF NOT FOUND THEN RAISE EXCEPTION 'insufficient OpenPay balance for mint fee (% required)', v_fee_amount; END IF;
      -- Credit collector
      IF v_fee_collector IS NOT NULL THEN
        UPDATE public.wallets SET balance = balance + v_fee_amount WHERE user_id = v_fee_collector;
        IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_fee_collector, v_fee_amount); END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.nft_items(collection_id, creator_id, name, code, description, image_url, media_url, media_type, quantity_total, quantity_minted, price, currency, properties)
  VALUES (p_collection_id, v_uid, p_name, p_code, p_description, p_image_url, COALESCE(p_media_url, p_image_url), COALESCE(p_media_type,'image'), p_quantity, p_quantity, COALESCE(p_price,0), COALESCE(p_currency,'OUSD'), COALESCE(p_properties,'{}'::jsonb))
  RETURNING id INTO v_item_id;

  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (v_item_id, v_uid, p_quantity)
  ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  INSERT INTO public.nft_transactions(item_id, seller_id, buyer_id, quantity, price_each, total, platform_fee, currency, payment_method, tx_kind, status)
  VALUES (v_item_id, NULL, v_uid, p_quantity, COALESCE(p_price,0), 0, v_fee_amount, COALESCE(p_currency,'OUSD'), 'openpay_balance', 'mint', 'completed');

  RETURN v_item_id;
END $$;

-- Update finalize_auction so the item's price becomes the winning bid (per unit)
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
  IF v_auction.current_bidder IS NULL OR v_auction.current_bid IS NULL THEN
    UPDATE public.nft_auctions SET status='cancelled' WHERE id = p_auction_id;
    RETURN NULL;
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = v_auction.item_id;
  v_kind := CASE WHEN v_auction.seller_id = v_item.creator_id THEN 'primary_sale' ELSE 'resale' END;

  SELECT COALESCE((properties->>'royalty_pct')::numeric, 0) INTO v_creator_royalty_pct FROM public.nft_items WHERE id = v_item.id;

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

  UPDATE public.nft_ownership SET quantity = quantity - v_auction.quantity WHERE item_id = v_item.id AND owner_id = v_auction.seller_id;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (v_item.id, v_auction.current_bidder, v_auction.quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  INSERT INTO public.nft_transactions(item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, currency, payment_method, tx_kind, status)
  VALUES (v_item.id, v_auction.seller_id, v_auction.current_bidder, v_auction.quantity, v_auction.current_bid/v_auction.quantity, v_auction.current_bid, v_royalty, v_item.currency, 'openpay_balance', v_kind, 'completed')
  RETURNING id INTO v_tx_id;

  -- NEW: Bump the item's base price to the winning per-unit bid so resales start from this value.
  v_new_unit_price := round((v_auction.current_bid / NULLIF(v_auction.quantity,0))::numeric, 2);
  IF v_new_unit_price IS NOT NULL AND v_new_unit_price > COALESCE(v_item.price, 0) THEN
    UPDATE public.nft_items SET price = v_new_unit_price WHERE id = v_item.id;
  END IF;

  UPDATE public.nft_auctions SET status = 'settled', winner_id = v_auction.current_bidder WHERE id = p_auction_id;
  RETURN v_tx_id;
END $$;
