/**
 * Local PayMongo bridge for Vite (dev) when Edge Functions aren't deployed.
 * Mirrors supabase/functions/paymongo-qr-pay using secrets from .env.
 */
import { loadEnv } from "vite";

const PAYMONGO_API = "https://api.paymongo.com/v1";
const DEFAULT_PHP_PER_USD = 57;

const BANK_OPTIONS = {
  bpi: { type: "dob", minPhp: 1 },
  ubp: { type: "dob", minPhp: 1 },
  bdo: { type: "brankas", minPhp: 100 },
  landbank: { type: "brankas", minPhp: 1 },
  metrobank: { type: "brankas", minPhp: 1 },
};

function basicAuth(key) {
  return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
}

async function paymongoFetch(path, { method = "GET", key, body }) {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    method,
    headers: {
      Authorization: basicAuth(key),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail =
      data?.errors?.[0]?.detail ||
      data?.errors?.[0]?.code ||
      data?.error ||
      `PayMongo ${res.status}`;
    throw new Error(String(detail));
  }
  return data;
}

function resolveMethod(method, bankCode) {
  if (method === "qr_ph") {
    return { pmType: "qrph", allowed: ["qrph"], needsReturnUrl: false, deferPm: false, minPhp: 1, allowKey: "allow_qr_ph" };
  }
  if (method === "gcash") {
    return { pmType: "gcash", allowed: ["gcash"], needsReturnUrl: true, deferPm: false, minPhp: 1, allowKey: "allow_gcash" };
  }
  if (method === "maya") {
    return { pmType: "paymaya", allowed: ["paymaya"], needsReturnUrl: true, deferPm: false, minPhp: 1, allowKey: "allow_maya" };
  }
  if (method === "grab_pay") {
    return { pmType: "grab_pay", allowed: ["grab_pay"], needsReturnUrl: true, deferPm: false, minPhp: 1, allowKey: "allow_grab_pay" };
  }
  if (method === "shopee_pay") {
    return {
      pmType: "shopeepay",
      allowed: ["shopeepay"],
      needsReturnUrl: true,
      deferPm: false,
      minPhp: 1,
      allowKey: "allow_shopee_pay",
      attachOptions: { payment_method_options: { shopeepay: { expiry_seconds: 1200 } } },
    };
  }
  if (method === "billease") {
    return { pmType: "billease", allowed: ["billease"], needsReturnUrl: true, deferPm: false, minPhp: 100, allowKey: "allow_billease" };
  }
  if (method === "google_pay") {
    return {
      pmType: "google_pay_card",
      allowed: ["google_pay_card"],
      needsReturnUrl: true,
      deferPm: true,
      minPhp: 1,
      allowKey: "allow_google_pay",
    };
  }
  if (method === "bank") {
    const bank = BANK_OPTIONS[String(bankCode || "").toLowerCase()];
    if (!bank) throw new Error("Select a bank (BPI, UnionBank, BDO, Land Bank, or Metrobank)");
    return {
      pmType: bank.type,
      allowed: [bank.type],
      details: { bank_code: String(bankCode).toLowerCase() },
      needsReturnUrl: true,
      deferPm: false,
      minPhp: bank.minPhp,
      allowKey: "allow_bank",
    };
  }
  throw new Error("method must be qr_ph, gcash, maya, grab_pay, shopee_pay, billease, bank, or google_pay");
}

function toPhpCentavos(amount, currency, minPhp = 1) {
  const cur = String(currency || "").trim().toUpperCase();
  const phpPerUsd = Number(process.env.PAYMONGO_PHP_PER_USD || DEFAULT_PHP_PER_USD) || DEFAULT_PHP_PER_USD;
  const rate = cur === "PHP" || cur === "₱" ? 1 : phpPerUsd;
  const php = Math.max(minPhp, Math.round(Number(amount) * rate * 100) / 100);
  const centavos = Math.max(Math.round(minPhp * 100), Math.round(php * 100));
  return { php, centavos, rate };
}

