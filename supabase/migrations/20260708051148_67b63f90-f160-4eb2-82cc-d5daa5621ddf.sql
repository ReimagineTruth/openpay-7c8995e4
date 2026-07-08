REVOKE EXECUTE ON FUNCTION public.admin_dashboard_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_history(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_history(integer, integer) TO service_role;