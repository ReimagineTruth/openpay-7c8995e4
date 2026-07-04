
CREATE TABLE IF NOT EXISTS public.pi_ads_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  enabled BOOLEAN NOT NULL DEFAULT true,
  interstitial_enabled BOOLEAN NOT NULL DEFAULT true,
  rewarded_enabled BOOLEAN NOT NULL DEFAULT true,
  interstitial_interval_minutes INTEGER NOT NULL DEFAULT 5 CHECK (interstitial_interval_minutes >= 1 AND interstitial_interval_minutes <= 1440),
  max_ads_per_hour INTEGER NOT NULL DEFAULT 12 CHECK (max_ads_per_hour >= 0 AND max_ads_per_hour <= 240),
  max_ads_per_day INTEGER NOT NULL DEFAULT 60 CHECK (max_ads_per_day >= 0 AND max_ads_per_day <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.pi_ads_settings TO authenticated, anon;
GRANT ALL ON public.pi_ads_settings TO service_role;

ALTER TABLE public.pi_ads_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pi ads settings"
ON public.pi_ads_settings FOR SELECT
USING (true);

CREATE POLICY "Only core admins can modify pi ads settings"
ON public.pi_ads_settings FOR ALL
USING (public.is_openpay_core_admin())
WITH CHECK (public.is_openpay_core_admin());

INSERT INTO public.pi_ads_settings (id) VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.pi_ads_get_settings()
RETURNS public.pi_ads_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.pi_ads_settings WHERE id = true LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.pi_ads_get_settings() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.pi_ads_set_settings(
  p_enabled BOOLEAN,
  p_interstitial_enabled BOOLEAN,
  p_rewarded_enabled BOOLEAN,
  p_interstitial_interval_minutes INTEGER,
  p_max_ads_per_hour INTEGER,
  p_max_ads_per_day INTEGER
)
RETURNS public.pi_ads_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.pi_ads_settings;
BEGIN
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Access denied: core admin only';
  END IF;

  INSERT INTO public.pi_ads_settings (
    id, enabled, interstitial_enabled, rewarded_enabled,
    interstitial_interval_minutes, max_ads_per_hour, max_ads_per_day,
    updated_at, updated_by
  ) VALUES (
    true, p_enabled, p_interstitial_enabled, p_rewarded_enabled,
    p_interstitial_interval_minutes, p_max_ads_per_hour, p_max_ads_per_day,
    now(), auth.uid()
  )
  ON CONFLICT (id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    interstitial_enabled = EXCLUDED.interstitial_enabled,
    rewarded_enabled = EXCLUDED.rewarded_enabled,
    interstitial_interval_minutes = EXCLUDED.interstitial_interval_minutes,
    max_ads_per_hour = EXCLUDED.max_ads_per_hour,
    max_ads_per_day = EXCLUDED.max_ads_per_day,
    updated_at = now(),
    updated_by = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pi_ads_set_settings(BOOLEAN, BOOLEAN, BOOLEAN, INTEGER, INTEGER, INTEGER) TO authenticated;
