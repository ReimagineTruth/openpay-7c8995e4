
CREATE TABLE IF NOT EXISTS public.nft_store_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT,
  reason TEXT,
  links TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nft_ver_req_status ON public.nft_store_verification_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_ver_req_user ON public.nft_store_verification_requests(user_id);

GRANT SELECT, INSERT ON public.nft_store_verification_requests TO authenticated;
GRANT ALL ON public.nft_store_verification_requests TO service_role;

ALTER TABLE public.nft_store_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own verification requests" ON public.nft_store_verification_requests;
CREATE POLICY "Users view own verification requests" ON public.nft_store_verification_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_openpay_core_admin());

DROP POLICY IF EXISTS "Users insert own verification requests" ON public.nft_store_verification_requests;
CREATE POLICY "Users insert own verification requests" ON public.nft_store_verification_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins update verification requests" ON public.nft_store_verification_requests;
CREATE POLICY "Admins update verification requests" ON public.nft_store_verification_requests
  FOR UPDATE TO authenticated USING (public.is_openpay_core_admin()) WITH CHECK (public.is_openpay_core_admin());

-- User applies for verification
CREATE OR REPLACE FUNCTION public.nft_request_verification(p_reason TEXT, p_links TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_handle TEXT;
  v_id UUID;
  v_existing_pending INT;
  v_already_verified BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT handle, COALESCE(is_verified,false) INTO v_handle, v_already_verified
  FROM public.nft_store_profiles WHERE user_id = v_user;

  IF v_handle IS NULL THEN
    RAISE EXCEPTION 'Create your store profile first';
  END IF;

  IF v_already_verified THEN
    RAISE EXCEPTION 'Store is already verified';
  END IF;

  SELECT count(*) INTO v_existing_pending FROM public.nft_store_verification_requests
  WHERE user_id = v_user AND status = 'pending';

  IF v_existing_pending > 0 THEN
    RAISE EXCEPTION 'You already have a pending verification request';
  END IF;

  INSERT INTO public.nft_store_verification_requests(user_id, handle, reason, links)
  VALUES (v_user, v_handle, p_reason, p_links)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Admin lists verification requests
CREATE OR REPLACE FUNCTION public.nft_admin_list_verification_requests(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID, user_id UUID, handle TEXT, reason TEXT, links TEXT,
  status TEXT, admin_notes TEXT, reviewed_at TIMESTAMPTZ, created_at TIMESTAMPTZ,
  display_name TEXT, avatar_url TEXT, is_verified BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_openpay_core_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id, r.handle, r.reason, r.links, r.status, r.admin_notes,
         r.reviewed_at, r.created_at,
         sp.display_name, sp.avatar_url, sp.is_verified
  FROM public.nft_store_verification_requests r
  LEFT JOIN public.nft_store_profiles sp ON sp.user_id = r.user_id
  WHERE (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;

-- Admin approves/rejects
CREATE OR REPLACE FUNCTION public.nft_admin_review_verification(p_id UUID, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NOT public.is_openpay_core_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;

  UPDATE public.nft_store_verification_requests
     SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
         admin_notes = p_notes,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   WHERE id = p_id
   RETURNING user_id INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF p_approve THEN
    UPDATE public.nft_store_profiles
       SET is_verified = true
     WHERE user_id = v_user_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.nft_request_verification(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_list_verification_requests(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nft_admin_review_verification(UUID, BOOLEAN, TEXT) TO authenticated;
