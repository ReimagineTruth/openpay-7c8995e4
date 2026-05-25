
-- Scan-to-Pay request table
CREATE TABLE IF NOT EXISTS public.app_payment_scan_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  link_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','failed')),
  payer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  transaction_id UUID,
  error_message TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_payment_scan_requests_link_token ON public.app_payment_scan_requests(link_token);
CREATE INDEX IF NOT EXISTS idx_app_payment_scan_requests_status ON public.app_payment_scan_requests(status);

ALTER TABLE public.app_payment_scan_requests ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read scan requests by id (status polling)
DROP POLICY IF EXISTS "Anyone can read scan requests" ON public.app_payment_scan_requests;
CREATE POLICY "Anyone can read scan requests"
ON public.app_payment_scan_requests FOR SELECT
USING (true);

-- Updates happen via SECURITY DEFINER RPCs only (no direct insert/update policies needed)

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_app_payment_scan_requests_updated_at ON public.app_payment_scan_requests;
CREATE TRIGGER trg_app_payment_scan_requests_updated_at
BEFORE UPDATE ON public.app_payment_scan_requests
FOR EACH ROW EXECUTE FUNCTION public.set_common_updated_at();

-- ============== RPCs ==============

-- Create a scan request (called by checkout page, anon allowed)
CREATE OR REPLACE FUNCTION public.create_app_payment_scan(
  p_link_token TEXT,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_link_exists BOOLEAN;
BEGIN
  IF p_link_token IS NULL OR TRIM(p_link_token) = '' THEN
    RAISE EXCEPTION 'link_token is required';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.app_payment_links
    WHERE link_token = p_link_token AND is_active = true
  ) INTO v_link_exists;

  IF NOT v_link_exists THEN
    RAISE EXCEPTION 'Payment link not found or inactive';
  END IF;

  INSERT INTO public.app_payment_scan_requests (
    link_token, customer_name, customer_email, customer_phone
  )
  VALUES (p_link_token, p_customer_name, p_customer_email, p_customer_phone)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_app_payment_scan(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Get current scan status (for polling)
CREATE OR REPLACE FUNCTION public.get_app_payment_scan(p_scan_id UUID)
RETURNS TABLE (
  id UUID,
  status TEXT,
  transaction_id UUID,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  link_token TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, status, transaction_id, error_message, expires_at, link_token
  FROM public.app_payment_scan_requests
  WHERE id = p_scan_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_app_payment_scan(UUID) TO anon, authenticated;

-- Approve a scan request (must be authenticated; uses caller's account)
CREATE OR REPLACE FUNCTION public.approve_app_payment_scan(
  p_scan_id UUID,
  p_payment_method TEXT DEFAULT 'wallet'
)
RETURNS TABLE (status TEXT, transaction_id UUID, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan RECORD;
  v_uid UUID := auth.uid();
  v_result RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'error'::TEXT, NULL::UUID, 'Authentication required'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_scan FROM public.app_payment_scan_requests WHERE id = p_scan_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error'::TEXT, NULL::UUID, 'Scan request not found'::TEXT;
    RETURN;
  END IF;

  IF v_scan.status <> 'pending' THEN
    RETURN QUERY SELECT v_scan.status, v_scan.transaction_id, 'Scan request is no longer pending'::TEXT;
    RETURN;
  END IF;

  IF v_scan.expires_at < now() THEN
    UPDATE public.app_payment_scan_requests SET status = 'expired' WHERE id = p_scan_id;
    RETURN QUERY SELECT 'expired'::TEXT, NULL::UUID, 'Scan request has expired'::TEXT;
    RETURN;
  END IF;

  -- Delegate to existing internal payment processor
  SELECT * INTO v_result FROM public.process_app_payment(
    v_scan.link_token,
    v_uid,
    COALESCE(p_payment_method, 'wallet'),
    v_scan.customer_name,
    v_scan.customer_email,
    v_scan.customer_phone
  );

  IF v_result.status = 'success' THEN
    UPDATE public.app_payment_scan_requests
    SET status = 'approved',
        payer_user_id = v_uid,
        transaction_id = v_result.transaction_id
    WHERE id = p_scan_id;
    RETURN QUERY SELECT 'approved'::TEXT, v_result.transaction_id, COALESCE(v_result.message, 'Payment approved')::TEXT;
  ELSE
    UPDATE public.app_payment_scan_requests
    SET status = 'failed',
        payer_user_id = v_uid,
        error_message = v_result.message
    WHERE id = p_scan_id;
    RETURN QUERY SELECT 'failed'::TEXT, NULL::UUID, COALESCE(v_result.message, 'Payment failed')::TEXT;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_app_payment_scan(UUID, TEXT) TO authenticated;

-- Reject a scan request (must be authenticated)
CREATE OR REPLACE FUNCTION public.reject_app_payment_scan(p_scan_id UUID)
RETURNS TABLE (status TEXT, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_scan RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT 'error'::TEXT, 'Authentication required'::TEXT;
    RETURN;
  END IF;

  SELECT * INTO v_scan FROM public.app_payment_scan_requests WHERE id = p_scan_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'error'::TEXT, 'Scan request not found'::TEXT;
    RETURN;
  END IF;

  IF v_scan.status <> 'pending' THEN
    RETURN QUERY SELECT v_scan.status, 'Scan request is no longer pending'::TEXT;
    RETURN;
  END IF;

  UPDATE public.app_payment_scan_requests
  SET status = 'rejected', payer_user_id = v_uid
  WHERE id = p_scan_id;

  RETURN QUERY SELECT 'rejected'::TEXT, 'Payment request rejected'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_app_payment_scan(UUID) TO authenticated;
