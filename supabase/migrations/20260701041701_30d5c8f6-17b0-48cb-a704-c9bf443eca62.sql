CREATE TABLE public.piverify_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  external_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  hosted_flow_url TEXT,
  rejection_reason TEXT,
  allowed_action TEXT,
  last_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.piverify_sessions TO authenticated;
GRANT ALL ON public.piverify_sessions TO service_role;

ALTER TABLE public.piverify_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own piverify sessions"
ON public.piverify_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_piverify_sessions_user ON public.piverify_sessions(user_id);
CREATE INDEX idx_piverify_sessions_ext ON public.piverify_sessions(external_user_id);

CREATE OR REPLACE FUNCTION public.piverify_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_piverify_sessions_updated
BEFORE UPDATE ON public.piverify_sessions
FOR EACH ROW EXECUTE FUNCTION public.piverify_touch_updated_at();