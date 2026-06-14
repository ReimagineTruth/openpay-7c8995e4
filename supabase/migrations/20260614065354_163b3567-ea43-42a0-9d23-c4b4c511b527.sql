
-- QR Pay API Keys
CREATE TABLE IF NOT EXISTS public.qr_pay_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  last4 TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:qr','read:tx','create:checkout']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qrpay_api_keys_user ON public.qr_pay_api_keys(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qrpay_api_keys_prefix ON public.qr_pay_api_keys(key_prefix);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_pay_api_keys TO authenticated;
GRANT ALL ON public.qr_pay_api_keys TO service_role;
ALTER TABLE public.qr_pay_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qrpay_api_keys_select_own" ON public.qr_pay_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "qrpay_api_keys_insert_own" ON public.qr_pay_api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qrpay_api_keys_update_own" ON public.qr_pay_api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "qrpay_api_keys_delete_own" ON public.qr_pay_api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- QR Pay API Logs
CREATE TABLE IF NOT EXISTS public.qr_pay_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.qr_pay_api_keys(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INT NOT NULL DEFAULT 200,
  ip_address TEXT,
  qr_pay_token TEXT,
  latency_ms INT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qrpay_api_logs_user ON public.qr_pay_api_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qrpay_api_logs_key ON public.qr_pay_api_logs(api_key_id, created_at DESC);

GRANT SELECT ON public.qr_pay_api_logs TO authenticated;
GRANT ALL ON public.qr_pay_api_logs TO service_role;
ALTER TABLE public.qr_pay_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qrpay_api_logs_select_own" ON public.qr_pay_api_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.qr_pay_api_keys_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_qrpay_api_keys_touch ON public.qr_pay_api_keys;
CREATE TRIGGER trg_qrpay_api_keys_touch BEFORE UPDATE ON public.qr_pay_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.qr_pay_api_keys_touch();

-- Create key RPC (returns the plain secret once)
CREATE OR REPLACE FUNCTION public.qr_pay_api_create_key(
  p_name TEXT,
  p_scopes TEXT[] DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, api_key TEXT, key_prefix TEXT, last4 TEXT, scopes TEXT[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_secret TEXT;
  v_prefix TEXT;
  v_last4 TEXT;
  v_hash TEXT;
  v_id UUID;
  v_full TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  v_prefix := 'qpk_live_' || substr(encode(gen_random_bytes(4),'hex'),1,8);
  v_secret := encode(gen_random_bytes(24),'hex');
  v_full := v_prefix || '_' || v_secret;
  v_last4 := right(v_secret, 4);
  v_hash := encode(digest(v_full, 'sha256'), 'hex');

  INSERT INTO public.qr_pay_api_keys(user_id, name, key_prefix, key_hash, last4, scopes)
  VALUES (v_uid, p_name, v_prefix, v_hash, v_last4,
          COALESCE(p_scopes, ARRAY['read:qr','read:tx','create:checkout']::TEXT[]))
  RETURNING qr_pay_api_keys.id INTO v_id;

  RETURN QUERY SELECT v_id, p_name, v_full, v_prefix, v_last4,
                      COALESCE(p_scopes, ARRAY['read:qr','read:tx','create:checkout']::TEXT[]);
END $$;

GRANT EXECUTE ON FUNCTION public.qr_pay_api_create_key(TEXT, TEXT[]) TO authenticated;

-- Revoke key
CREATE OR REPLACE FUNCTION public.qr_pay_api_revoke_key(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.qr_pay_api_keys
     SET is_active = FALSE, revoked_at = now()
   WHERE id = p_id AND user_id = v_uid;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.qr_pay_api_revoke_key(UUID) TO authenticated;

-- Stats RPC
CREATE OR REPLACE FUNCTION public.qr_pay_api_stats()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT jsonb_build_object(
    'total_keys', (SELECT count(*) FROM public.qr_pay_api_keys WHERE user_id = v_uid),
    'active_keys', (SELECT count(*) FROM public.qr_pay_api_keys WHERE user_id = v_uid AND is_active),
    'calls_24h', (SELECT count(*) FROM public.qr_pay_api_logs WHERE user_id = v_uid AND created_at > now() - interval '24 hours'),
    'calls_7d', (SELECT count(*) FROM public.qr_pay_api_logs WHERE user_id = v_uid AND created_at > now() - interval '7 days'),
    'avg_latency_ms', (SELECT COALESCE(round(avg(latency_ms))::int, 0) FROM public.qr_pay_api_logs WHERE user_id = v_uid AND created_at > now() - interval '24 hours'),
    'error_rate', (SELECT CASE WHEN count(*) = 0 THEN 0 ELSE round(100.0 * count(*) FILTER (WHERE status_code >= 400) / count(*), 2) END FROM public.qr_pay_api_logs WHERE user_id = v_uid AND created_at > now() - interval '24 hours'),
    'series', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'calls', c) ORDER BY d), '[]'::jsonb)
      FROM (
        SELECT date_trunc('day', created_at)::date AS d, count(*) AS c
        FROM public.qr_pay_api_logs
        WHERE user_id = v_uid AND created_at > now() - interval '14 days'
        GROUP BY 1
      ) x
    )
  ) INTO v_result;
  RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.qr_pay_api_stats() TO authenticated;
