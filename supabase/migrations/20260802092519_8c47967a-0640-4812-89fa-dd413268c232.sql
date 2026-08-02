ALTER TABLE public.kyc_applications
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.kyc_applications
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'openpay',
  ADD COLUMN IF NOT EXISTS partner_app_id uuid REFERENCES public.partner_apps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_user_id text,
  ADD COLUMN IF NOT EXISTS external_ref text,
  ADD COLUMN IF NOT EXISTS partner_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS callback_url text,
  ADD COLUMN IF NOT EXISTS webhook_last_status integer,
  ADD COLUMN IF NOT EXISTS webhook_last_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS kyc_applications_partner_ref_uidx
  ON public.kyc_applications (partner_app_id, external_ref)
  WHERE partner_app_id IS NOT NULL AND external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS kyc_applications_partner_user_idx
  ON public.kyc_applications (partner_app_id, external_user_id);

CREATE INDEX IF NOT EXISTS kyc_applications_source_status_idx
  ON public.kyc_applications (source, status);

CREATE TABLE IF NOT EXISTS public.kyc_partner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.kyc_applications(id) ON DELETE CASCADE,
  partner_app_id uuid REFERENCES public.partner_apps(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered boolean NOT NULL DEFAULT false,
  response_status integer,
  response_body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kyc_partner_events TO authenticated;
GRANT ALL ON public.kyc_partner_events TO service_role;

ALTER TABLE public.kyc_partner_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view kyc partner events"
  ON public.kyc_partner_events
  FOR SELECT
  TO authenticated
  USING (public.is_openpay_core_admin());

CREATE INDEX IF NOT EXISTS kyc_partner_events_app_idx
  ON public.kyc_partner_events (application_id, created_at DESC);