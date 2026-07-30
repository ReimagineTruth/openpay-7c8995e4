// Shared helpers for talking to remote MCP servers (Streamable HTTP + OAuth 2.1).

export type McpConnectionRow = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  state: string;
  issuer: string | null;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};

export function normalizeMcpUrl(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== "https:") throw new Error("Only https:// MCP server URLs are allowed");
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function discoverOAuth(mcpUrl: string) {
  const origin = new URL(mcpUrl).origin;
  const prmCandidates = [
    `${origin}/.well-known/oauth-protected-resource${new URL(mcpUrl).pathname}`,
    `${origin}/.well-known/oauth-protected-resource`,
  ];
  let issuer: string | null = null;
  let resourceName: string | null = null;
  for (const candidate of prmCandidates) {
    try {
      const res = await fetch(candidate, { redirect: "error" });
      if (!res.ok) continue;
      const prm = await res.json();
      issuer = prm?.authorization_servers?.[0] ?? null;
      resourceName = prm?.resource_name ?? null;
      if (issuer) break;
    } catch (_) {
      // try next candidate
    }
  }
  if (!issuer) return { issuer: null, metadata: null, resourceName };

  const issuerUrl = new URL(issuer);
  const metaCandidates = [
    `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerUrl.pathname.replace(/\/$/, "")}`,
    `${issuer.replace(/\/$/, "")}/.well-known/oauth-authorization-server`,
    `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
  ];
  for (const candidate of metaCandidates) {
    try {
      const res = await fetch(candidate, { redirect: "error" });
      if (!res.ok) continue;
      const metadata = await res.json();
      if (metadata?.authorization_endpoint && metadata?.token_endpoint) {
        return { issuer, metadata, resourceName };
      }
    } catch (_) {
      // try next candidate
    }
  }
  return { issuer, metadata: null, resourceName };
}

export async function registerClient(
  metadata: any,
  redirectUri: string,
  clientName: string,
): Promise<{ client_id: string; client_secret: string | null }> {
  const endpoint = metadata?.registration_endpoint;
  if (!endpoint) throw new Error("MCP authorization server does not support dynamic client registration");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.client_id) {
    throw new Error(data?.error_description || data?.error || `Client registration failed (${res.status})`);
  }
  return { client_id: data.client_id, client_secret: data.client_secret ?? null };
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(len = 48) {
  return base64url(crypto.getRandomValues(new Uint8Array(len)));
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export async function exchangeCode(opts: {
  metadata: any;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string | null;
  codeVerifier: string;
  resource?: string;
}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
    code_verifier: opts.codeVerifier,
  });
  if (opts.clientSecret) body.set("client_secret", opts.clientSecret);
  if (opts.resource) body.set("resource", opts.resource);
  const res = await fetch(opts.metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Token exchange failed (${res.status})`);
  }
  return data as { access_token: string; refresh_token?: string; expires_in?: number };
}

export async function refreshToken(opts: {
  tokenEndpoint: string;
  refreshToken: string;
  clientId: string;
  clientSecret?: string | null;
}) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: opts.refreshToken,
    client_id: opts.clientId,
  });
  if (opts.clientSecret) body.set("client_secret", opts.clientSecret);
  const res = await fetch(opts.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Token refresh failed (${res.status})`);
  }
  return data as { access_token: string; refresh_token?: string; expires_in?: number };
}

/** JSON-RPC call against a Streamable HTTP MCP endpoint. */
export async function mcpRpc(url: string, accessToken: string | null, method: string, params?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Required by the MCP Streamable HTTP spec — servers 406 without it.
      Accept: "application/json, text/event-stream",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params: params ?? {} }),
  });

  const text = await res.text();
  if (res.status === 401) throw new Error("unauthorized");
  let payload: any = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        try {
          const parsed = JSON.parse(line.slice(5).trim());
          if (parsed?.result || parsed?.error) payload = parsed;
        } catch (_) { /* ignore */ }
      }
    }
  } else {
    try { payload = JSON.parse(text); } catch (_) { /* ignore */ }
  }
  if (!res.ok && !payload) throw new Error(`MCP request failed (${res.status}): ${text.slice(0, 200)}`);
  if (payload?.error) throw new Error(payload.error.message || "MCP error");
  return payload?.result ?? null;
}

export async function mcpListTools(url: string, accessToken: string | null) {
  const result = await mcpRpc(url, accessToken, "tools/list");
  return (result?.tools ?? []) as Array<{ name: string; description?: string; inputSchema?: any }>;
}

export async function mcpCallTool(url: string, accessToken: string | null, name: string, args: unknown) {
  return await mcpRpc(url, accessToken, "tools/call", { name, arguments: args ?? {} });
}
