-- Fix ambiguous expires_at in partner_charge_create
-- RETURNS TABLE(expires_at ...) conflicts with partner_charges.expires_at
CREATE OR REPLACE FUNCTION public.partner_charge_create(
  p_partner_app_id UUID,
  p_owner_user_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_description TEXT,
  p_reference TEXT,
  p_success_url TEXT,
  p_cancel_url TEXT,
  p_metadata JSONB
) RETURNS TABLE(charge_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
  v_exp TIMESTAMPTZ;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  INSERT INTO public.partner_charges(
    partner_app_id, owner_user_id, amount, currency, description, reference,
    success_url, cancel_url, metadata
  ) VALUES (
    p_partner_app_id,
    p_owner_user_id,
    p_amount,
    COALESCE(NULLIF(p_currency, ''), 'OUSD'),
    NULLIF(p_description, ''),
    NULLIF(p_reference, ''),
    NULLIF(p_success_url, ''),
    NULLIF(p_cancel_url, ''),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING partner_charges.id, partner_charges.expires_at
  INTO v_id, v_exp;

  charge_id := v_id;
  expires_at := v_exp;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.partner_charge_create(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
