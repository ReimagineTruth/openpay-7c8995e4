
-- 1. redirect_uris on partner_apps
ALTER TABLE public.partner_apps
  ADD COLUMN IF NOT EXISTS redirect_uris text[] NOT NULL DEFAULT '{}';

-- 2. grants table
CREATE TABLE IF NOT EXISTS public.partner_oauth_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_app_id uuid NOT NULL REFERENCES public.partner_apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  scope text NOT NULL DEFAULT 'profile balance',
  redirect_uri text NOT NULL,
  code_hash text,
  code_expires_at timestamptz,
  code_used_at timestamptz,
  access_token_hash text,
  access_token_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner_app_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_partner_oauth_grants_code ON public.partner_oauth_grants(code_hash);
CREATE INDEX IF NOT EXISTS idx_partner_oauth_grants_token ON public.partner_oauth_grants(access_token_hash);

GRANT SELECT, UPDATE, DELETE ON public.partner_oauth_grants TO authenticated;
GRANT ALL ON public.partner_oauth_grants TO service_role;
ALTER TABLE public.partner_oauth_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own grants" ON public.partner_oauth_grants;
CREATE POLICY "users read own grants" ON public.partner_oauth_grants
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users revoke own grants" ON public.partner_oauth_grants;
CREATE POLICY "users revoke own grants" ON public.partner_oauth_grants
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own grants" ON public.partner_oauth_grants;
CREATE POLICY "users delete own grants" ON public.partner_oauth_grants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. Public client lookup (for consent page) — no secrets exposed
CREATE OR REPLACE FUNCTION public.partner_oauth_get_client(p_app_id uuid)
RETURNS TABLE (
  id uuid, name text, description text, website text,
  redirect_uris text[], is_active boolean,
  owner_full_name text, owner_username text, owner_avatar_url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.name, a.description, a.website, a.redirect_uris, a.is_active,
         p.full_name, p.username, p.avatar_url
  FROM public.partner_apps a
  LEFT JOIN public.profiles p ON p.id = a.owner_user_id
  WHERE a.id = p_app_id;
$$;
GRANT EXECUTE ON FUNCTION public.partner_oauth_get_client(uuid) TO anon, authenticated;

-- 4. Approve consent -> return authorization code (plaintext, one-time)
CREATE OR REPLACE FUNCTION public.partner_oauth_approve(
  p_app_id uuid,
  p_redirect_uri text,
  p_scope text
) RETURNS TABLE(code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_app public.partner_apps%ROWTYPE;
  v_code text;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_app FROM public.partner_apps WHERE id = p_app_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown or inactive partner app'; END IF;
  IF array_length(v_app.redirect_uris, 1) IS NULL
     OR NOT (p_redirect_uri = ANY(v_app.redirect_uris)) THEN
    RAISE EXCEPTION 'redirect_uri not allowed for this app';
  END IF;

  v_code := 'opc_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_hash := encode(extensions.digest(v_code, 'sha256'), 'hex');

  INSERT INTO public.partner_oauth_grants
    (partner_app_id, user_id, scope, redirect_uri, code_hash, code_expires_at, revoked_at)
  VALUES (p_app_id, v_uid, COALESCE(NULLIF(p_scope,''),'profile balance'),
          p_redirect_uri, v_hash, now() + interval '10 minutes', NULL)
  ON CONFLICT (partner_app_id, user_id) DO UPDATE
    SET scope = EXCLUDED.scope,
        redirect_uri = EXCLUDED.redirect_uri,
        code_hash = EXCLUDED.code_hash,
        code_expires_at = EXCLUDED.code_expires_at,
        code_used_at = NULL,
        revoked_at = NULL;

  RETURN QUERY SELECT v_code;
END $$;
GRANT EXECUTE ON FUNCTION public.partner_oauth_approve(uuid,text,text) TO authenticated;

-- 5. Exchange code -> access token (called by edge function via service role)
CREATE OR REPLACE FUNCTION public.partner_oauth_exchange(
  p_app_id uuid,
  p_code_hash text,
  p_redirect_uri text,
  p_token_hash text,
  p_ttl_seconds int DEFAULT 2592000
) RETURNS TABLE(user_id uuid, scope text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.partner_oauth_grants%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.partner_oauth_grants
   WHERE partner_app_id = p_app_id AND code_hash = p_code_hash
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_grant: code not found'; END IF;
  IF r.code_used_at IS NOT NULL THEN RAISE EXCEPTION 'invalid_grant: code already used'; END IF;
  IF r.code_expires_at < now() THEN RAISE EXCEPTION 'invalid_grant: code expired'; END IF;
  IF r.redirect_uri <> p_redirect_uri THEN RAISE EXCEPTION 'invalid_grant: redirect_uri mismatch'; END IF;
  IF r.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invalid_grant: revoked'; END IF;

  UPDATE public.partner_oauth_grants
     SET code_used_at = now(),
         code_hash = NULL,
         access_token_hash = p_token_hash,
         access_token_expires_at = now() + make_interval(secs => p_ttl_seconds)
   WHERE id = r.id;

  RETURN QUERY SELECT r.user_id, r.scope, now() + make_interval(secs => p_ttl_seconds);
END $$;
REVOKE ALL ON FUNCTION public.partner_oauth_exchange(uuid,text,text,text,int) FROM public, anon, authenticated;
