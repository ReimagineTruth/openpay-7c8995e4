
CREATE OR REPLACE FUNCTION public.nft_creator_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - (greatest(coalesce(p_days,30),1) || ' days')::interval;
  v_totals jsonb;
  v_series jsonb;
  v_top_items jsonb;
  v_top_buyers jsonb;
  v_recent_sales jsonb;
  v_by_source jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Totals from earnings (creator perspective)
  SELECT jsonb_build_object(
    'total_earnings', coalesce(sum(amount),0),
    'primary_sales_earnings', coalesce(sum(amount) filter (where source='primary_sale'),0),
    'resale_earnings', coalesce(sum(amount) filter (where source='resale'),0),
    'royalty_earnings', coalesce(sum(amount) filter (where source='royalty'),0),
    'entries', count(*)
  ) INTO v_totals
  FROM nft_earnings
  WHERE user_id = v_uid AND created_at >= v_since;

  -- Sales metrics (items you created that got sold)
  WITH sales AS (
    SELECT t.*
    FROM nft_transactions t
    JOIN nft_items i ON i.id = t.item_id
    WHERE i.creator_id = v_uid
      AND t.status = 'completed'
      AND t.tx_kind IN ('sale','primary_sale','resale','auction_settle')
      AND t.created_at >= v_since
  )
  SELECT v_totals || jsonb_build_object(
    'sales_count', (SELECT count(*) FROM sales),
    'total_volume', (SELECT coalesce(sum(total),0) FROM sales),
    'unique_buyers', (SELECT count(DISTINCT buyer_id) FROM sales WHERE buyer_id IS NOT NULL),
    'platform_fees_paid', (SELECT coalesce(sum(platform_fee),0) FROM sales),
    'royalties_paid_to_others', 0
  ) INTO v_totals;

  -- Daily series (earnings + sales count)
  WITH days AS (
    SELECT generate_series(date_trunc('day', v_since), date_trunc('day', now()), interval '1 day') AS day
  ),
  e AS (
    SELECT date_trunc('day', created_at) AS day, sum(amount) AS earnings
    FROM nft_earnings WHERE user_id = v_uid AND created_at >= v_since GROUP BY 1
  ),
  s AS (
    SELECT date_trunc('day', t.created_at) AS day, count(*) AS sales, coalesce(sum(t.total),0) AS volume
    FROM nft_transactions t JOIN nft_items i ON i.id = t.item_id
    WHERE i.creator_id = v_uid AND t.status='completed'
      AND t.tx_kind IN ('sale','primary_sale','resale','auction_settle')
      AND t.created_at >= v_since
    GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'date', to_char(d.day,'YYYY-MM-DD'),
    'earnings', coalesce(e.earnings,0),
    'sales', coalesce(s.sales,0),
    'volume', coalesce(s.volume,0)
  ) ORDER BY d.day) INTO v_series
  FROM days d LEFT JOIN e ON e.day = d.day LEFT JOIN s ON s.day = d.day;

  -- By source pie
  SELECT jsonb_agg(jsonb_build_object('source', source, 'amount', amt))
    INTO v_by_source
  FROM (
    SELECT source, sum(amount)::numeric AS amt
    FROM nft_earnings WHERE user_id = v_uid AND created_at >= v_since
    GROUP BY source
  ) x;

  -- Top items sold
  SELECT jsonb_agg(row_to_json(t2)) INTO v_top_items FROM (
    SELECT i.id, i.name, i.image_url, i.price,
      count(t.*) AS sales_count,
      coalesce(sum(t.total),0) AS volume,
      coalesce(sum(t.total - t.platform_fee - coalesce(t.royalty_amount,0)),0) AS net_revenue
    FROM nft_items i
    LEFT JOIN nft_transactions t ON t.item_id = i.id
      AND t.status='completed'
      AND t.tx_kind IN ('sale','primary_sale','resale','auction_settle')
      AND t.created_at >= v_since
    WHERE i.creator_id = v_uid
    GROUP BY i.id
    ORDER BY volume DESC NULLS LAST
    LIMIT 10
  ) t2;

  -- Top buyers with profile info
  SELECT jsonb_agg(row_to_json(b)) INTO v_top_buyers FROM (
    SELECT
      p.id AS buyer_id,
      p.full_name,
      p.username,
      p.avatar_url,
      count(t.*) AS purchases,
      coalesce(sum(t.total),0) AS spent,
      max(t.created_at) AS last_purchase_at
    FROM nft_transactions t
    JOIN nft_items i ON i.id = t.item_id
    LEFT JOIN profiles p ON p.id = t.buyer_id
    WHERE i.creator_id = v_uid
      AND t.status='completed'
      AND t.tx_kind IN ('sale','primary_sale','resale','auction_settle')
      AND t.created_at >= v_since
      AND t.buyer_id IS NOT NULL
    GROUP BY p.id, p.full_name, p.username, p.avatar_url
    ORDER BY spent DESC
    LIMIT 20
  ) b;

  -- Recent sales feed with buyer info
  SELECT jsonb_agg(row_to_json(r)) INTO v_recent_sales FROM (
    SELECT
      t.id, t.total, t.currency, t.tx_kind, t.payment_method,
      t.platform_fee, t.royalty_amount, t.created_at,
      i.id AS item_id, i.name AS item_name, i.image_url AS item_image,
      p.id AS buyer_id, p.full_name AS buyer_name, p.username AS buyer_username, p.avatar_url AS buyer_avatar
    FROM nft_transactions t
    JOIN nft_items i ON i.id = t.item_id
    LEFT JOIN profiles p ON p.id = t.buyer_id
    WHERE i.creator_id = v_uid
      AND t.status='completed'
      AND t.tx_kind IN ('sale','primary_sale','resale','auction_settle')
      AND t.created_at >= v_since
    ORDER BY t.created_at DESC
    LIMIT 30
  ) r;

  RETURN jsonb_build_object(
    'range_days', p_days,
    'since', v_since,
    'totals', v_totals,
    'series', coalesce(v_series,'[]'::jsonb),
    'by_source', coalesce(v_by_source,'[]'::jsonb),
    'top_items', coalesce(v_top_items,'[]'::jsonb),
    'top_buyers', coalesce(v_top_buyers,'[]'::jsonb),
    'recent_sales', coalesce(v_recent_sales,'[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nft_creator_stats(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nft_creator_stats(integer) TO authenticated;
