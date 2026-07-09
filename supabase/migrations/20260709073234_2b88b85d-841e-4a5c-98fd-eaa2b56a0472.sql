
-- 1) Seed a default flat mint fee if not present (1 OUSD per mint).
INSERT INTO public.openpay_runtime_settings (setting_key, value_json)
VALUES ('nft_mint_fee', jsonb_build_object('enabled', true, 'flat_amount', 1, 'rate', 0, 'currency', 'OUSD', 'collector_user_id', null))
ON CONFLICT (setting_key) DO UPDATE
  SET value_json = jsonb_build_object(
    'enabled', true,
    'flat_amount', COALESCE((public.openpay_runtime_settings.value_json->>'flat_amount')::numeric, 1),
    'rate', COALESCE((public.openpay_runtime_settings.value_json->>'rate')::numeric, 0),
    'currency', COALESCE(public.openpay_runtime_settings.value_json->>'currency', 'OUSD'),
    'collector_user_id', public.openpay_runtime_settings.value_json->>'collector_user_id'
  );

-- 2) Update default fee JSON helper to include flat_amount.
CREATE OR REPLACE FUNCTION public.nft_default_fee_json()
RETURNS jsonb
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object('enabled', false, 'rate', 0, 'flat_amount', 0, 'currency', 'OUSD', 'collector_user_id', null)
$$;

-- 3) Replace nft_mint_item with a paid version supporting payment methods.
DROP FUNCTION IF EXISTS public.nft_mint_item(uuid, text, text, text, text, text, text, integer, numeric, text, jsonb);

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
  p_properties jsonb,
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
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_item_id uuid;
  v_fee_cfg jsonb;
  v_fee_enabled boolean := false;
  v_fee_flat numeric := 0;
  v_fee_rate numeric := 0;
  v_fee_currency text := 'OUSD';
  v_fee_collector uuid;
  v_fee_amount numeric := 0;
  v_base numeric := 0;
  v_category text := 'general';
  v_card_san text;
  v_cvc_san text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be positive'; END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN RAISE EXCEPTION 'name required'; END IF;
  IF p_code IS NULL OR btrim(p_code) = '' THEN RAISE EXCEPTION 'code required'; END IF;
  IF p_payment_method NOT IN ('openpay_balance','pi','virtual_card') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  v_category := COALESCE(NULLIF(p_properties->>'category',''), 'general');

  SELECT public.nft_get_mint_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_flat := COALESCE((v_fee_cfg->>'flat_amount')::numeric, 0);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_fee_currency := COALESCE(NULLIF(v_fee_cfg->>'currency',''), 'OUSD');
  v_fee_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;

  IF v_fee_enabled THEN
    v_fee_amount := v_fee_flat;
    IF v_fee_rate > 0 THEN
      v_base := COALESCE(p_price, 0) * p_quantity;
      IF v_base <= 0 THEN v_base := p_quantity; END IF;
      v_fee_amount := v_fee_amount + round((v_base * v_fee_rate / 100)::numeric, 2);
    END IF;
  END IF;

  IF v_fee_amount > 0 THEN
    IF p_payment_method = 'openpay_balance' THEN
      UPDATE public.wallets
      SET balance = balance - v_fee_amount, updated_at = now()
      WHERE user_id = v_uid AND balance >= v_fee_amount;
      IF NOT FOUND THEN RAISE EXCEPTION 'insufficient OpenPay balance for mint fee (% required)', v_fee_amount; END IF;

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
      UPDATE public.wallets
      SET balance = balance - v_fee_amount, updated_at = now()
      WHERE user_id = v_uid AND balance >= v_fee_amount;
      IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient card balance. Top up your OpenPay wallet.'; END IF;

    ELSIF p_payment_method = 'pi' THEN
      IF p_pi_payment_id IS NULL OR p_pi_txid IS NULL THEN
        RAISE EXCEPTION 'Pi payment requires payment id and txid';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.nft_transactions
        WHERE metadata->>'pi_txid' = p_pi_txid AND status = 'completed'
      ) THEN RAISE EXCEPTION 'Pi transaction already used'; END IF;
    END IF;

    IF v_fee_collector IS NOT NULL AND p_payment_method <> 'pi' THEN
      INSERT INTO public.wallets(user_id, balance)
      VALUES (v_fee_collector, v_fee_amount)
      ON CONFLICT (user_id)
      DO UPDATE SET balance = public.wallets.balance + EXCLUDED.balance, updated_at = now();
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
    v_fee_amount, COALESCE(NULLIF(p_currency,''), 'OUSD'), p_payment_method, 'mint', 'completed',
    jsonb_build_object(
      'mint_fee', v_fee_amount,
      'mint_fee_currency', v_fee_currency,
      'mint_fee_flat', v_fee_flat,
      'mint_fee_rate', v_fee_rate,
      'category', v_category,
      'pi_payment_id', p_pi_payment_id,
      'pi_txid', p_pi_txid,
      'card_last4', CASE WHEN p_payment_method='virtual_card' THEN right(COALESCE(v_card_san,''),4) ELSE NULL END
    )
  );

  RETURN v_item_id;
END $function$;

GRANT EXECUTE ON FUNCTION public.nft_mint_item(uuid, text, text, text, text, text, text, integer, numeric, text, jsonb, text, text, text, integer, integer, text, text) TO authenticated;
