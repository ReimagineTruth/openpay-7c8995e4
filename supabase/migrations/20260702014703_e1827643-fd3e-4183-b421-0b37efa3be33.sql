
CREATE TABLE IF NOT EXISTS public.ledger_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['ledger:read']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_api_keys TO authenticated;
GRANT ALL ON public.ledger_api_keys TO service_role;
ALTER TABLE public.ledger_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ledger keys" ON public.ledger_api_keys
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ledger_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  event_types text[] NOT NULL DEFAULT ARRAY['transaction.created','transaction.updated']::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_webhook_endpoints TO authenticated;
GRANT ALL ON public.ledger_webhook_endpoints TO service_role;
ALTER TABLE public.ledger_webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own ledger webhooks" ON public.ledger_webhook_endpoints
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ledger_api_keys_user ON public.ledger_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_webhook_user ON public.ledger_webhook_endpoints(user_id);

CREATE OR REPLACE FUNCTION public.ledger_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ledger_api_keys_updated ON public.ledger_api_keys;
CREATE TRIGGER trg_ledger_api_keys_updated BEFORE UPDATE ON public.ledger_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.ledger_touch_updated_at();

DROP TRIGGER IF EXISTS trg_ledger_webhook_updated ON public.ledger_webhook_endpoints;
CREATE TRIGGER trg_ledger_webhook_updated BEFORE UPDATE ON public.ledger_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.ledger_touch_updated_at();
