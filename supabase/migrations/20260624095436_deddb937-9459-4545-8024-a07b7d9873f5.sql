
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
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  v_buyer_balance numeric;
  v_wallet_tx_id uuid;
  v_meta jsonb;
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
    SELECT * INTO v_listing FROM public.nft_listings WHERE id = p_listing_id AND status='active' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'listing not available'; END IF;
    IF v_listing.item_id <> p_item_id THEN RAISE EXCEPTION 'listing mismatch'; END IF;
    IF v_listing.quantity < p_quantity THEN RAISE EXCEPTION 'not enough listed'; END IF;
    v_seller := v_listing.seller_id;
    v_price := v_listing.price;
    v_kind := 'resale';
  ELSE
    v_seller := v_item.creator_id;
    v_price := v_item.price;
    v_kind := 'sale';
  END IF;

  IF v_buyer = v_seller THEN RAISE EXCEPTION 'cannot buy from yourself'; END IF;
  v_total := v_price * p_quantity;

  IF NOT EXISTS (SELECT 1 FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_seller AND quantity >= p_quantity) THEN
    RAISE EXCEPTION 'seller has insufficient supply';
  END IF;

  -- Platform fee
  SELECT public.nft_get_platform_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_platform_fee := round((v_total * v_fee_rate / 100)::numeric, 2);
  END IF;

  -- Royalty (only on resale)
  IF v_kind = 'resale' AND v_creator IS NOT NULL AND v_creator <> v_seller AND v_creator_royalty_pct > 0 THEN
    v_royalty := round((v_total * v_creator_royalty_pct / 100)::numeric, 2);
  END IF;
  v_seller_net := v_total - v_royalty - v_platform_fee;

  -- Validate virtual card
  IF p_payment_method = 'virtual_card' THEN
    v_card_san := regexp_replace(COALESCE(p_card_number,''), '\D', '', 'g');
    v_cvc_san := regexp_replace(COALESCE(p_card_cvc,''), '\D', '', 'g');
    IF char_length(v_card_san) <> 16 THEN RAISE EXCEPTION 'Card number must be 16 digits'; END IF;
    IF char_length(v_cvc_san) <> 3 THEN RAISE EXCEPTION 'Invalid CVC'; END IF;
    IF p_card_exp_month IS NULL OR p_card_exp_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Invalid expiry month'; END IF;
    IF p_card_exp_year IS NULL OR p_card_exp_year < EXTRACT(year FROM now())::int THEN RAISE EXCEPTION 'Invalid expiry year'; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.virtual_cards
      WHERE user_id = v_buyer AND card_number = v_card_san AND cvc = v_cvc_san
        AND expiry_month = p_card_exp_month AND expiry_year = p_card_exp_year
        AND is_active = true
    ) THEN RAISE EXCEPTION 'Invalid virtual card details'; END IF;
  END IF;

  -- Pi must include payment id
  IF p_payment_method = 'pi' THEN
    IF COALESCE(p_pi_payment_id,'') = '' OR COALESCE(p_pi_txid,'') = '' THEN
      RAISE EXCEPTION 'Pi payment not confirmed';
    END IF;
  END IF;

  -- Settlement for OpenPay balance & Virtual card: debit buyer, credit seller/creator/collector
  IF p_payment_method IN ('openpay_balance','virtual_card') THEN
    SELECT balance INTO v_buyer_balance FROM public.wallets WHERE user_id = v_buyer FOR UPDATE;
    IF v_buyer_balance IS NULL THEN RAISE EXCEPTION 'wallet not found'; END IF;
    IF v_buyer_balance < v_total THEN RAISE EXCEPTION 'insufficient balance'; END IF;

    UPDATE public.wallets SET balance = balance - v_total, updated_at = now() WHERE user_id = v_buyer;

    IF v_royalty > 0 THEN
      UPDATE public.wallets SET balance = balance + v_royalty, updated_at = now() WHERE user_id = v_creator;
      IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_creator, v_royalty); END IF;
      INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
        VALUES (v_creator, p_item_id, v_royalty, v_item.currency, 'royalty');
    END IF;

    IF v_platform_fee > 0 AND v_collector IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance + v_platform_fee, updated_at = now() WHERE user_id = v_collector;
      IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_collector, v_platform_fee); END IF;
    END IF;

    UPDATE public.wallets SET balance = balance + v_seller_net, updated_at = now() WHERE user_id = v_seller;
    IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_seller, v_seller_net); END IF;

    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
      VALUES (v_seller, p_item_id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);
  ELSE
    -- Pi paid externally; still log seller earnings for reporting
    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
      VALUES (v_seller, p_item_id, v_seller_net, 'PI', CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);
  END IF;

  -- Ownership transfer
  UPDATE public.nft_ownership SET quantity = quantity - p_quantity WHERE item_id = p_item_id AND owner_id = v_seller;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (p_item_id, v_buyer, p_quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  IF p_listing_id IS NOT NULL THEN
    UPDATE public.nft_listings SET quantity = quantity - p_quantity,
      status = CASE WHEN quantity - p_quantity <= 0 THEN 'sold' ELSE status END
      WHERE id = p_listing_id;
  END IF;

  v_meta := jsonb_build_object(
    'platform_fee', v_platform_fee,
    'platform_fee_rate', v_fee_rate,
    'pi_payment_id', p_pi_payment_id,
    'pi_txid', p_pi_txid,
    'card_last4', CASE WHEN p_payment_method='virtual_card' THEN right(v_card_san, 4) ELSE NULL END
  );

  INSERT INTO public.nft_transactions(item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, currency, payment_method, tx_kind, status, metadata)
  VALUES (p_item_id, p_listing_id, v_seller, v_buyer, p_quantity, v_price, v_total, v_royalty, v_item.currency, p_payment_method, v_kind, 'completed', v_meta)
  RETURNING id INTO v_tx_id;

  -- Mirror to wallet transactions so it appears in dashboard activity & ledger (only for OpenPay-settled flows)
  IF p_payment_method IN ('openpay_balance','virtual_card') THEN
    INSERT INTO public.transactions(sender_id, receiver_id, amount, note, status)
    VALUES (v_buyer, v_seller, v_total,
      CONCAT('NFT ', v_kind, ' · ', v_item.name, ' x', p_quantity,
        CASE WHEN p_payment_method='virtual_card' THEN ' · card' ELSE '' END,
        ' · ref ', v_tx_id::text), 'completed')
    RETURNING id INTO v_wallet_tx_id;
  END IF;

  -- Always log an admin ledger event for transparency
  INSERT INTO public.ledger_events(source_table, source_id, event_type, actor_user_id, related_user_id, amount, status, note, payload)
  VALUES ('nft_transactions', v_tx_id,
    CASE WHEN v_kind='resale' THEN 'nft_resale' ELSE 'nft_primary_sale' END,
    v_buyer, v_seller, v_total, 'completed',
    CONCAT('NFT ', v_item.name, ' x', p_quantity, ' · ', p_payment_method),
    jsonb_build_object(
      'item_id', p_item_id, 'item_name', v_item.name, 'currency', v_item.currency,
      'payment_method', p_payment_method, 'royalty', v_royalty, 'platform_fee', v_platform_fee,
      'pi_payment_id', p_pi_payment_id, 'pi_txid', p_pi_txid,
      'wallet_transaction_id', v_wallet_tx_id, 'listing_id', p_listing_id
    ));

  RETURN v_tx_id;
END $function$;
