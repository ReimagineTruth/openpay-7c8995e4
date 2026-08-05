// QR Pay → OpenPay Pro settlement.
// Called after a QR Pay checkout succeeds. Credits the merchant's OpenPay Pro
// wallet (@username / 0x address) via the Pro inbound partner API.
// Idempotent on the QR Pay transaction id (openpay_tx_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_INBOUND_URLS = [
  "https://openpaypro.space/api/public/openpay/inbound",
  "https://openpaypromainnet.lovable.app/api/public/openpay/inbound",
];

const PRO_WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const inboundUrls = () => {
  const configured = (Deno.env.get("OPENPAY_PRO_INBOUND_URL") || "").trim();
  return [...new Set([configured, ...DEFAULT_INBOUND_URLS].filter(Boolean))];
};

const formatProDestination = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (PRO_WALLET_RE.test(cleaned)) return cleaned.toLowerCase();
  if (/^uid_[a-f0-9-]{8,}$/i.test(cleaned)) return cleaned;
  const username = cleaned.replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9_]{3,32}$/.test(username) ? `@${username}` : "";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase: any = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || "").trim();
    const transactionRef = String(body?.transaction_ref || "").trim();
    if (!token || !transactionRef) {
      return json({ error: "token and transaction_ref are required" }, 400);
    }

    const { data: pay } = await supabase
      .from("qr_payments")
      .select("id, token, pro_settlement_to, merchant_user_id")
      .eq("token", token)
      .maybeSingle();
    if (!pay) return json({ error: "QR payment not found" }, 404);

    const destination = formatProDestination(pay.pro_settlement_to || "");
    if (!destination) return json({ settled: false, reason: "no_pro_destination" });

    const { data: tx } = await supabase
      .from("qr_payment_transactions")
      .select("id, amount, status, payer_username, payer_name, pro_settled_at, qr_payment_id")
      .eq("transaction_ref", transactionRef)
      .maybeSingle();
    if (!tx || tx.qr_payment_id !== pay.id) return json({ error: "Transaction not found" }, 404);
    if (tx.status !== "succeeded") return json({ error: "Transaction is not paid" }, 400);
    if (tx.pro_settled_at) {
      return json({ settled: true, already: true, to: destination, openpay_tx_id: tx.id });
    }

    const apiKey = (
      Deno.env.get("OPENPAY_PRO_PARTNER_API_KEY") ||
      Deno.env.get("OPENPAY_PARTNER_API_KEY") ||
      ""
    ).trim();
    if (!apiKey) return json({ error: "OpenPay Pro partner API key is not configured" }, 500);

    const ref = `r_${String(transactionRef).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24)}`;
    const note = `pro_xfer:${destination}:${ref}`;
    const amount = Number(Number(tx.amount).toFixed(2));
    const fromUsername = tx.payer_username || tx.payer_name || null;

    let lastError = "OpenPay Pro inbound failed";
    let lastStatus = 502;

    for (const url of inboundUrls()) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: destination,
            amount,
            openpay_tx_id: tx.id,
            note,
            from_username: fromUsername,
          }),
        });
        const raw = await response.text();
        let payload: Record<string, unknown> = {};
        try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { raw }; }

        if (response.ok) {
          await supabase
            .from("qr_payment_transactions")
            .update({
              pro_settlement_to: destination,
              pro_settlement_status: "credited",
              pro_settlement_error: null,
              pro_settled_at: new Date().toISOString(),
            })
            .eq("id", tx.id);
          return json({ settled: true, to: destination, amount, note, openpay_tx_id: tx.id, pro: payload });
        }

        lastStatus = response.status;
        lastError =
          (typeof payload.error === "string" && payload.error) ||
          (typeof payload.message === "string" && payload.message) ||
          `OpenPay Pro inbound failed (${response.status})`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "OpenPay Pro inbound network error";
      }
    }

    await supabase
      .from("qr_payment_transactions")
      .update({
        pro_settlement_to: destination,
        pro_settlement_status: "failed",
        pro_settlement_error: lastError,
      })
      .eq("id", tx.id);

    console.error(`qr-pay-pro-settle failed [${lastStatus}]: ${lastError}`);
    return json({ settled: false, error: lastError, to: destination, openpay_tx_id: tx.id }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("qr-pay-pro-settle error:", message);
    return json({ error: message }, 500);
  }
});
