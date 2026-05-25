
CREATE OR REPLACE FUNCTION public.process_app_payment_public(
  p_link_token TEXT,
  p_payer_account TEXT,
  p_payer_pin TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'wallet',
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS TABLE (transaction_id UUID, status TEXT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_payer_user_id UUID;
  v_account TEXT;
BEGIN
  v_account := TRIM(COALESCE(p_payer_account, ''));
  IF v_account = '' THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'Account number or email is required'::TEXT;
    RETURN;
  END IF;

  -- Try account_number first
  SELECT user_id INTO v_payer_user_id
  FROM public.user_accounts
  WHERE UPPER(account_number) = UPPER(v_account)
  LIMIT 1;

  -- Fallback: try email lookup via auth.users
  IF v_payer_user_id IS NULL THEN
    SELECT id INTO v_payer_user_id
    FROM auth.users
    WHERE LOWER(email) = LOWER(v_account)
    LIMIT 1;
  END IF;

  IF v_payer_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 'error', 'OpenPay account not found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.process_app_payment(
    p_link_token,
    v_payer_user_id,
    COALESCE(p_payment_method, 'wallet'),
    p_customer_name,
    p_customer_email,
    p_customer_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_app_payment_public(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
