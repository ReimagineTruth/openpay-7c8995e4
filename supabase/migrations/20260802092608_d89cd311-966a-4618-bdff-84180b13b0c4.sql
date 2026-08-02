CREATE OR REPLACE FUNCTION public.update_kyc_status(application_id uuid, new_status text, rejection_reason_text text DEFAULT NULL::text, admin_notes_text text DEFAULT NULL::text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_app.user_id IS NOT NULL THEN
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
  END IF;

  RETURN QUERY SELECT TRUE, 'OK'::TEXT;
END;
$function$;