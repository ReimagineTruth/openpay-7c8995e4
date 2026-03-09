-- Require an invite / sign-up code for creating accounts.
-- To add codes (example):
--   INSERT INTO public.signup_codes (code, max_uses, expires_at) VALUES ('OPENPAY-INVITE-001', 1, NULL);

CREATE TABLE IF NOT EXISTS public.signup_codes (
  code TEXT PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_codes ENABLE ROW LEVEL SECURITY;

-- No direct access from client roles by default.
REVOKE ALL ON TABLE public.signup_codes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_username TEXT;
  final_username TEXT;
  requested_referral_code TEXT;
  referred_by_id UUID;
  base_referral_code TEXT;
  final_referral_code TEXT;
  referral_suffix INTEGER := 0;
  requested_signup_code TEXT;
BEGIN
  requested_signup_code := UPPER(NULLIF(BTRIM(NEW.raw_user_meta_data->>'signup_code'), ''));
  IF requested_signup_code IS NULL THEN
    RAISE EXCEPTION 'Sign-up code is required.';
  END IF;

  -- Validate + consume signup code (atomic with user creation).
  UPDATE public.signup_codes sc
  SET uses = sc.uses + 1,
      last_used_at = now(),
      is_active = CASE
        WHEN sc.max_uses IS NOT NULL AND (sc.uses + 1) >= sc.max_uses THEN false
        ELSE sc.is_active
      END
  WHERE UPPER(sc.code) = requested_signup_code
    AND sc.is_active = true
    AND (sc.expires_at IS NULL OR sc.expires_at > now())
    AND (sc.max_uses IS NULL OR sc.uses < sc.max_uses);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid sign-up code.';
  END IF;

  requested_username := NULLIF(BTRIM(NEW.raw_user_meta_data->>'username'), '');

  IF requested_username IS NOT NULL THEN
    final_username := requested_username;

    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = final_username) THEN
      final_username := requested_username || '_' || REPLACE(SUBSTRING(NEW.id::text, 1, 8), '-', '');
    END IF;
  END IF;

  requested_referral_code := LOWER(NULLIF(BTRIM(NEW.raw_user_meta_data->>'referral_code'), ''));

  IF requested_referral_code IS NOT NULL THEN
    SELECT p.id
    INTO referred_by_id
    FROM public.profiles p
    WHERE LOWER(p.referral_code) = requested_referral_code
      AND p.id <> NEW.id
    LIMIT 1;
  END IF;

  base_referral_code := LOWER(
    REGEXP_REPLACE(
      COALESCE(final_username, 'user_' || REPLACE(SUBSTRING(NEW.id::text, 1, 8), '-', '')),
      '[^a-z0-9_]',
      '',
      'g'
    )
  );

  IF base_referral_code IS NULL OR base_referral_code = '' THEN
    base_referral_code := 'user_' || REPLACE(SUBSTRING(NEW.id::text, 1, 8), '-', '');
  END IF;

  final_referral_code := base_referral_code;

  WHILE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE LOWER(p.referral_code) = final_referral_code
  ) LOOP
    referral_suffix := referral_suffix + 1;
    final_referral_code := base_referral_code || referral_suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, full_name, username, referral_code, referred_by_user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    final_username,
    final_referral_code,
    referred_by_id
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance, welcome_bonus_claimed_at)
  VALUES (NEW.id, 1.00, now())
  ON CONFLICT (user_id) DO NOTHING;

  IF referred_by_id IS NOT NULL THEN
    INSERT INTO public.referral_rewards (referrer_user_id, referred_user_id, reward_amount, status)
    VALUES (referred_by_id, NEW.id, 1.00, 'pending')
    ON CONFLICT (referred_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

