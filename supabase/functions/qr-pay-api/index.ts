// QR Pay Public API — for third-party integrations (Stripe / PayPal / Instapay style).
// Authenticated via x-api-key header (qpk_live_... key issued from /qr-pay/api dashboard).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256Hex = async (input: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/qr-pay-api\/?/, "").replace(/\/$/, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Public health endpoint
  if (path === "health" || path === "") {
    return json({
      status: "ok",
      service: "qr-pay-api",
      version: "1.0.0",
      docs: `${url.origin.replace(/\.supabase\.co.*$/, "")}/qr-pay/api`,
      endpoints: [
        "GET  /health",
        "GET  /qr/:token            — read QR pay info (price, items, merchant)",
        "GET  /qr/:token/checkout-url — get hosted checkout URL",
        "POST /checkout-session     — create a checkout session",
        "GET  /transactions         — list your QR Pay transactions",
        "GET  /transactions/:id     — verify a single transaction",
      ],
      timestamp: new Date().toISOString(),
    });
  }

  const apiKey = req.headers.get("x-api-key") || "";
  if (!apiKey || !apiKey.startsWith("qpk_")) {
    return json({ error: "Missing x-api-key header. Get a key at /qr-pay/api" }, 401);
  }
  const prefix = apiKey.split("_").slice(0, 3).join("_"); // qpk_live_XXXXXXXX
  const hash = await sha256Hex(apiKey);

  const { data: key } = await supabase
    .from("qr_pay_api_keys")
    .select("id, user_id, scopes, is_active, key_hash")
    .eq("key_prefix", prefix)
    .maybeSingle();

  if (!key || !key.is_active || key.key_hash !== hash) {
    return json({ error: "Invalid or revoked API key" }, 401);
  }

  await supabase.from("qr_pay_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

  const log = async (status: number, qrToken?: string | null, meta?: unknown) => {
    await supabase.from("qr_pay_api_logs").insert({
      api_key_id: key.id,
      user_id: key.user_id,
      endpoint: path,
      method: req.method,
      status_code: status,
      ip_address: req.headers.get("x-forwarded-for") || "unknown",
      qr_pay_token: qrToken ?? null,
      latency_ms: Date.now() - started,
      meta: meta ? (meta as object) : null,
    });
  };

  try {
    const segs = path.split("/").filter(Boolean);

    // GET /qr/:token
    if (segs[0] === "qr" && segs.length >= 2 && req.method === "GET") {
      const token = segs[1];
      const { data: qr } = await supabase
        .from("qr_payments")
        .select("id, user_id, token, title, description, amount, currency, type, status, image_url, is_public, created_at")
        .eq("token", token)
        .eq("user_id", key.user_id)
        .maybeSingle();
      if (!qr) { await log(404, token); return json({ error: "QR payment not found" }, 404); }
      const { data: items } = await supabase
        .from("qr_payment_items")
        .select("id, name, description, price, quantity, image_url")
        .eq("qr_payment_id", qr.id);

      if (segs[2] === "checkout-url") {
        await log(200, token);
        return json({ token, checkout_url: `${url.origin.replace(/araojncyittkahvvpdrn\.supabase\.co.*/, "")}/qr-pay/${token}` });
      }
      await log(200, token);
      return json({ qr_pay: qr, items: items || [] });
    }

    // POST /checkout-session
    if (segs[0] === "checkout-session" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { qr_pay_token, customer_email, customer_name, success_url, cancel_url } = body || {};
      if (!qr_pay_token) { await log(400); return json({ error: "qr_pay_token required" }, 400); }
      const { data: qr } = await supabase
        .from("qr_payments")
        .select("id, user_id, token, amount, currency, title")
        .eq("token", qr_pay_token)
        .eq("user_id", key.user_id)
        .maybeSingle();
      if (!qr) { await log(404, qr_pay_token); return json({ error: "QR payment not found" }, 404); }
      const checkoutUrl = `https://openpay.lovable.app/qr-pay/${qr_pay_token}` +
        `?email=${encodeURIComponent(customer_email || "")}` +
        `&name=${encodeURIComponent(customer_name || "")}` +
        (success_url ? `&success_url=${encodeURIComponent(success_url)}` : "") +
        (cancel_url ? `&cancel_url=${encodeURIComponent(cancel_url)}` : "");
      await log(200, qr_pay_token, { customer_email });
      return json({
        id: crypto.randomUUID(),
        qr_pay_token,
        amount: qr.amount, currency: qr.currency, title: qr.title,
        checkout_url: checkoutUrl,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }

    // GET /transactions
    if (segs[0] === "transactions" && segs.length === 1 && req.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
      const { data: txs } = await supabase
        .from("qr_payment_transactions")
        .select("id, qr_payment_id, amount, currency, status, payment_method, customer_email, customer_name, created_at")
        .eq("merchant_user_id", key.user_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      await log(200);
      return json({ transactions: txs || [], count: txs?.length || 0 });
    }

    // GET /transactions/:id
    if (segs[0] === "transactions" && segs.length === 2 && req.method === "GET") {
      const { data: tx } = await supabase
        .from("qr_payment_transactions")
        .select("*")
        .eq("id", segs[1])
        .eq("merchant_user_id", key.user_id)
        .maybeSingle();
      if (!tx) { await log(404); return json({ error: "Transaction not found" }, 404); }
      await log(200);
      return json({ transaction: tx });
    }

    // GET /qr (list)
    if (segs[0] === "qr" && segs.length === 1 && req.method === "GET") {
      const { data: list } = await supabase
        .from("qr_payments")
        .select("id, token, title, amount, currency, type, status, created_at")
        .eq("user_id", key.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      await log(200);
      return json({ qr_payments: list || [], count: list?.length || 0 });
    }

    await log(404);
    return json({ error: "Unknown endpoint", path }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    await log(500, null, { error: msg });
    return json({ error: msg }, 500);
  }
});
