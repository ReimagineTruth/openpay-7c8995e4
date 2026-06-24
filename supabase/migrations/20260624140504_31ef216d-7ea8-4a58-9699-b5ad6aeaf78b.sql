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
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_auction public.nft_auctions%ROWTYPE;
  v_min_required numeric;
  v_bid_id uuid;
  v_wallet_bal numeric;
  v_card_san text;
  v_cvc_san text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT * INTO v_auction FROM public.nft_auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction not found'; END IF;
  IF v_auction.status <> 'active' THEN RAISE EXCEPTION 'auction not active'; END IF;
  IF v_auction.ends_at <= now() THEN RAISE EXCEPTION 'auction ended'; END IF;
  IF v_uid = v_auction.seller_id THEN RAISE EXCEPTION 'cannot bid on your own auction'; END IF;

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

  SELECT balance INTO v_wallet_bal FROM public.wallets WHERE user_id = v_uid;
  IF COALESCE(v_wallet_bal,0) < p_amount THEN RAISE EXCEPTION 'insufficient balance to escrow bid'; END IF;
  UPDATE public.wallets SET balance = balance - p_amount WHERE user_id = v_uid;

  IF v_auction.current_bidder IS NOT NULL AND v_auction.current_bid IS NOT NULL THEN
    INSERT INTO public.wallets(user_id, balance) VALUES (v_auction.current_bidder, v_auction.current_bid)
    ON CONFLICT (user_id) DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance;
  END IF;

  UPDATE public.nft_auctions SET current_bid = p_amount, current_bidder = v_uid WHERE id = p_auction_id;
  INSERT INTO public.nft_auction_bids(auction_id, bidder_id, amount)
  VALUES (p_auction_id, v_uid, p_amount) RETURNING id INTO v_bid_id;

  RETURN v_bid_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.nft_place_bid_with_payment(uuid, numeric, text, text, text, text, text, integer, integer) TO authenticated;