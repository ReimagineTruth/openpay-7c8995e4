
CREATE OR REPLACE FUNCTION public.get_public_ledger_v2(
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0,
  p_category text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  amount numeric,
  note text,
  status text,
  occurred_at timestamptz,
  event_type text,
  source_table text,
  category text,
  currency_code text,
  sender_amount numeric,
  sender_currency_code text,
  receiver_amount numeric,
  receiver_currency_code text,
  payload jsonb,
  sender_name text,
  sender_username text,
  sender_avatar text,
  receiver_name text,
  receiver_username text,
  receiver_avatar text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH classified AS (
    SELECT
      le.id,
      le.amount,
      CASE
        WHEN le.note IS NULL THEN NULL
        ELSE regexp_replace(
          le.note,
          '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}',
          '[hidden]',
          'g'
        )
      END AS note,
      COALESCE(le.status, 'completed') AS status,
      le.occurred_at,
      le.event_type,
      le.source_table,
      CASE
        WHEN le.source_table LIKE 'nft_%' OR le.event_type ILIKE '%nft%' OR le.event_type ILIKE '%mint%' OR le.event_type ILIKE '%auction%' THEN 'nft'
        WHEN le.source_table = 'stripe_topups' OR le.source_table = 'user_topup_requests' OR le.event_type ILIKE '%topup%' OR le.event_type ILIKE '%deposit%' THEN 'topup'
        WHEN le.source_table = 'user_swap_withdrawals' OR le.event_type ILIKE '%withdraw%' OR le.event_type ILIKE '%payout%' THEN 'withdraw'
        WHEN le.event_type ILIKE '%swap%' OR le.event_type ILIKE '%exchange%' OR le.event_type ILIKE '%convert%' THEN 'swap'
        WHEN le.source_table = 'staking_positions' OR le.event_type ILIKE '%stak%' THEN 'staking'
        WHEN le.source_table LIKE 'user_loan%' OR le.event_type ILIKE '%loan%' OR le.event_type ILIKE '%borrow%' THEN 'loan'
        WHEN le.source_table = 'referral_rewards' OR le.event_type ILIKE '%affiliate%' OR le.event_type ILIKE '%referral%' THEN 'affiliate'
        WHEN le.source_table = 'mining_rewards' OR le.source_table = 'mining_sessions' OR le.event_type ILIKE '%mining%' OR le.event_type ILIKE '%reward%' THEN 'mining'
        WHEN le.source_table IN ('transactions','qr_payment_transactions','merchant_payments','invoices','payment_requests') THEN 'other'
        ELSE 'other'
      END AS category,
      COALESCE((le.payload->>'currency_code')::text, 'OUSD') AS currency_code,
      NULLIF(le.payload->>'sender_amount','')::numeric AS sender_amount,
      NULLIF(le.payload->>'sender_currency_code','')::text AS sender_currency_code,
      NULLIF(le.payload->>'receiver_amount','')::numeric AS receiver_amount,
      NULLIF(le.payload->>'receiver_currency_code','')::text AS receiver_currency_code,
      le.payload,
      le.actor_user_id,
      le.related_user_id
    FROM public.ledger_events le
    WHERE le.amount IS NOT NULL
      AND le.source_table <> 'wallets'  -- exclude noisy internal balance mirrors
      AND le.event_type <> 'wallet_balance_changed'
  )
  SELECT
    c.id,
    c.amount,
    c.note,
    c.status,
    c.occurred_at,
    c.event_type,
    c.source_table,
    c.category,
    c.currency_code,
    c.sender_amount,
    c.sender_currency_code,
    c.receiver_amount,
    c.receiver_currency_code,
    c.payload,
    COALESCE(sp.full_name, '') AS sender_name,
    COALESCE(sp.username, '') AS sender_username,
    COALESCE(sp.avatar_url, '') AS sender_avatar,
    COALESCE(rp.full_name, '') AS receiver_name,
    COALESCE(rp.username, '') AS receiver_username,
    COALESCE(rp.avatar_url, '') AS receiver_avatar
  FROM classified c
  LEFT JOIN public.profiles sp ON sp.id = c.actor_user_id
  LEFT JOIN public.profiles rp ON rp.id = c.related_user_id
  WHERE (p_category IS NULL OR p_category = '' OR p_category = 'all' OR c.category = lower(p_category))
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR c.note ILIKE '%' || p_search || '%'
      OR c.event_type ILIKE '%' || p_search || '%'
      OR COALESCE(sp.username,'') ILIKE '%' || p_search || '%'
      OR COALESCE(rp.username,'') ILIKE '%' || p_search || '%'
      OR COALESCE(sp.full_name,'') ILIKE '%' || p_search || '%'
      OR COALESCE(rp.full_name,'') ILIKE '%' || p_search || '%'
    )
  ORDER BY c.occurred_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_ledger_v2(integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ledger_v2(integer, integer, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_public_ledger_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH classified AS (
    SELECT
      CASE
        WHEN le.source_table LIKE 'nft_%' OR le.event_type ILIKE '%nft%' OR le.event_type ILIKE '%mint%' OR le.event_type ILIKE '%auction%' THEN 'nft'
        WHEN le.source_table IN ('stripe_topups','user_topup_requests') OR le.event_type ILIKE '%topup%' OR le.event_type ILIKE '%deposit%' THEN 'topup'
        WHEN le.source_table = 'user_swap_withdrawals' OR le.event_type ILIKE '%withdraw%' OR le.event_type ILIKE '%payout%' THEN 'withdraw'
        WHEN le.event_type ILIKE '%swap%' OR le.event_type ILIKE '%exchange%' OR le.event_type ILIKE '%convert%' THEN 'swap'
        WHEN le.source_table = 'staking_positions' OR le.event_type ILIKE '%stak%' THEN 'staking'
        WHEN le.source_table LIKE 'user_loan%' OR le.event_type ILIKE '%loan%' THEN 'loan'
        WHEN le.source_table = 'referral_rewards' OR le.event_type ILIKE '%affiliate%' OR le.event_type ILIKE '%referral%' THEN 'affiliate'
        WHEN le.source_table IN ('mining_rewards','mining_sessions') OR le.event_type ILIKE '%mining%' OR le.event_type ILIKE '%reward%' THEN 'mining'
        ELSE 'other'
      END AS category,
      le.amount,
      le.occurred_at
    FROM public.ledger_events le
    WHERE le.amount IS NOT NULL
      AND le.source_table <> 'wallets'
      AND le.event_type <> 'wallet_balance_changed'
  )
  SELECT jsonb_build_object(
    'total_events', (SELECT COUNT(*) FROM classified),
    'total_volume', (SELECT COALESCE(SUM(amount),0) FROM classified),
    'latest_at', (SELECT MAX(occurred_at) FROM classified),
    'by_category', (
      SELECT COALESCE(jsonb_object_agg(category, cnt), '{}'::jsonb)
      FROM (SELECT category, COUNT(*) AS cnt FROM classified GROUP BY category) t
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_ledger_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_ledger_stats() TO anon, authenticated, service_role;
