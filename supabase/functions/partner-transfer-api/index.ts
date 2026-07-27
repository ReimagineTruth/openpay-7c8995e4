// OpenPay Partner Transfer API
// Public REST API for external wallets/apps to look up accounts and move
// balance in/out of OpenPay. Authenticates via `Authorization: Bearer opk_...`
// (partner API key) issued from /partner-api.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function err(message: string, status = 400, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ error: message, ...extra }), { status, headers: jsonHeaders });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*partner-transfer-api/, "") || "/";

  // Public health/info
  if (req.method === "GET" && (path === "/" || path === "/health")) {
    return ok({
      service: "OpenPay Partner Transfer API",
      version: "1.4.0",
      docs: "https://openpy.space/partner-api",
      auth: [
        "Bearer opk_… — partner API key (debits key owner)",
        "Bearer <OpenPay user JWT> — signed-in session (debits that user; same /me /balance /accounts /transfers routes)",
        "Bearer opa_… — Connect grant (/user/* only)",
      ],
      endpoints: [
        "GET  /health",
        "GET  /me                              — partner app owner (opk_) or signed-in user (JWT)",
        "GET  /accounts/:identifier",
        "GET  /balance",
        "POST /transfers",
        "GET  /transfers?limit=&direction=",
        "POST /charges                         — create a PayButton checkout",
        "GET  /charges/:id                     — check charge status",
        "GET  /charges?limit=&status=          — list charges",
        "POST /charges/:id/cancel              — cancel unpaid charge",
        "POST /oauth/token                     — exchange auth code (Sign in with OpenPay)",
        "GET  /user/me                         — signed-in end user (opa_ token; scope-aware)",
        "GET  /user/balance                    — signed-in end user balance (requires balance scope)",
      ],
    });
  }

  // ----- Connect with OpenPay: token exchange (no opk_ key on Authorization header) -----
  if (req.method === "POST" && path === "/oauth/token") {
    const body = await req.json().catch(() => ({}));
    const grantType = String(body?.grant_type || "");
    const code = String(body?.code || "");
    const redirectUri = String(body?.redirect_uri || "");
    const clientId = String(body?.client_id || "");
    const clientSecret = String(body?.client_secret || "");
    if (grantType !== "authorization_code") return err("unsupported_grant_type", 400);
    if (!code || !redirectUri || !clientId || !clientSecret) return err("invalid_request", 400);
    const secretHash = await sha256Hex(clientSecret);
    const { data: app } = await admin.from("partner_apps")
      .select("id, is_active").eq("id", clientId).eq("key_hash", secretHash).maybeSingle();
    if (!app || !app.is_active) return err("invalid_client", 401);
    const codeHash = await sha256Hex(code);
    const accessToken = "opa_live_" + crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(accessToken);
    const { data: ex, error: exErr } = await admin.rpc("partner_oauth_exchange", {
      p_app_id: app.id, p_code_hash: codeHash, p_redirect_uri: redirectUri,
      p_token_hash: tokenHash, p_ttl_seconds: 60 * 60 * 24 * 30,
    });
    if (exErr) return err(exErr.message, 400);
    const row = Array.isArray(ex) ? ex[0] : ex;
    return ok({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 60 * 60 * 24 * 30,
      scope: row?.scope || "profile balance",
      user_id: row?.user_id,
    });
  }

  // ----- Per-end-user endpoints authenticated with opa_ access token -----
  if (path.startsWith("/user/")) {
    const authHdr = req.headers.get("Authorization") || "";
    const tok = authHdr.startsWith("Bearer ") ? authHdr.slice(7).trim() : "";
    if (!tok.startsWith("opa_")) return err("invalid_token", 401);
    const tHash = await sha256Hex(tok);
    const { data: g } = await admin.from("partner_oauth_grants")
      .select("user_id, scope, access_token_expires_at, revoked_at, partner_app_id")
      .eq("access_token_hash", tHash).maybeSingle();
    if (!g || g.revoked_at || (g.access_token_expires_at && new Date(g.access_token_expires_at) < new Date())) {
      return err("invalid_token", 401);
    }
    if (req.method === "GET" && path === "/user/me") {
      const scopes = String(g.scope || "")
        .split(/\s+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
      const has = (s: string) => scopes.includes(s);

      if (!has("profile") && !has("balance") && !has("email")) {
        return err("insufficient_scope", 403);
      }

      const { data: p } = await admin.from("profiles")
        .select("id, full_name, username, avatar_url").eq("id", g.user_id).maybeSingle();

      const body: Record<string, unknown> = {
        user_id: p?.id || g.user_id,
        scope: g.scope,
      };

      if (has("profile")) {
        body.account_number = p?.id ? "OP" + String(p.id).replace(/-/g, "").toUpperCase() : null;
        body.full_name = p?.full_name ?? null;
        body.username = p?.username ?? null;
        body.avatar_url = p?.avatar_url ?? null;
      }

      if (has("email")) {
        try {
          const authAdmin = admin.auth.admin as unknown as {
            getUserById: (id: string) => Promise<{ data?: { user?: { email?: string | null } | null } | null }>;
          };
          const authUser = await authAdmin.getUserById(g.user_id);
          body.email = authUser?.data?.user?.email ?? null;
        } catch {
          body.email = null;
        }
      }

      if (has("balance")) {
        const { data: w } = await admin.from("wallets").select("balance").eq("user_id", g.user_id).maybeSingle();
        body.balance = Number(w?.balance ?? 0);
        body.currency = "OUSD";
      }

      return ok(body);
    }
    if (req.method === "GET" && path === "/user/balance") {
      const scopes = String(g.scope || "")
        .split(/\s+/)
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!scopes.includes("balance")) return err("insufficient_scope", 403);
      const { data: w } = await admin.from("wallets").select("balance, updated_at").eq("user_id", g.user_id).maybeSingle();
      return ok({ balance: Number(w?.balance ?? 0), currency: "OUSD", updated_at: w?.updated_at ?? null });
    }
    return err("Not found", 404);
  }

  // Auth header for Partner API key OR connected OpenPay user session (JWT)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return err("Missing Authorization. Use `Bearer opk_...` or a signed-in OpenPay session.", 401);
  }

  // ----- Connected OpenPay account (user JWT) — same docs routes for in-app AI / Connect -----
  if (!token.startsWith("opk_") && !token.startsWith("opa_")) {
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return err("Unauthorized. Use a valid OpenPay session or `Bearer opk_...` API key.", 401);
    }
    const userId = userData.user.id;

    try {
      if (req.method === "GET" && path === "/me") {
        const { data: profile } = await admin
          .from("profiles").select("id, full_name, username, avatar_url").eq("id", userId).maybeSingle();
        const { data: wallet } = await admin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
        return ok({
          partner_app: null,
          auth: "user_session",
          account: profile ? {
            user_id: profile.id,
            account_number: "OP" + String(profile.id).replace(/-/g, "").toUpperCase(),
            full_name: profile.full_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
            balance: Number(wallet?.balance ?? 0),
            currency: "OUSD",
          } : null,
        });
      }

      if (req.method === "GET" && path === "/balance") {
        const { data: wallet } = await admin.from("wallets").select("balance, updated_at").eq("user_id", userId).maybeSingle();
        return ok({ balance: Number(wallet?.balance ?? 0), currency: "OUSD", updated_at: wallet?.updated_at ?? null });
      }

      const accountMatchUser = path.match(/^\/accounts\/(.+)$/);
      if (req.method === "GET" && accountMatchUser) {
        const identifier = decodeURIComponent(accountMatchUser[1]);
        const { data, error } = await admin.rpc("partner_lookup_account", { p_identifier: identifier });
        if (error) return err(error.message, 500);
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return err("Account not found", 404);
        return ok({
          user_id: row.user_id,
          account_number: row.account_number,
          full_name: row.full_name,
          username: row.username,
          avatar_url: row.avatar_url,
          currency: row.currency || "OUSD",
        });
      }

      if (req.method === "POST" && path === "/transfers") {
        const body = await req.json().catch(() => ({}));
        const to = String(body?.to ?? body?.recipient ?? "").trim();
        const amount = Number(body?.amount);
        const note = String(body?.note ?? "OpenPay AI transfer").slice(0, 200);
        const idem = req.headers.get("Idempotency-Key") || body?.idempotency_key || crypto.randomUUID();
        if (!to) return err("`to` (account_number | @username | email) is required");
        if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be > 0");

        // Resolve recipient the same way as Partner API docs
        const { data: lookup, error: lookupErr } = await admin.rpc("partner_lookup_account", { p_identifier: to });
        if (lookupErr) return err(lookupErr.message, 500);
        const recipient = Array.isArray(lookup) ? lookup[0] : lookup;
        if (!recipient?.user_id) return err("Account not found", 404);
        if (recipient.user_id === userId) return err("Cannot transfer to self", 400);

        // Prefer rich transfer_funds, then 4-arg fallback (same as Express Send)
        let txId: string | null = null;
        let transferErr: string | null = null;

        const rich = await admin.rpc("transfer_funds", {
          p_sender_id: userId,
          p_receiver_id: recipient.user_id,
          p_amount: amount,
          p_note: note,
          p_currency_code: "OUSD",
          p_sender_amount: amount,
          p_sender_currency_code: "OUSD",
          p_receiver_amount: amount,
          p_receiver_currency_code: "OUSD",
        });
        if (!rich.error && rich.data) {
          txId = String(rich.data);
        } else {
          const legacy = await admin.rpc("transfer_funds", {
            p_sender_id: userId,
            p_receiver_id: recipient.user_id,
            p_amount: amount,
            p_note: note,
          });
          if (legacy.error || !legacy.data) {
            transferErr = legacy.error?.message || rich.error?.message || "Transfer failed";
          } else {
            txId = String(legacy.data);
          }
        }

        if (!txId) return err(transferErr || "Transfer failed", 400);

        const { data: wallet } = await admin.from("wallets").select("balance").eq("user_id", userId).maybeSingle();
        return ok({
          transfer_id: idem,
          transaction_id: txId,
          recipient_user_id: recipient.user_id,
          recipient_username: recipient.username || null,
          sender_balance: Number(wallet?.balance ?? 0),
          currency: "OUSD",
          status: "completed",
          auth: "user_session",
        }, 201);
      }

      return err("Not found", 404);
    } catch (e) {
      console.error("partner-transfer-api user session error", e);
      return err(String((e as Error)?.message || e), 500);
    }
  }

  // Auth: partner API key (opk_live_…)
  if (!token.startsWith("opk_")) {
    return err("Missing or invalid API key. Use `Authorization: Bearer opk_...`", 401);
  }
  const hash = await sha256Hex(token);
  const { data: appRow } = await admin
    .from("partner_apps")
    .select("id, owner_user_id, name, is_active, allowed_origins")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!appRow || !appRow.is_active) return err("API key not recognized or revoked", 401);

  // Optional origin check
  const origin = req.headers.get("origin") || "";
  if (appRow.allowed_origins?.length && origin && !appRow.allowed_origins.includes(origin)) {
    return err("Origin not allowed for this partner app", 403);
  }

  await admin.from("partner_apps").update({ last_used_at: new Date().toISOString() }).eq("id", appRow.id);
  const ownerId = appRow.owner_user_id as string;

  try {
    // /me
    if (req.method === "GET" && path === "/me") {
      const { data: profile } = await admin
        .from("profiles").select("id, full_name, username, avatar_url").eq("id", ownerId).maybeSingle();
      const { data: wallet } = await admin.from("wallets").select("balance").eq("user_id", ownerId).maybeSingle();
      return ok({
        partner_app: { id: appRow.id, name: appRow.name },
        account: profile ? {
          user_id: profile.id,
          account_number: "OP" + String(profile.id).replace(/-/g, "").toUpperCase(),
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          balance: Number(wallet?.balance ?? 0),
          currency: "OUSD",
        } : null,
      });
    }

    // /balance
    if (req.method === "GET" && path === "/balance") {
      const { data: wallet } = await admin.from("wallets").select("balance, updated_at").eq("user_id", ownerId).maybeSingle();
      return ok({ balance: Number(wallet?.balance ?? 0), currency: "OUSD", updated_at: wallet?.updated_at ?? null });
    }

    // /accounts/:identifier
    const accountMatch = path.match(/^\/accounts\/(.+)$/);
    if (req.method === "GET" && accountMatch) {
      const identifier = decodeURIComponent(accountMatch[1]);
      const { data, error } = await admin.rpc("partner_lookup_account", { p_identifier: identifier });
      if (error) return err(error.message, 500);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return err("Account not found", 404);
      return ok({
        user_id: row.user_id,
        account_number: row.account_number,
        full_name: row.full_name,
        username: row.username,
        avatar_url: row.avatar_url,
        currency: row.currency,
      });
    }

    // /transfers
    if (req.method === "GET" && path === "/transfers") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const direction = url.searchParams.get("direction");
      let q = admin.from("partner_transfers")
        .select("id, direction, counterparty_user_id, counterparty_identifier, amount, currency, note, status, transaction_id, created_at")
        .eq("partner_app_id", appRow.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (direction === "debit" || direction === "credit") q = q.eq("direction", direction);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ data });
    }

    if (req.method === "POST" && path === "/transfers") {
      const body = await req.json().catch(() => ({}));
      const to = String(body?.to ?? body?.recipient ?? "").trim();
      const amount = Number(body?.amount);
      const note = String(body?.note ?? "").slice(0, 200);
      const idem = req.headers.get("Idempotency-Key") || body?.idempotency_key || null;
      if (!to) return err("`to` (account_number | @username | email) is required");
      if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be > 0");

      const { data, error } = await admin.rpc("partner_transfer_send", {
        p_sender_user_id: ownerId,
        p_partner_app_id: appRow.id,
        p_recipient_identifier: to,
        p_amount: amount,
        p_note: note,
        p_idempotency_key: idem,
      });
      if (error) return err(error.message, 400);
      const row = Array.isArray(data) ? data[0] : data;
      return ok({
        transfer_id: row?.transfer_id,
        transaction_id: row?.transaction_id,
        recipient_user_id: row?.recipient_user_id,
        sender_balance: Number(row?.sender_balance ?? 0),
        currency: "OUSD",
        status: row?.status,
      }, 201);
    }

    // POST /charges — create a PayButton checkout session
    if (req.method === "POST" && path === "/charges") {
      const body = await req.json().catch(() => ({}));
      const amount = Number(body?.amount);
      const currency = String(body?.currency || "OUSD").toUpperCase();
      const description = String(body?.description ?? "").slice(0, 300);
      const reference = String(body?.reference ?? "").slice(0, 120);
      const success_url = String(body?.success_url ?? "").slice(0, 500);
      const cancel_url = String(body?.cancel_url ?? "").slice(0, 500);
      const metadata = (body && typeof body.metadata === "object" && body.metadata) || {};
      if (!Number.isFinite(amount) || amount <= 0) return err("`amount` must be > 0");

      // Direct insert avoids ambiguous expires_at bug in partner_charge_create RPC
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const { data: inserted, error } = await admin
        .from("partner_charges")
        .insert({
          partner_app_id: appRow.id,
          owner_user_id: ownerId,
          amount,
          currency,
          description: description || null,
          reference: reference || null,
          success_url: success_url || null,
          cancel_url: cancel_url || null,
          metadata,
          expires_at: expiresAt,
          status: "created",
        })
        .select("id, expires_at")
        .single();

      if (error) return err(error.message, 400);
      const chargeId = inserted?.id;
      return ok({
        id: chargeId,
        amount, currency, description, reference,
        status: "created",
        expires_at: inserted?.expires_at || expiresAt,
        checkout_url: `https://openpy.space/paybutton/${chargeId}`,
        success_url: success_url || null,
        cancel_url: cancel_url || null,
      }, 201);
    }

    // GET /charges/:id
    const chargeMatch = path.match(/^\/charges\/([0-9a-fA-F-]{36})$/);
    if (req.method === "GET" && chargeMatch) {
      const { data, error } = await admin
        .from("partner_charges")
        .select("id, amount, currency, description, reference, status, buyer_user_id, transaction_id, paid_at, expires_at, success_url, cancel_url, metadata, created_at")
        .eq("id", chargeMatch[1])
        .eq("partner_app_id", appRow.id)
        .maybeSingle();
      if (error) return err(error.message, 500);
      if (!data) return err("Charge not found", 404);
      return ok({ ...data, checkout_url: `https://openpy.space/paybutton/${data.id}` });
    }

    // POST /charges/:id/cancel
    const cancelMatch = path.match(/^\/charges\/([0-9a-fA-F-]{36})\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const { data: row } = await admin
        .from("partner_charges")
        .select("id, status")
        .eq("id", cancelMatch[1])
        .eq("partner_app_id", appRow.id)
        .maybeSingle();
      if (!row) return err("Charge not found", 404);
      if (row.status !== "created") return err(`Charge is ${row.status}`, 400);
      const { error } = await admin.from("partner_charges").update({ status: "canceled" }).eq("id", row.id);
      if (error) return err(error.message, 500);
      return ok({ id: row.id, status: "canceled" });
    }

    // GET /charges
    if (req.method === "GET" && path === "/charges") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const status = url.searchParams.get("status");
      let q = admin.from("partner_charges")
        .select("id, amount, currency, description, reference, status, buyer_user_id, transaction_id, paid_at, expires_at, created_at")
        .eq("partner_app_id", appRow.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return ok({ data });
    }

    return err("Not found", 404);
  } catch (e) {
    return err((e as Error).message || "Internal error", 500);
  }
});
