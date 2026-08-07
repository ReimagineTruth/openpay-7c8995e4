// QR Pay Public API — for third-party integrations (Stripe / PayPal style).
// Authenticated via x-api-key header (qpk_live_... key issued from /qr-pay/api dashboard).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = Deno.env.get("OPENPAY_PUBLIC_SITE_URL") || "https://openpy.space";

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

const hostedCheckoutUrl = (
  token: string,
  opts?: {
    email?: string;
    name?: string;
    success_url?: string;
    cancel_url?: string;
  },
) => {
  const u = new URL(`${SITE}/qr-pay/${encodeURIComponent(token)}`);
  if (opts?.email) u.searchParams.set("email", opts.email);
  if (opts?.name) u.searchParams.set("name", opts.name);
  if (opts?.success_url) u.searchParams.set("success_url", opts.success_url);
  if (opts?.cancel_url) u.searchParams.set("cancel_url", opts.cancel_url);
  return u.toString();
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
      version: "1.1.0",
      docs: `${SITE}/qr-pay/api`,
      site: SITE,
      endpoints: [
        "GET  /health",
        "GET  /qr",
        "GET  /qr/:token",
        "GET  /qr/:token/checkout-url",
        "POST /checkout-session",
        "GET  /transactions",
        "GET  /transactions/:id",
        "GET  /transactions/by-ref/:transaction_ref",
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
        .select(
          "id, merchant_user_id, token, title, description, total, subtotal, currency, payment_type, status, cover_image_url, reusable, allow_custom_amount, min_amount, suggested_amount, created_at",
        )
        .eq("token", token)
        .eq("merchant_user_id", key.user_id)
        .maybeSingle();
      if (!qr) {
        await log(404, token);
        return json({ error: "QR payment not found" }, 404);
      }
      const { data: items } = await supabase
        .from("qr_payment_items")
        .select("id, name, description, unit_price, quantity, line_total, image_url")
        .eq("qr_payment_id", qr.id)
        .order("position", { ascending: true });

      const shaped = {
        ...qr,
        amount: qr.total,
        type: qr.payment_type,
        image_url: qr.cover_image_url,
        user_id: qr.merchant_user_id,
      };

      if (segs[2] === "checkout-url") {
        await log(200, token);
        return json({ token, checkout_url: hostedCheckoutUrl(token) });
      }
      await log(200, token);
      return json({
        qr_pay: shaped,
        items: (items || []).map((it: any) => ({
          ...it,
          price: it.unit_price,
        })),
      });
    }

    // POST /checkout-session
    if (segs[0] === "checkout-session" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const { qr_pay_token, customer_email, customer_name, success_url, cancel_url } = body || {};
      if (!qr_pay_token) {
        await log(400);
        return json({ error: "qr_pay_token required" }, 400);
      }
      const { data: qr } = await supabase
        .from("qr_payments")
        .select("id, merchant_user_id, token, total, currency, title, status")
        .eq("token", qr_pay_token)
        .eq("merchant_user_id", key.user_id)
        .maybeSingle();
      if (!qr) {
        await log(404, qr_pay_token);
        return json({ error: "QR payment not found" }, 404);
      }
      if (qr.status !== "active") {
        await log(400, qr_pay_token);
        return json({ error: "QR payment is not active" }, 400);
      }

      const checkoutUrl = hostedCheckoutUrl(String(qr_pay_token), {
        email: customer_email ? String(customer_email) : undefined,
        name: customer_name ? String(customer_name) : undefined,
        success_url: success_url ? String(success_url) : undefined,
        cancel_url: cancel_url ? String(cancel_url) : undefined,
      });
      await log(200, qr_pay_token, { customer_email });
      return json({
        id: crypto.randomUUID(),
        qr_pay_token,
        amount: qr.total,
        currency: qr.currency,
        title: qr.title,
        checkout_url: checkoutUrl,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    }

    // GET /transactions/by-ref/:ref
    if (segs[0] === "transactions" && segs[1] === "by-ref" && segs[2] && req.method === "GET") {
      const ref = decodeURIComponent(segs[2]);
      const { data: tx } = await supabase
        .from("qr_payment_transactions")
        .select(
          "id, qr_payment_id, amount, currency, status, method, payer_email, payer_name, transaction_ref, paid_at, created_at",
        )
        .eq("merchant_user_id", key.user_id)
        .eq("transaction_ref", ref)
        .maybeSingle();
      if (!tx) {
        await log(404);
        return json({ error: "Transaction not found" }, 404);
      }
      await log(200);
      return json({
        transaction: {
          ...tx,
          payment_method: tx.method,
          customer_email: tx.payer_email,
          customer_name: tx.payer_name,
        },
      });
    }

    // GET /transactions
    if (segs[0] === "transactions" && segs.length === 1 && req.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
      const { data: txs } = await supabase
        .from("qr_payment_transactions")
        .select(
          "id, qr_payment_id, amount, currency, status, method, payer_email, payer_name, transaction_ref, paid_at, created_at",
        )
        .eq("merchant_user_id", key.user_id)
        .order("created_at", { ascending: false })
        .limit(limit);
      await log(200);
      return json({
        transactions: (txs || []).map((t: any) => ({
          ...t,
          payment_method: t.method,
          customer_email: t.payer_email,
          customer_name: t.payer_name,
        })),
        count: txs?.length || 0,
      });
    }

    // GET /transactions/:id
    if (segs[0] === "transactions" && segs.length === 2 && req.method === "GET") {
      const { data: tx } = await supabase
        .from("qr_payment_transactions")
        .select("*")
        .eq("id", segs[1])
        .eq("merchant_user_id", key.user_id)
        .maybeSingle();
      if (!tx) {
        await log(404);
        return json({ error: "Transaction not found" }, 404);
      }
      await log(200);
      return json({
        transaction: {
          ...tx,
          payment_method: tx.method,
          customer_email: tx.payer_email,
          customer_name: tx.payer_name,
        },
      });
    }

    // GET /qr (list)
    if (segs[0] === "qr" && segs.length === 1 && req.method === "GET") {
      const { data: list } = await supabase
        .from("qr_payments")
        .select("id, token, title, total, currency, payment_type, status, created_at")
        .eq("merchant_user_id", key.user_id)
        .order("created_at", { ascending: false })
        .limit(100);
      await log(200);
      return json({
        qr_payments: (list || []).map((q: any) => ({
          ...q,
          amount: q.total,
          type: q.payment_type,
        })),
        count: list?.length || 0,
      });
    }

    await log(404);
    return json({ error: "Unknown endpoint", path }, 404);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    await log(500, null, { error: msg });
    return json({ error: msg }, 500);
  }
});
