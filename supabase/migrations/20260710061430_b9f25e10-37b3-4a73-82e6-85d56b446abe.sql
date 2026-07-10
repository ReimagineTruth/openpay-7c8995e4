
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
  v_platform_fee numeric := 0;
  v_seller_net numeric;
  v_tx_id uuid;
  v_creator_royalty_pct numeric := 0;
  v_kind text;
  v_new_unit_price numeric;
  v_fee_cfg jsonb;
  v_fee_enabled boolean := false;
  v_fee_rate numeric := 0;
  v_collector uuid;
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

  -- Compute and collect the platform (auction) fee from the winning bid
  SELECT public.nft_get_platform_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_platform_fee := round((v_auction.current_bid * v_fee_rate / 100)::numeric, 2);
  END IF;

  IF v_platform_fee > 0 AND v_collector IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance)
    VALUES (v_collector, v_platform_fee)
    ON CONFLICT (user_id)
    DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
  END IF;

  v_seller_net := v_auction.current_bid - v_royalty - v_platform_fee;
  IF v_seller_net < 0 THEN v_seller_net := 0; END IF;

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
    v_new_unit_price, v_auction.current_bid, v_royalty, v_platform_fee, v_item.currency,
    'openpay_balance', v_kind, 'completed',
    jsonb_build_object(
      'auction_id', p_auction_id,
      'settled_price_each', v_new_unit_price,
      'platform_fee', v_platform_fee,
      'platform_fee_rate', v_fee_rate,
      'seller_net', v_seller_net
    )
  )
  RETURNING id INTO v_tx_id;

  IF v_new_unit_price IS NOT NULL AND v_new_unit_price > COALESCE(v_item.price, 0) THEN
    UPDATE public.nft_items SET price = v_new_unit_price, updated_at = now() WHERE id = v_item.id;
  END IF;

  UPDATE public.nft_transactions
  SET status = 'completed', tx_kind = 'auction_settle',
      metadata = metadata || jsonb_build_object('settlement_tx_id', v_tx_id)
  WHERE item_id = v_item.id
    AND buyer_id = v_auction.current_bidder
    AND tx_kind = 'bid'
    AND status = 'pending';

  UPDATE public.nft_auctions
  SET status = 'settled', winner_id = v_auction.current_bidder, updated_at = now()
  WHERE id = p_auction_id;

  RETURN v_tx_id;
END $$;

GRANT EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.nft_finalize_auction(uuid) FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';
