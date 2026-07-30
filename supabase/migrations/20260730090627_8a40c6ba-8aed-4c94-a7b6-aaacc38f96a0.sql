CREATE OR REPLACE FUNCTION public.partner_lookup_account(p_identifier text)
 RETURNS TABLE(user_id uuid, full_name text, username text, avatar_url text, account_number text, balance numeric, currency text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id TEXT := TRIM(COALESCE(p_identifier,''));
  v_user UUID;
  v_norm TEXT;
BEGIN
  IF v_id = '' THEN RETURN; END IF;

  IF UPPER(v_id) LIKE 'OP%' AND LENGTH(v_id) = 34 THEN
    v_norm := LOWER(SUBSTRING(v_id, 3));
    v_norm := SUBSTRING(v_norm,1,8) || '-' || SUBSTRING(v_norm,9,4) || '-' ||
              SUBSTRING(v_norm,13,4) || '-' || SUBSTRING(v_norm,17,4) || '-' ||
              SUBSTRING(v_norm,21,12);
    BEGIN v_user := v_norm::uuid; EXCEPTION WHEN OTHERS THEN v_user := NULL; END;
  END IF;

  IF v_user IS NULL THEN
    SELECT pr.id INTO v_user FROM public.profiles pr
    WHERE LOWER(pr.username) = LOWER(REPLACE(v_id,'@',''))
    LIMIT 1;
  END IF;

  IF v_user IS NULL AND POSITION('@' IN v_id) > 0 THEN
    SELECT u.id INTO v_user FROM auth.users u
    WHERE LOWER(u.email) = LOWER(v_id) LIMIT 1;
  END IF;

  IF v_user IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.username,
    p.avatar_url,
    'OP' || UPPER(REPLACE(p.id::TEXT,'-','')),
    COALESCE(w.balance, 0)::NUMERIC,
    'OUSD'::TEXT
  FROM public.profiles p
  LEFT JOIN public.wallets w ON w.user_id = p.id
  WHERE p.id = v_user;
END; $function$;