
DROP FUNCTION IF EXISTS public.nft_create_auction(uuid, integer, numeric, numeric, integer);

CREATE OR REPLACE FUNCTION public.nft_create_auction(
  p_item_id uuid,
  p_quantity integer,
  p_start_price numeric,
  p_min_increment numeric,
  p_duration_hours integer,
  p_payment_method text DEFAULT 'openpay_balance',
  p_card_number text DEFAULT NULL,
  p_card_cvc text DEFAULT NULL,
  p_card_exp_month integer DEFAULT NULL,
  p_card_exp_year integer DEFAULT NULL,
  p_pi_payment_id text DEFAULT NULL,
  p_pi_txid text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owned integer;
  v_id uuid;
  v_item public.nft_items%ROWTYPE;
  v_fee_cfg jsonb;
  v_fee_enabled boolean := false;
  v_fee_flat numeric := 0;
  v_fee_rate numeric := 0;
  v_fee_currency text := 'OUSD';
  v_fee_collector uuid;
  v_fee_amount numeric := 0;
  v_base numeric := 0;
  v_card_san text;
  v_cvc_san text;
  v_current_balance numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity <= 0 OR p_start_price < 0 OR p_min_increment <= 0 OR p_duration_hours <= 0 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  SELECT * INTO v_item FROM public.nft_items WHERE id = p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'item not found'; END IF;

  SELECT quantity INTO v_owned FROM public.nft_ownership WHERE item_id = p_item_id AND owner_id = v_uid;
  IF COALESCE(v_owned,0) < p_quantity THEN RAISE EXCEPTION 'not enough owned'; END IF;

  -- Auction start fee mirrors the mint fee config (same percentage)
  SELECT public.nft_get_mint_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_flat := COALESCE((v_fee_cfg->>'flat_amount')::numeric, 0);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_fee_currency := COALESCE(NULLIF(v_fee_cfg->>'currency',''), 'OUSD');
  v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;

  IF v_fee_enabled THEN
    v_fee_amount := v_fee_flat;
    IF v_fee_rate > 0 THEN
      v_base := COALESCE(p_start_price, 0) * p_quantity;
      IF v_base <= 0 THEN v_base := p_quantity; END IF;
      v_fee_amount := v_fee_amount + round((v_base * v_fee_rate / 100)::numeric, 2);
    END IF;
  END IF;

  IF v_fee_amount > 0 THEN
    IF p_payment_method = 'openpay_balance' THEN
      SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
      IF v_current_balance IS NULL OR v_current_balance < v_fee_amount THEN
        RAISE EXCEPTION 'Insufficient OpenPay balance. Need % % but have %',
          v_fee_amount, v_fee_currency, COALESCE(v_current_balance, 0);
      END IF;
      UPDATE public.wallets SET balance = balance - v_fee_amount, updated_at = now() WHERE user_id = v_uid;

    ELSIF p_payment_method = 'virtual_card' THEN
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
          AND is_active = true AND COALESCE(is_locked, false) = false
      ) THEN RAISE EXCEPTION 'Invalid virtual card details'; END IF;
      SELECT balance INTO v_current_balance FROM public.wallets WHERE user_id = v_uid FOR UPDATE;
      IF v_current_balance IS NULL OR v_current_balance < v_fee_amount THEN
        RAISE EXCEPTION 'Insufficient card balance. Need % % but have %. Top up your wallet.',
          v_fee_amount, v_fee_currency, COALESCE(v_current_balance, 0);
      END IF;
      UPDATE public.wallets SET balance = balance - v_fee_amount, updated_at = now() WHERE user_id = v_uid;

    ELSIF p_payment_method = 'pi' THEN
      IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL
         OR btrim(p_pi_payment_id) = '' OR btrim(p_pi_txid) = '' THEN
        RAISE EXCEPTION 'Pi payment required: complete the Pi transaction before starting the auction';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.nft_transactions
        WHERE metadata->>'pi_txid' = p_pi_txid AND status = 'completed'
      ) THEN RAISE EXCEPTION 'Pi transaction already used'; END IF;
    END IF;

    IF v_fee_collector IS NOT NULL AND v_fee_collector <> v_uid AND p_payment_method <> 'pi' THEN
      INSERT INTO public.wallets(user_id, balance)
      VALUES (v_fee_collector, v_fee_amount)
      ON CONFLICT (user_id)
      DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();

      BEGIN
        INSERT INTO public.transactions(sender_id, receiver_id, amount, note, status)
        VALUES (v_uid, v_fee_collector, v_fee_amount,
                'NFT auction start fee: ' || btrim(v_item.name), 'completed');
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  INSERT INTO public.nft_auctions(item_id, seller_id, quantity, start_price, min_increment, currency, ends_at)
  VALUES (p_item_id, v_uid, p_quantity, p_start_price, p_min_increment, v_item.currency, now() + (p_duration_hours || ' hours')::interval)
  RETURNING id INTO v_id;

  IF v_fee_amount > 0 THEN
    INSERT INTO public.nft_transactions(
      item_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount,
      platform_fee, currency, payment_method, tx_kind, status, metadata
    )
    VALUES (
      p_item_id, v_uid, NULL, p_quantity, COALESCE(p_start_price, 0), v_fee_amount, 0,
      v_fee_amount, COALESCE(NULLIF(v_fee_currency,''), 'OUSD'), p_payment_method, 'auction_start', 'completed',
      jsonb_build_object(
        'auction_id', v_id,
        'auction_start_fee', v_fee_amount,
        'fee_currency', v_fee_currency,
        'fee_flat', v_fee_flat,
        'fee_rate', v_fee_rate,
        'pi_payment_id', p_pi_payment_id,
        'pi_txid', p_pi_txid,
        'card_last4', CASE WHEN p_payment_method='virtual_card' THEN right(COALESCE(v_card_san,''),4) ELSE NULL END
      )
    );
  END IF;

  RETURN v_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.nft_create_auction(uuid, integer, numeric, numeric, integer, text, text, text, integer, integer, text, text) TO authenticated;
