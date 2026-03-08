-- Hard-fix user_accounts account_number format enforcement.
-- Some environments may already have the constraint name but with a legacy definition,
-- or a legacy generate_openpay_account_number() that includes UUID dashes.
-- This migration normalizes all paths to the format: ^OP[A-Z0-9]{6,64}$

CREATE OR REPLACE FUNCTION public.generate_openpay_account_number(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'OP' || UPPER(REPLACE(p_user_id::TEXT, '-', ''));
$$;

-- Ensure check constraint expression matches the expected format, even if a legacy constraint exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_accounts_account_number_format_ck'
      AND conrelid = 'public.user_accounts'::regclass
  ) THEN
    ALTER TABLE public.user_accounts
      DROP CONSTRAINT user_accounts_account_number_format_ck;
  END IF;

  ALTER TABLE public.user_accounts
    ADD CONSTRAINT user_accounts_account_number_format_ck
    CHECK (account_number ~ '^OP[A-Z0-9]{6,64}$') NOT VALID;
END $$;

-- Reinstate/ensure trigger-based normalization on inserts/updates.
CREATE OR REPLACE FUNCTION public.enforce_user_account_number_format()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.account_number IS NULL OR NEW.account_number !~ '^OP[A-Z0-9]{6,64}$' THEN
    NEW.account_number := public.generate_openpay_account_number(NEW.user_id);
  ELSE
    NEW.account_number := UPPER(TRIM(NEW.account_number));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_accounts_enforce_format ON public.user_accounts;
CREATE TRIGGER trg_user_accounts_enforce_format
BEFORE INSERT OR UPDATE ON public.user_accounts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_account_number_format();

-- Backfill any existing invalid account numbers.
UPDATE public.user_accounts ua
SET account_number = public.generate_openpay_account_number(ua.user_id)
WHERE ua.account_number IS NULL
   OR TRIM(ua.account_number) = ''
   OR ua.account_number !~ '^OP[A-Z0-9]{6,64}$';

ALTER TABLE public.user_accounts
  VALIDATE CONSTRAINT user_accounts_account_number_format_ck;

REVOKE ALL ON FUNCTION public.generate_openpay_account_number(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_openpay_account_number(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
