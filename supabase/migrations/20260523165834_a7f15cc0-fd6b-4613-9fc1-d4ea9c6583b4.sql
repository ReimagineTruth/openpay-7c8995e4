
-- 1) Table
CREATE TABLE IF NOT EXISTS public.kyc_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  nationality TEXT NOT NULL,
  residential_address TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email TEXT NOT NULL,
  occupation TEXT NOT NULL,
  employer_name TEXT,
  source_of_funds TEXT NOT NULL,
  annual_income_range TEXT NOT NULL,
  political_exposure BOOLEAN NOT NULL DEFAULT FALSE,
  id_document_type TEXT NOT NULL,
  id_document_number TEXT NOT NULL,
  id_document_issue_date DATE NOT NULL,
  id_document_expiry_date DATE NOT NULL,
  id_document_front_url TEXT,
  id_document_back_url TEXT,
  selfie_url TEXT,
  proof_of_address_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  admin_notes TEXT,
  liveness_passed BOOLEAN NOT NULL DEFAULT FALSE,
  liveness_score NUMERIC(5,2),
  face_verification_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  selfie_captured_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation trigger (avoid CHECK with immutability issues)
CREATE OR REPLACE FUNCTION public.kyc_applications_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending','under_review','approved','rejected','additional_info_required') THEN
    RAISE EXCEPTION 'Invalid KYC status: %', NEW.status;
  END IF;
  IF NEW.source_of_funds NOT IN ('employment','business','investments','inheritance','savings','other') THEN
    RAISE EXCEPTION 'Invalid source_of_funds';
  END IF;
  IF NEW.annual_income_range NOT IN ('0-25000','25000-50000','50000-100000','100000-250000','250000+') THEN
    RAISE EXCEPTION 'Invalid annual_income_range';
  END IF;
  IF NEW.id_document_type NOT IN ('passport','national_id','drivers_license','residence_permit') THEN
    RAISE EXCEPTION 'Invalid id_document_type';
  END IF;
  IF NEW.id_document_expiry_date <= NEW.id_document_issue_date THEN
    RAISE EXCEPTION 'ID expiry must be after issue date';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_applications_validate ON public.kyc_applications;
CREATE TRIGGER trg_kyc_applications_validate BEFORE INSERT OR UPDATE ON public.kyc_applications
  FOR EACH ROW EXECUTE FUNCTION public.kyc_applications_validate();

DROP TRIGGER IF EXISTS trg_kyc_applications_updated_at ON public.kyc_applications;
CREATE TRIGGER trg_kyc_applications_updated_at BEFORE UPDATE ON public.kyc_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_common_updated_at();

CREATE INDEX IF NOT EXISTS idx_kyc_applications_user_id ON public.kyc_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_status ON public.kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_submitted_at ON public.kyc_applications(submitted_at DESC);

-- 2) Profiles columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'not_submitted';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMPTZ;

-- 3) RLS
ALTER TABLE public.kyc_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own kyc" ON public.kyc_applications;
CREATE POLICY "Users view own kyc" ON public.kyc_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_openpay_core_admin());

DROP POLICY IF EXISTS "Users insert own kyc" ON public.kyc_applications;
CREATE POLICY "Users insert own kyc" ON public.kyc_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own kyc pre-review" ON public.kyc_applications;
CREATE POLICY "Users update own kyc pre-review" ON public.kyc_applications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','additional_info_required'))
  WITH CHECK (auth.uid() = user_id AND status IN ('pending','additional_info_required'));

DROP POLICY IF EXISTS "Admins update kyc" ON public.kyc_applications;
CREATE POLICY "Admins update kyc" ON public.kyc_applications
  FOR UPDATE TO authenticated
  USING (public.is_openpay_core_admin())
  WITH CHECK (public.is_openpay_core_admin());

-- 4) Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents','kyc-documents',false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "kyc users upload own" ON storage.objects;
CREATE POLICY "kyc users upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc users update own" ON storage.objects;
CREATE POLICY "kyc users update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "kyc users read own" ON storage.objects;
CREATE POLICY "kyc users read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_openpay_core_admin()));

-- 5) Sync profile.kyc_status on insert/update
CREATE OR REPLACE FUNCTION public.sync_profile_kyc_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    kyc_status = NEW.status,
    kyc_verified_at = CASE WHEN NEW.status = 'approved' THEN COALESCE(NEW.reviewed_at, NOW()) ELSE profiles.kyc_verified_at END
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_kyc_status ON public.kyc_applications;
CREATE TRIGGER trg_sync_profile_kyc_status AFTER INSERT OR UPDATE ON public.kyc_applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_kyc_status();

-- 6) Admin review RPC (also sends in-app notification)
CREATE OR REPLACE FUNCTION public.update_kyc_status(
  application_id UUID,
  new_status TEXT,
  rejection_reason_text TEXT DEFAULT NULL,
  admin_notes_text TEXT DEFAULT NULL
) RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin BOOLEAN := public.is_openpay_core_admin();
  v_app public.kyc_applications%ROWTYPE;
  v_title TEXT;
  v_body TEXT;
  v_type TEXT;
BEGIN
  IF NOT v_admin THEN
    RETURN QUERY SELECT FALSE, 'Unauthorized'::TEXT; RETURN;
  END IF;
  IF new_status NOT IN ('under_review','approved','rejected','additional_info_required') THEN
    RETURN QUERY SELECT FALSE, 'Invalid status'::TEXT; RETURN;
  END IF;
  IF new_status = 'rejected' AND COALESCE(TRIM(rejection_reason_text),'') = '' THEN
    RETURN QUERY SELECT FALSE, 'Rejection reason required'::TEXT; RETURN;
  END IF;

  SELECT * INTO v_app FROM public.kyc_applications WHERE id = application_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Application not found'::TEXT; RETURN;
  END IF;

  UPDATE public.kyc_applications SET
    status = new_status,
    rejection_reason = CASE WHEN new_status='rejected' THEN rejection_reason_text ELSE NULL END,
    admin_notes = admin_notes_text,
    reviewed_at = NOW(),
    reviewed_by = auth.uid()
  WHERE id = application_id;

  v_type := 'kyc_' || new_status;
  v_title := CASE new_status
    WHEN 'approved' THEN 'Identity verified'
    WHEN 'rejected' THEN 'Identity verification rejected'
    WHEN 'additional_info_required' THEN 'More information needed'
    ELSE 'KYC under review'
  END;
  v_body := CASE new_status
    WHEN 'approved' THEN 'Your account is now verified. You have full access to OpenPay.'
    WHEN 'rejected' THEN COALESCE(rejection_reason_text, 'Your KYC was rejected. Open KYC for details.')
    WHEN 'additional_info_required' THEN COALESCE(admin_notes_text, 'Please update your KYC submission.')
    ELSE 'Your KYC application is being reviewed.'
  END;

  PERFORM public.create_app_notification(
    v_app.user_id, v_type, v_title, v_body,
    jsonb_build_object('application_id', application_id, 'status', new_status)
  );

  RETURN QUERY SELECT TRUE, 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kyc_status(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 7) Public KYC status helper used by the app
CREATE OR REPLACE FUNCTION public.get_user_kyc_status(user_uuid UUID)
RETURNS TABLE (id UUID, status TEXT, submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, rejection_reason TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ka.id, ka.status, ka.submitted_at, ka.reviewed_at, ka.rejection_reason
  FROM public.kyc_applications ka
  WHERE ka.user_id = user_uuid
  ORDER BY ka.submitted_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_kyc_status(UUID) TO authenticated;
