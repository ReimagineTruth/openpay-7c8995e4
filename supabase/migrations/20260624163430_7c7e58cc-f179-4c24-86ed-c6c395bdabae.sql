
INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
VALUES ('nft_bid_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.nft_get_bid_fee()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(value_json, jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
  FROM public.openpay_runtime_settings WHERE setting_key = 'nft_bid_fee'
$$;

CREATE OR REPLACE FUNCTION public.nft_admin_set_bid_fee(p_enabled boolean, p_rate numeric, p_collector uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_val jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_rate < 0 OR p_rate > 50 THEN RAISE EXCEPTION 'rate must be 0..50'; END IF;
  v_val := jsonb_build_object('enabled', p_enabled, 'rate', p_rate, 'collector_user_id', p_collector);
  INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
  VALUES ('nft_bid_fee', v_val)
  ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now();
  RETURN v_val;
END $$;

GRANT EXECUTE ON FUNCTION public.nft_get_bid_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_set_bid_fee(boolean, numeric, uuid) TO authenticated;

-- Update bid function to deduct an admin-controlled bid fee
CREATE OR REPLACE FUNCTION public.nft_place_bid_with_payment(
  p_auction_id uuid, p_amount numeric,
  p_payment_method text DEFAULT 'openpay_balance',
  p_pi_payment_id text DEFAULT NULL, p_pi_txid text DEFAULT NULL,
  p_card_number text DEFAULT NULL, p_card_cvc text DEFAULT NULL,
  p_card_exp_month integer DEFAULT NULL, p_card_exp_year integer DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
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
      WHERE user_id = v_uid AND card_number = v_card_san AND cvc = v_cvc_san
        AND expiry_month = p_card_exp_month AND expiry_year = p_card_exp_year
        AND is_active = true
    ) THEN RAISE EXCEPTION 'Invalid virtual card details'; END IF;

    INSERT INTO public.wallets(user_id, balance) VALUES (v_uid, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;

  ELSIF p_payment_method = 'pi' THEN
    IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
      RAISE EXCEPTION 'Pi payment requires payment id and txid';
    END IF;
    INSERT INTO public.wallets(user_id, balance) VALUES (v_uid, p_amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;
  END IF;

  -- Load bid fee config and compute non-refundable fee
  SELECT value_json INTO v_fee_cfg FROM public.openpay_runtime_settings WHERE setting_key = 'nft_bid_fee';
  IF v_fee_cfg IS NOT NULL THEN
    v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
    v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
    v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  END IF;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_fee_amount := round((p_amount * v_fee_rate / 100)::numeric, 2);
  END IF;

  SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid;
  IF COALESCE(v_wallet_bal,0) < (p_amount + v_fee_amount) THEN
    RAISE EXCEPTION 'insufficient balance to escrow bid and fee (need %)', (p_amount + v_fee_amount);
  END IF;

  -- Escrow the bid
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = v_uid;

  -- Deduct + credit the bid fee (non-refundable)
  IF v_fee_amount > 0 THEN
    UPDATE public.wallets SET balance = balance - v_fee_amount WHERE user_id = v_uid;
    IF v_fee_collector IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance + v_fee_amount WHERE user_id = v_fee_collector;
      IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_fee_collector, v_fee_amount); END IF;
    END IF;
  END IF;

  -- Refund previous bidder
  IF v_auction.current_bidder IS NOT NULL AND v_auction.current_bid IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance) VALUES (v_auction.current_bidder, v_auction.current_bid)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;
  END IF;

  UPDATE public.nft_auctions SET current_bid = p_amount, current_bidder = v_uid WHERE id = p_auction_id;
  INSERT INTO public.nft_auction_bids(auction_id, bidder_id, amount)
  VALUES (p_auction_id, v_uid, p_amount) RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
END $$;
