CREATE TABLE public.pi_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pi_uid TEXT NOT NULL,
  pi_username TEXT NOT NULL,
  linked_via TEXT NOT NULL DEFAULT 'oauth_implicit',
  last_authenticated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (pi_uid)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pi_accounts TO authenticated;
GRANT ALL ON public.pi_accounts TO service_role;

ALTER TABLE public.pi_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pi_accounts link"
  ON public.pi_accounts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_pi_accounts_updated_at
  BEFORE UPDATE ON public.pi_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();