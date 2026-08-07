// Push a completed OpenPay transaction into OpenLedger (signed).
// Secret stays server-side: OPENPAY_WEBHOOK_SECRET
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENLEDGER_BASE =
  Deno.env.get("OPENLEDGER_SITE_URL") ||
  "https://openpyledger.space";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function hmacSha256Hex(secret: string, raw: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = (Deno.env.get("OPENPAY_WEBHOOK_SECRET") || "").trim();
    if (!secret) {
      return json({
        ok: false,
        skipped: true,
        error: "OPENPAY_WEBHOOK_SECRET not configured — set it to enable OpenLedger push",
      }, 200);
    }

    const body = await req.json().catch(() => ({}));
    const externalRef = String(body?.external_ref || "").trim();
    const amount = Number(body?.amount);
    const currency = String(body?.currency || "OUSD").trim().toUpperCase() || "OUSD";
    if (!externalRef || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "external_ref and positive amount required" }, 400);
    }

    // Optional: confirm QR Pay order exists when ref looks like QRP-…
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (/^QRP-/i.test(externalRef)) {
      const { data: tx } = await supabase
        .from("qr_payment_transactions")
        .select("id, status, amount, currency, transaction_ref")
        .eq("transaction_ref", externalRef)
        .maybeSingle();
      if (!tx || tx.status !== "succeeded") {
        return json({ error: "QR Pay transaction not found or not paid" }, 404);
      }
    }

    const payload = {
      source: body?.source === "openpay_pro" ? "openpay_pro" : "openpay",
      type: String(body?.type || "merchant_payment"),
      from_address: body?.from_address ? String(body.from_address).slice(0, 128) : undefined,
      to_address: body?.to_address ? String(body.to_address).slice(0, 128) : undefined,
      amount,
      currency,
      network_fee: Number(body?.network_fee || 0) || 0,
      status: String(body?.status || "confirmed"),
      merchant_id: body?.merchant_id ? String(body.merchant_id).slice(0, 128) : undefined,
      external_ref: externalRef.slice(0, 256),
      timestamp: body?.timestamp || new Date().toISOString(),
      metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
    };

    const raw = JSON.stringify(payload);
    const signature = await hmacSha256Hex(secret, raw);

    const endpoints = [
      `${OPENLEDGER_BASE}/api/public/ledger/record`,
      "https://openledger.lovable.app/api/public/ledger/record",
    ];

    let lastError = "OpenLedger record failed";
    for (const url of [...new Set(endpoints)]) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-openpay-signature": signature,
          },
          body: raw,
        });
        const text = await res.text();
        let data: Record<string, unknown> = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw: text };
        }
        if (res.ok) {
          const hash =
            (data.transaction as any)?.hash ||
            (data as any).hash ||
            null;
          if (hash && /^QRP-/i.test(externalRef)) {
            try {
              const { data: row } = await supabase
                .from("qr_payment_transactions")
                .select("provider_payload")
                .eq("transaction_ref", externalRef)
                .maybeSingle();
              const prev = (row?.provider_payload && typeof row.provider_payload === "object")
                ? row.provider_payload as Record<string, unknown>
                : {};
              await supabase
                .from("qr_payment_transactions")
                .update({
                  provider_payload: {
                    ...prev,
                    openledger_hash: hash,
                    openledger_synced_at: new Date().toISOString(),
                  },
                })
                .eq("transaction_ref", externalRef);
            } catch {
              /* ignore */
            }
          }
          return json({ ok: true, transaction: data.transaction || data, hash });
        }
        lastError =
          (typeof data.error === "string" && data.error) ||
          (typeof data.message === "string" && data.message) ||
          `OpenLedger ${res.status}`;
      } catch (e) {
        lastError = e instanceof Error ? e.message : "network_error";
      }
    }

    return json({ ok: false, error: lastError }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