function supabaseAdmin(env) {
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase URL/key missing in .env");
  return { url, key, isService: !!(env.SUPABASE_SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY) };
}

async function sbFetch(admin, path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: admin.key,
    Authorization: `Bearer ${admin.key}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${admin.url}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || data?.msg || `Supabase ${res.status}`);
  }
  return data;
}

async function handlePaymongo(req, res, env) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const secret = env.PAYMONGO_SECRET_KEY || env.PAYMONGO_SECRET;
  const publicKey = env.PAYMONGO_PUBLIC_KEY || env.PAYMONGO_PK || env.VITE_PAYMONGO_PUBLIC_KEY || "";
  if (!secret) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "PAYMONGO_SECRET_KEY missing in .env" }));
    return;
  }

  const admin = supabaseAdmin(env);
  const action = String(body.action || "create").toLowerCase();

  try {
    if (action === "status" || action === "confirm") {
      const intentId = String(body.intent_id || "").trim();
      const token = String(body.token || "").trim();
      if (!intentId || !token) throw new Error("token and intent_id required");

      const intentRes = await paymongoFetch(`/payment_intents/${intentId}`, { key: secret });
      const attrs = intentRes?.data?.attributes || {};
      const status = String(attrs.status || "");
      const method = String(body.method || attrs.metadata?.qr_method || "qr_ph");

      if (status !== "succeeded") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status, intent_id: intentId, paid: false }));
        return;
      }

      const paymentId = attrs.payments?.[0]?.id || attrs.payments?.[0] || null;

      // Prefer RPC (needs migration). Fallback: mark paid via REST if service role present.
      try {
        const completed = await sbFetch(admin, "/rest/v1/rpc/qr_pay_complete_paymongo", {
          method: "POST",
          body: {
            p_token: token,
            p_method: method,
            p_paymongo_intent_id: intentId,
            p_paymongo_payment_id: paymentId ? String(paymentId) : null,
            p_payer_name: body.payer_name || null,
            p_payer_email: body.payer_email || null,
            p_amount: body.amount != null ? Number(body.amount) : null,
            p_payer_phone: body.payer_phone || null,
            p_delivery_address: body.delivery_address || null,
            p_delivery_notes: body.delivery_notes || null,
            p_payer_user_id: body.payer_user_id || null,
          },
        });
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          status: "succeeded",
          paid: true,
          transaction_ref: completed?.transaction_ref,
          amount: completed?.amount,
          method: completed?.method || method,
        }));
        return;
      } catch (rpcErr) {
        if (!admin.isService) throw rpcErr;
        // service-role fallback insert
        const pays = await sbFetch(
          admin,
          `/rest/v1/qr_payments?token=eq.${encodeURIComponent(token)}&select=*`,
        );
        const pay = Array.isArray(pays) ? pays[0] : null;
        if (!pay) throw new Error("Payment not found");
        const ref = `QRP-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        const amount = body.amount != null ? Number(body.amount) : Number(pay.total);
        await sbFetch(admin, "/rest/v1/qr_payment_transactions", {
          method: "POST",
          prefer: "return=minimal",
          body: {
            qr_payment_id: pay.id,
            merchant_user_id: pay.merchant_user_id,
            payer_name: body.payer_name || null,
            payer_email: body.payer_email || null,
            method,
            amount,
            currency: pay.currency,
            status: "succeeded",
            transaction_ref: ref,
            paid_at: new Date().toISOString(),
            provider_payload: {
              paymongo_intent_id: intentId,
              paymongo_payment_id: paymentId,
              provider: "paymongo",
            },
          },
        });
        if (!pay.reusable) {
          await sbFetch(admin, `/rest/v1/qr_payments?id=eq.${pay.id}`, {
            method: "PATCH",
            prefer: "return=minimal",
            body: { status: "paid" },
          });
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ status: "succeeded", paid: true, transaction_ref: ref, amount, method }));
        return;
      }
    }

    // create
    const token = String(body.token || "").trim();
    const method = String(body.method || "").trim();
    const bankCode = body.bank_code ? String(body.bank_code).trim().toLowerCase() : null;
    const googlePayToken = body.google_pay_token ? String(body.google_pay_token) : "";
    const existingIntentId = body.intent_id ? String(body.intent_id).trim() : "";
    if (!token) throw new Error("token required");
    const resolved = resolveMethod(method, bankCode);

    // Prefer public RPC (same as checkout), then enrich with metadata flags
    let pay = null;
    try {
      pay = await sbFetch(admin, "/rest/v1/rpc/qr_pay_get_by_token", {
        method: "POST",
        body: { p_token: token },
      });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : "Payment not found");
    }
    if (!pay || !pay.id) throw new Error("Payment not found");
    if (pay.status !== "active") throw new Error("Payment is not active");

    let meta = {};
    try {
      const rows = await sbFetch(
        admin,
        `/rest/v1/qr_payments?token=eq.${encodeURIComponent(token)}&select=metadata`,
      );
      meta = (Array.isArray(rows) && rows[0]?.metadata && typeof rows[0].metadata === "object")
        ? rows[0].metadata
        : {};
    } catch {
      meta = {};
    }
    // If metadata isn't readable, trust checkout UI already gated the method
    if (Object.keys(meta).length && !meta[resolved.allowKey]) {
      throw new Error(`${method} is not enabled for this checkout`);
    }
    const chargeAmount = (() => {
      const custom = body.amount != null ? Number(body.amount) : NaN;
      if (pay.allow_custom_amount || ["donation", "tip"].includes(String(pay.payment_type))) {
        if (!Number.isFinite(custom) || custom <= 0) throw new Error("Enter a valid amount");
        return custom;
      }
      return Number(pay.total);
    })();

    const { php, centavos, rate } = toPhpCentavos(chargeAmount, pay.currency, resolved.minPhp);
    const returnUrl = String(body.return_url || "").trim();
    if (resolved.needsReturnUrl && !resolved.deferPm && !returnUrl.startsWith("http")) {
      throw new Error("return_url required for this payment method");
    }
    if (method === "google_pay" && googlePayToken && !returnUrl.startsWith("http")) {
      throw new Error("return_url required for Google Pay");
    }

    // Google Pay attach step
    if (method === "google_pay" && googlePayToken && existingIntentId) {
      if (!publicKey) throw new Error("PAYMONGO_PUBLIC_KEY / VITE_PAYMONGO_PUBLIC_KEY required for Google Pay");
      const billing = {};
      if (body.payer_name) billing.name = String(body.payer_name);
      if (body.payer_email) billing.email = String(body.payer_email);
      if (body.payer_phone) billing.phone = String(body.payer_phone);

      const pmRes = await paymongoFetch("/payment_methods", {
        key: publicKey,
        method: "POST",
        body: {
          data: {
            attributes: {
              type: "google_pay_card",
              details: { token: googlePayToken },
              ...(Object.keys(billing).length ? { billing } : {}),
            },
          },
        },
      });
      const paymentMethodId = pmRes?.data?.id;
      if (!paymentMethodId) throw new Error("PayMongo did not return a Google Pay method");

      const intentLookup = await paymongoFetch(`/payment_intents/${existingIntentId}`, { key: secret });
      const clientKey = intentLookup?.data?.attributes?.client_key;

      const attachRes = await paymongoFetch(`/payment_intents/${existingIntentId}/attach`, {
        key: secret,
        method: "POST",
        body: {
          data: {
            attributes: {
              payment_method: paymentMethodId,
              client_key: clientKey,
              return_url: returnUrl,
            },
          },
        },
      });
      const out = attachRes?.data?.attributes || {};
      const next = out.next_action || {};

      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        intent_id: existingIntentId,
        client_key: clientKey,
        status: out.status || "awaiting_next_action",
        method,
        amount: chargeAmount,
        currency: pay.currency,
        php_amount: php,
        php_rate: rate,
        redirect_url: next?.redirect?.url || null,
        public_key: publicKey,
      }));
      return;
    }

    const intentRes = await paymongoFetch("/payment_intents", {
      key: secret,
      method: "POST",
      body: {
        data: {
          attributes: {
            amount: centavos,
            currency: "PHP",
            payment_method_allowed: resolved.allowed,
            description: `OpenPay QR · ${pay.title || pay.token}`.slice(0, 255),
            statement_descriptor: "OpenPay",
            metadata: {
              qr_token: pay.token,
              qr_payment_id: pay.id,
              qr_method: method,
              bank_code: bankCode || "",
              openpay_amount: String(chargeAmount),
              openpay_currency: String(pay.currency),
              php_amount: String(php),
              php_rate: String(rate),
            },
          },
        },
      },
    });

    const intentId = intentRes?.data?.id;
    const clientKey = intentRes?.data?.attributes?.client_key;
    if (!intentId) throw new Error("PayMongo did not return a payment intent");

    // Google Pay prepare step — client opens Google Pay sheet next
    if (resolved.deferPm && !googlePayToken) {
      if (admin.isService) {
        await sbFetch(admin, `/rest/v1/qr_payments?id=eq.${pay.id}`, {
          method: "PATCH",
          prefer: "return=minimal",
          body: {
            metadata: {
              ...meta,
              paymongo_pending: {
                intent_id: intentId,
                method,
                amount: chargeAmount,
                php_amount: php,
                created_at: new Date().toISOString(),
                payer_name: body.payer_name || null,
                payer_email: body.payer_email || null,
                payer_phone: body.payer_phone || null,
                delivery_address: body.delivery_address || null,
                delivery_notes: body.delivery_notes || null,
              },
            },
          },
        });
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        intent_id: intentId,
        client_key: clientKey,
        status: "awaiting_payment_method",
        method,
        amount: chargeAmount,
        currency: pay.currency,
        php_amount: php,
        php_rate: rate,
        public_key: publicKey || null,
        needs_google_pay_token: true,
      }));
      return;
    }

    const pmAttrs = { type: resolved.pmType };
    if (resolved.details) pmAttrs.details = resolved.details;
    const billing = {};
    if (body.payer_name) billing.name = String(body.payer_name);
    if (body.payer_email) billing.email = String(body.payer_email);
    if (body.payer_phone) billing.phone = String(body.payer_phone);
    if (Object.keys(billing).length) pmAttrs.billing = billing;

    const pmRes = await paymongoFetch("/payment_methods", {
      key: secret,
      method: "POST",
      body: { data: { attributes: pmAttrs } },
    });
    const paymentMethodId = pmRes?.data?.id;
    if (!paymentMethodId) throw new Error("PayMongo did not return a payment method");

    const attachAttrs = {
      payment_method: paymentMethodId,
      client_key: clientKey,
    };
    if (resolved.needsReturnUrl) attachAttrs.return_url = returnUrl;
    if (resolved.attachOptions) Object.assign(attachAttrs, resolved.attachOptions);

    const attachRes = await paymongoFetch(`/payment_intents/${intentId}/attach`, {
      key: secret,
      method: "POST",
      body: { data: { attributes: attachAttrs } },
    });
    const out = attachRes?.data?.attributes || {};
    const next = out.next_action || {};

    if (admin.isService) {
      await sbFetch(admin, `/rest/v1/qr_payments?id=eq.${pay.id}`, {
        method: "PATCH",
        prefer: "return=minimal",
        body: {
          metadata: {
            ...meta,
            paymongo_pending: {
              intent_id: intentId,
              method,
              bank_code: bankCode,
              amount: chargeAmount,
              php_amount: php,
              created_at: new Date().toISOString(),
              payer_name: body.payer_name || null,
              payer_email: body.payer_email || null,
              payer_phone: body.payer_phone || null,
              delivery_address: body.delivery_address || null,
              delivery_notes: body.delivery_notes || null,
            },
          },
        },
      });
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      intent_id: intentId,
      client_key: clientKey,
      status: out.status || "awaiting_next_action",
      method,
      bank_code: bankCode,
      amount: chargeAmount,
      currency: pay.currency,
      php_amount: php,
      php_rate: rate,
      qr_image_url: next?.code?.image_url || null,
      redirect_url: next?.redirect?.url || null,
    }));
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }));
  }
}

