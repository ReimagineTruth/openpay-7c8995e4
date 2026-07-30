// MCP connection manager: OAuth 2.1 (DCR + PKCE) connect flow for remote MCP servers,
// scoped to the signed-in OpenPay user.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  discoverOAuth,
  exchangeCode,
  mcpListTools,
  normalizeMcpUrl,
  pkceChallenge,
  randomString,
  registerClient,
} from "../_shared/mcp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SAFE_COLUMNS = "id, name, url, state, auth_url, last_error, created_at, updated_at";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action ?? "list");

    if (action === "list") {
      const { data, error } = await admin
        .from("mcp_connections")
        .select(SAFE_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ items: data ?? [] });
    }

    if (action === "disconnect") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id is required" }, 400);
      const { error } = await admin.from("mcp_connections").delete().eq("id", id).eq("user_id", user.id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "connect") {
      let url: string;
      try {
        url = normalizeMcpUrl(String(body?.url ?? ""));
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }
      const redirectUri = String(body?.redirect_uri ?? "");
      if (!redirectUri.startsWith("https://") && !redirectUri.startsWith("http://localhost")) {
        return json({ error: "A valid redirect_uri is required" }, 400);
      }

      // 1) No-auth server? Probe tools directly.
      try {
        const tools = await mcpListTools(url, null);
        const { data, error } = await admin
          .from("mcp_connections")
          .upsert(
            {
              user_id: user.id,
              url,
              name: String(body?.name ?? "").trim() || new URL(url).hostname,
              state: "ready",
              auth_url: null,
              last_error: null,
            },
            { onConflict: "user_id,url" },
          )
          .select(SAFE_COLUMNS)
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ state: "ready", connection: data, tools: tools.map((t) => t.name) });
      } catch (e) {
        if ((e as Error).message !== "unauthorized") {
          return json({ error: (e as Error).message }, 400);
        }
      }

      // 2) OAuth path.
      const { issuer, metadata, resourceName } = await discoverOAuth(url);
      if (!issuer || !metadata) {
        return json({ error: "This MCP server requires authentication but exposes no OAuth metadata." }, 400);
      }

      const clientName = "OpenPay AI";
      let clientId: string;
      let clientSecret: string | null = null;
      try {
        const registered = await registerClient(metadata, redirectUri, clientName);
        clientId = registered.client_id;
        clientSecret = registered.client_secret;
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }

      const codeVerifier = randomString(48);
      const challenge = await pkceChallenge(codeVerifier);
      const oauthState = randomString(24);

      const { data: row, error } = await admin
        .from("mcp_connections")
        .upsert(
          {
            user_id: user.id,
            url,
            name: String(body?.name ?? "").trim() || resourceName || new URL(url).hostname,
            state: "authenticating",
            issuer,
            client_id: clientId,
            client_secret: clientSecret,
            code_verifier: codeVerifier,
            oauth_state: oauthState,
            access_token: null,
            refresh_token: null,
            expires_at: null,
            last_error: null,
          },
          { onConflict: "user_id,url" },
        )
        .select("id")
        .single();
      if (error) return json({ error: error.message }, 500);

      const authUrl = new URL(metadata.authorization_endpoint);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("state", oauthState);
      authUrl.searchParams.set("code_challenge", challenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("resource", url);
      const scopes: string[] = metadata.scopes_supported ?? [];
      if (scopes.length) authUrl.searchParams.set("scope", scopes.filter((s) => s !== "phone").join(" "));

      await admin.from("mcp_connections").update({ auth_url: authUrl.toString() }).eq("id", row.id);
      return json({ state: "authenticating", id: row.id, authUrl: authUrl.toString() });
    }

    if (action === "complete") {
      const code = String(body?.code ?? "");
      const stateParam = String(body?.state ?? "");
      const redirectUri = String(body?.redirect_uri ?? "");
      if (!code || !stateParam) return json({ error: "code and state are required" }, 400);

      const { data: conn } = await admin
        .from("mcp_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("oauth_state", stateParam)
        .maybeSingle();
      if (!conn) return json({ error: "Unknown or expired authorization request" }, 400);

      const { metadata } = await discoverOAuth(conn.url);
      if (!metadata) return json({ error: "Could not load authorization server metadata" }, 400);

      try {
        const tokens = await exchangeCode({
          metadata,
          code,
          redirectUri,
          clientId: conn.client_id!,
          clientSecret: conn.client_secret,
          codeVerifier: conn.code_verifier!,
          resource: conn.url,
        });
        const expiresAt = tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
          : null;
        await admin
          .from("mcp_connections")
          .update({
            state: "ready",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? conn.refresh_token,
            expires_at: expiresAt,
            oauth_state: null,
            auth_url: null,
            last_error: null,
          })
          .eq("id", conn.id);

        let toolNames: string[] = [];
        try {
          toolNames = (await mcpListTools(conn.url, tokens.access_token)).map((t) => t.name);
        } catch (_) { /* tools probe is best-effort */ }
        return json({ state: "ready", id: conn.id, name: conn.name, tools: toolNames });
      } catch (e) {
        const message = (e as Error).message;
        await admin.from("mcp_connections").update({ state: "failed", last_error: message }).eq("id", conn.id);
        return json({ error: message }, 400);
      }
    }

    if (action === "tools") {
      const { data: conns } = await admin
        .from("mcp_connections")
        .select("id, name, url, access_token")
        .eq("user_id", user.id)
        .eq("state", "ready");
      const out: Array<{ id: string; name: string; tools: string[]; error?: string }> = [];
      for (const c of conns ?? []) {
        try {
          const tools = await mcpListTools(c.url, c.access_token);
          out.push({ id: c.id, name: c.name, tools: tools.map((t) => t.name) });
        } catch (e) {
          out.push({ id: c.id, name: c.name, tools: [], error: (e as Error).message });
        }
      }
      return json({ items: out });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error("mcp-connections error", e);
    return json({ error: (e as Error).message ?? "Unexpected error" }, 500);
  }
});
