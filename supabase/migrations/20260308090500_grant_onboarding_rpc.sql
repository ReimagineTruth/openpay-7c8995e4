-- Ensure complete_account_onboarding RPC has correct execution permissions
-- Date: 2026-03-08

REVOKE ALL ON FUNCTION public.complete_account_onboarding(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_account_onboarding(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_account_onboarding(TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