/** Vite plugin: POST /api/paymongo-qr-pay + /api/qr-pay-email-receipt */
export function paymongoLocalPlugin() {
  return {
    name: "paymongo-local-api",
    configureServer(server) {
      const env = {
        ...loadEnv(server.config.mode, server.config.root, ""),
        ...process.env,
      };
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0] || "";
        const isPaymongo =
          url === "/api/paymongo-qr-pay" || url === "/functions/v1/paymongo-qr-pay";
        const isEmail =
          url === "/api/qr-pay-email-receipt" || url === "/functions/v1/qr-pay-email-receipt";
        if (!isPaymongo && !isEmail) {
          next();
          return;
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, apikey, x-client-info");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        if (isEmail) {
          await handleEmailReceipt(req, res, env);
          return;
        }
        await handlePaymongo(req, res, env);
      });
    },
  };
}

async function handleEmailReceipt(req, res, env) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  try {
    const admin = supabaseAdmin(env);
    const to = String(body.to || body.email || "").trim().toLowerCase();
    const ref = String(body.transaction_ref || body.ref || "").trim();
    if (!to || !ref) throw new Error("to and transaction_ref required");

    // Prefer SQL RPC (same as production path)
    try {
      const result = await sbFetch(admin, "/rest/v1/rpc/qr_pay_email_receipt", {
        method: "POST",
        body: { p_transaction_ref: ref, p_email: to },
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result?.ok != null ? result : { ok: true, to, ...(result || {}) }));
      return;
    } catch (rpcErr) {
      // Fallback: write outbox directly when RPC isn't migrated yet
      if (!admin.isService) throw rpcErr;
      const rows = await sbFetch(
        admin,
        `/rest/v1/qr_payment_transactions?transaction_ref=eq.${encodeURIComponent(ref)}&status=eq.succeeded&select=*`,
      );
      const tx = Array.isArray(rows) ? rows[0] : null;
      if (!tx) throw new Error("Receipt not found");
      const amountStr = `${tx.currency || "USD"} ${Number(tx.amount || 0).toFixed(2)}`;
      const subject = `Your OpenPay receipt · ${amountStr}`;
      const textBody = [
        "OpenPay Receipt",
        "",
        `Transaction ID: ${tx.transaction_ref}`,
        `Method: ${tx.method}`,
        `Amount: ${amountStr}`,
        "",
        "Thank you for paying with OpenPay.",
      ].join("\n");
      await sbFetch(admin, "/rest/v1/email_notifications_outbox", {
        method: "POST",
        prefer: "return=minimal",
        body: {
          user_id: tx.merchant_user_id,
          to_email: to,
          subject,
          body: textBody,
          status: "pending",
          payload: {
            kind: "qr_pay_customer_receipt",
            ref: tx.transaction_ref,
            provider: "lovable",
            from: "OpenPay Receipts <receipts@notify.openpy.space>",
          },
        },
      });
      try {
        await sbFetch(admin, "/rest/v1/rpc/dispatch_outbox_to_pgmq", {
          method: "POST",
          body: { p_limit: 50 },
        });
      } catch {
        /* cron will pick it up */
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        to,
        from: "OpenPay Receipts <receipts@notify.openpy.space>",
        subject,
      }));
    }
  } catch (e) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : "Unexpected error" }));
  }
}
