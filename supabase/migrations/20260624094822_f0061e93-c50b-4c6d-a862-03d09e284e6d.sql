
CREATE OR REPLACE FUNCTION public.is_nft_admin(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v boolean;
BEGIN
  -- Reuse openpay core admin (no-arg, checks auth.uid())
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN false;
  END IF;
  SELECT public.is_openpay_core_admin() INTO v;
  RETURN COALESCE(v, false);
END $$;

INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
VALUES ('nft_platform_fee', jsonb_build_object('enabled', false, 'rate', 0, 'collector_user_id', null))
ON CONFLICT (setting_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.nft_get_platform_fee()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(value_json, '{}'::jsonb) FROM public.openpay_runtime_settings WHERE setting_key='nft_platform_fee';
$$;

CREATE OR REPLACE FUNCTION public.nft_admin_set_platform_fee(p_enabled boolean, p_rate numeric, p_collector uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_val jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF p_rate < 0 OR p_rate > 50 THEN RAISE EXCEPTION 'rate must be 0..50'; END IF;
  v_val := jsonb_build_object('enabled', p_enabled, 'rate', p_rate, 'collector_user_id', p_collector);
  INSERT INTO public.openpay_runtime_settings(setting_key, value_json)
  VALUES ('nft_platform_fee', v_val)
  ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now();
  RETURN v_val;
END $$;

ALTER TABLE public.nft_transactions ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.nft_admin_remove_item(p_item_id uuid, p_reason text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.nft_items SET is_active = false WHERE id = p_item_id;
  UPDATE public.nft_listings SET status = 'cancelled' WHERE item_id = p_item_id AND status = 'active';
  UPDATE public.nft_auctions SET status = 'cancelled' WHERE item_id = p_item_id AND status = 'active';
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.nft_admin_restore_item(p_item_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.nft_items SET is_active = true WHERE id = p_item_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.nft_admin_metrics()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT jsonb_build_object(
    'total_items', (SELECT count(*) FROM public.nft_items),
    'active_items', (SELECT count(*) FROM public.nft_items WHERE is_active),
    'removed_items', (SELECT count(*) FROM public.nft_items WHERE NOT is_active),
    'total_collections', (SELECT count(*) FROM public.nft_collections),
    'total_owners', (SELECT count(DISTINCT owner_id) FROM public.nft_ownership WHERE quantity>0),
    'total_sales', (SELECT count(*) FROM public.nft_transactions WHERE tx_kind IN ('sale','resale','primary_sale')),
    'sales_volume', (SELECT COALESCE(SUM(total),0) FROM public.nft_transactions WHERE tx_kind IN ('sale','resale','primary_sale') AND status='completed'),
    'royalty_paid', (SELECT COALESCE(SUM(royalty_amount),0) FROM public.nft_transactions WHERE status='completed'),
    'platform_fees', (SELECT COALESCE(SUM((metadata->>'platform_fee')::numeric),0) FROM public.nft_transactions WHERE status='completed' AND metadata ? 'platform_fee'),
    'active_listings', (SELECT count(*) FROM public.nft_listings WHERE status='active'),
    'active_auctions', (SELECT count(*) FROM public.nft_auctions WHERE status='active'),
    'sales_24h', (SELECT COALESCE(SUM(total),0) FROM public.nft_transactions WHERE created_at > now() - interval '24 hours' AND status='completed' AND tx_kind IN ('sale','resale','primary_sale')),
    'sales_7d', (SELECT COALESCE(SUM(total),0) FROM public.nft_transactions WHERE created_at > now() - interval '7 days' AND status='completed' AND tx_kind IN ('sale','resale','primary_sale')),
    'sales_30d', (SELECT COALESCE(SUM(total),0) FROM public.nft_transactions WHERE created_at > now() - interval '30 days' AND status='completed' AND tx_kind IN ('sale','resale','primary_sale'))
  ) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.nft_admin_list_items(p_limit int DEFAULT 200, p_search text DEFAULT NULL)
RETURNS TABLE(
  id uuid, name text, code text, image_url text, creator_id uuid, creator_email text,
  price numeric, currency text, quantity_total int, is_active boolean,
  owners_count bigint, sold_count numeric, sales_volume numeric, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT i.id, i.name, i.code, i.image_url, i.creator_id,
    (SELECT email::text FROM auth.users u WHERE u.id = i.creator_id) AS creator_email,
    i.price, i.currency, i.quantity_total, i.is_active,
    (SELECT count(*) FROM public.nft_ownership o WHERE o.item_id = i.id AND o.quantity>0)::bigint,
    (SELECT COALESCE(SUM(t.quantity),0)::numeric FROM public.nft_transactions t WHERE t.item_id = i.id AND t.tx_kind IN ('sale','resale','primary_sale') AND t.status='completed'),
    (SELECT COALESCE(SUM(t.total),0)::numeric FROM public.nft_transactions t WHERE t.item_id = i.id AND t.tx_kind IN ('sale','resale','primary_sale') AND t.status='completed'),
    i.created_at
  FROM public.nft_items i
  WHERE p_search IS NULL OR i.name ILIKE '%'||p_search||'%' OR i.code ILIKE '%'||p_search||'%'
  ORDER BY i.created_at DESC
  LIMIT p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.nft_admin_recent_activity(p_limit int DEFAULT 100)
RETURNS TABLE(
  id uuid, item_id uuid, item_name text, seller_id uuid, buyer_id uuid,
  quantity int, total numeric, currency text, payment_method text, tx_kind text,
  status text, royalty_amount numeric, platform_fee numeric, created_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_nft_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
  SELECT t.id, t.item_id, i.name, t.seller_id, t.buyer_id,
    t.quantity, t.total, t.currency, t.payment_method, t.tx_kind, t.status,
    COALESCE(t.royalty_amount,0),
    COALESCE((t.metadata->>'platform_fee')::numeric, 0),
    t.created_at
  FROM public.nft_transactions t
  LEFT JOIN public.nft_items i ON i.id = t.item_id
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END $$;

CREATE OR REPLACE FUNCTION public.nft_buy_item(p_item_id uuid, p_quantity integer, p_payment_method text, p_listing_id uuid DEFAULT NULL::uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

  SELECT public.nft_get_platform_fee() INTO v_fee_cfg;
  v_fee_enabled := COALESCE((v_fee_cfg->>'enabled')::boolean, false);
  v_fee_rate := COALESCE((v_fee_cfg->>'rate')::numeric, 0);
  v_collector := NULLIF(v_fee_cfg->>'collector_user_id','')::uuid;
  IF v_fee_enabled AND v_fee_rate > 0 THEN
    v_platform_fee := round((v_total * v_fee_rate / 100)::numeric, 2);
  END IF;

  IF p_payment_method = 'openpay_balance' THEN
    UPDATE public.wallets SET balance = balance - v_total WHERE user_id = v_buyer AND balance >= v_total;
    IF NOT FOUND THEN RAISE EXCEPTION 'insufficient balance'; END IF;

    IF v_kind = 'resale' AND v_creator IS NOT NULL AND v_creator <> v_seller AND v_creator_royalty_pct > 0 THEN
      v_royalty := round((v_total * v_creator_royalty_pct / 100)::numeric, 2);
      UPDATE public.wallets SET balance = balance + v_royalty WHERE user_id = v_creator;
      IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_creator, v_royalty); END IF;
      INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
        VALUES (v_creator, p_item_id, v_royalty, v_item.currency, 'royalty');
    END IF;

    IF v_platform_fee > 0 AND v_collector IS NOT NULL THEN
      UPDATE public.wallets SET balance = balance + v_platform_fee WHERE user_id = v_collector;
      IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_collector, v_platform_fee); END IF;
    END IF;

    v_seller_net := v_total - v_royalty - v_platform_fee;
    UPDATE public.wallets SET balance = balance + v_seller_net WHERE user_id = v_seller;
    IF NOT FOUND THEN INSERT INTO public.wallets(user_id, balance) VALUES (v_seller, v_seller_net); END IF;

    INSERT INTO public.nft_earnings(user_id, item_id, amount, currency, source)
      VALUES (v_seller, p_item_id, v_seller_net, v_item.currency, CASE WHEN v_kind='resale' THEN 'resale' ELSE 'primary_sale' END);
  END IF;

  UPDATE public.nft_ownership SET quantity = quantity - p_quantity WHERE item_id = p_item_id AND owner_id = v_seller;
  INSERT INTO public.nft_ownership(item_id, owner_id, quantity) VALUES (p_item_id, v_buyer, p_quantity)
    ON CONFLICT (item_id, owner_id) DO UPDATE SET quantity = nft_ownership.quantity + EXCLUDED.quantity;

  IF p_listing_id IS NOT NULL THEN
    UPDATE public.nft_listings SET quantity = quantity - p_quantity, status = CASE WHEN quantity - p_quantity <= 0 THEN 'sold' ELSE status END WHERE id = p_listing_id;
  END IF;

  INSERT INTO public.nft_transactions(item_id, listing_id, seller_id, buyer_id, quantity, price_each, total, royalty_amount, currency, payment_method, tx_kind, status, metadata)
  VALUES (p_item_id, p_listing_id, v_seller, v_buyer, p_quantity, v_price, v_total, v_royalty, v_item.currency, p_payment_method, v_kind, 'completed',
    jsonb_build_object('platform_fee', v_platform_fee, 'platform_fee_rate', v_fee_rate))
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END $function$;
