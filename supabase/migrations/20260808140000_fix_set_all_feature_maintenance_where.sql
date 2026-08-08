-- pg-safeupdate (enabled on Supabase) rejects UPDATE/DELETE without a WHERE clause,
-- including inside SECURITY DEFINER functions. Add an always-true predicate.
CREATE OR REPLACE FUNCTION public.set_all_feature_maintenance(p_maintenance boolean)
RETURNS SETOF public.feature_maintenance
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_openpay_core_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  UPDATE public.feature_maintenance
     SET maintenance = p_maintenance, updated_by = auth.uid()
   WHERE feature_key IS NOT NULL
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_all_feature_maintenance(boolean) TO authenticated, service_role;
