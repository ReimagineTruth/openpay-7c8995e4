REVOKE SELECT ON public.mcp_connections FROM authenticated;
GRANT SELECT (id, user_id, name, url, state, auth_url, last_error, created_at, updated_at) ON public.mcp_connections TO authenticated;