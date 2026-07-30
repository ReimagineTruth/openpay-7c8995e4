CREATE TABLE public.mcp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'authenticating',
  auth_url TEXT,
  issuer TEXT,
  client_id TEXT,
  client_secret TEXT,
  code_verifier TEXT,
  oauth_state TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

GRANT SELECT, DELETE ON public.mcp_connections TO authenticated;
GRANT ALL ON public.mcp_connections TO service_role;

ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own MCP connections"
ON public.mcp_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own MCP connections"
ON public.mcp_connections FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_mcp_connections_user ON public.mcp_connections(user_id);
CREATE INDEX idx_mcp_connections_state ON public.mcp_connections(oauth_state);

CREATE TRIGGER update_mcp_connections_updated_at
BEFORE UPDATE ON public.mcp_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();