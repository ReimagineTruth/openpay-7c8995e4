import { supabase } from "@/integrations/supabase/client";

export type OpenLedgerPushPayload = {
  external_ref: string;
  amount: number;
  currency: string;
  type?: string;
  source?: "openpay" | "openpay_pro";
  from_address?: string | null;
  to_address?: string | null;
  merchant_id?: string | null;
  status?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Best-effort push of a completed OpenPay order into OpenLedger.
 * Uses Edge Function (signs with OPENPAY_WEBHOOK_SECRET server-side).
 */
export async function pushOpenLedgerRecord(payload: OpenLedgerPushPayload): Promise<{
  ok: boolean;
  hash?: string;
  error?: string;
}> {
  const ref = String(payload.external_ref || "").trim();
  if (!ref || !(Number(payload.amount) > 0)) {
    return { ok: false, error: "invalid_payload" };
  }

  try {
    const { data, error } = await supabase.functions.invoke("openledger-record", {
      body: payload,
    });
    if (error) return { ok: false, error: error.message };
    if (data?.error) return { ok: false, error: String(data.error) };
    return {
      ok: true,
      hash: data?.transaction?.hash || data?.hash || undefined,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || "push_failed" };
  }
}

/** Convenience for QR Pay success → OpenLedger. */
export async function pushQrPayToOpenLedger(opts: {
  transactionRef: string;
  amount: number;
  currency: string;
  method: string;
  merchantUsername?: string | null;
  merchantName?: string | null;
  payerName?: string | null;
  payerUsername?: string | null;
  title?: string | null;
  token?: string | null;
  paidAt?: string | null;
  items?: unknown;
}): Promise<{ ok: boolean; hash?: string }> {
  const to =
    opts.merchantUsername
      ? `@${String(opts.merchantUsername).replace(/^@/, "")}`
      : opts.merchantName || "merchant";
  const from =
    opts.payerUsername
      ? `@${String(opts.payerUsername).replace(/^@/, "")}`
      : opts.payerName || "guest";

  return pushOpenLedgerRecord({
    source: opts.method === "pro" ? "openpay_pro" : "openpay",
    type: "merchant_payment",
    external_ref: opts.transactionRef,
    amount: Number(opts.amount),
    currency: String(opts.currency || "OUSD").toUpperCase(),
    from_address: from,
    to_address: to,
    merchant_id: opts.merchantUsername
      ? String(opts.merchantUsername).replace(/^@/, "").toLowerCase()
      : opts.token || undefined,
    status: "confirmed",
    timestamp: opts.paidAt || new Date().toISOString(),
    metadata: {
      order_id: opts.transactionRef,
      method: opts.method,
      title: opts.title,
      token: opts.token,
      items: opts.items || undefined,
      kind: "qr_pay",
    },
  });
}
