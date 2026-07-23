-- Disable Pi Ad Network globally (master + interstitial + rewarded).
UPDATE public.pi_ads_settings
SET
  enabled = false,
  interstitial_enabled = false,
  rewarded_enabled = false,
  updated_at = now()
WHERE id = true;

ALTER TABLE public.pi_ads_settings
  ALTER COLUMN enabled SET DEFAULT false,
  ALTER COLUMN interstitial_enabled SET DEFAULT false,
  ALTER COLUMN rewarded_enabled SET DEFAULT false;
