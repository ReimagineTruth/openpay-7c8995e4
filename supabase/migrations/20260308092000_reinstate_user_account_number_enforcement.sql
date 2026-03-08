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

UPDATE public.user_accounts ua
SET account_number = public.generate_openpay_account_number(ua.user_id)
WHERE ua.account_number IS NULL OR ua.account_number !~ '^OP[A-Z0-9]{6,64}$';

NOTIFY pgrst, 'reload schema';
