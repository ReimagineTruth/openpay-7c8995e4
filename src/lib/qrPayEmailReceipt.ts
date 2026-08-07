import { supabase } from "@/integrations/supabase/client";

type ReceiptSnap = {
  paidAt?: string | Date;
  method?: string;
  amount?: number;
  currency?: string;
  merchant?: { full_name?: string | null; username?: string | null };
  title?: string;
  items?: unknown[];
};

/**
 * Send QR Pay receipt email without depending on a deployed Edge Function.
 * Prefer DB RPC → Lovable outbox/cron; fall back to edge / local bridge.
 */
export async function sendQrPayReceiptEmail(opts: {
  to: string;
  transactionRef: string;
  receipt?: ReceiptSnap | null;
}): Promise<{ ok: true; to: string; from?: string }> {
  const to = String(opts.to || "").trim().toLowerCase();
  const transactionRef = String(opts.transactionRef || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.endsWith("@openpay.local")) {
    throw new Error("Enter a valid email address");
  }
  if (!transactionRef) throw new Error("Missing transaction reference");

  // 1) Primary: SQL RPC (works even when Edge Functions aren't deployed)
  try {
    const { data, error } = await (supabase as any).rpc("qr_pay_email_receipt", {
      p_transaction_ref: transactionRef,
      p_email: to,
    });
    if (!error && data?.ok !== false && !data?.error) {
      return {
        ok: true,
        to: data?.to || to,
        from: data?.from || "OpenPay Receipts <receipts@notify.openpy.space>",
      };
    }
    if (error && !/could not find|schema cache|404|PGRST/i.test(error.message || "")) {
      const msg = String(error.message || "");
      if (/invalid_email/i.test(msg)) throw new Error("Enter a valid email address");
      if (/receipt_not_found/i.test(msg)) throw new Error("Receipt not found");
      if (/rate_limited/i.test(msg)) throw new Error("Too many emails — try again later");
      throw new Error(msg);
    }
  } catch (rpcErr: any) {
    if (rpcErr?.message && !/could not find|schema cache|Failed to send|fetch/i.test(rpcErr.message)) {
      // real business error from RPC
      if (!/FunctionsFetchError|Edge Function/i.test(rpcErr.message)) throw rpcErr;
    }
  }

  // 2) Local Vite bridge (dev)
  const tryLocal = async () => {
    const res = await fetch("/api/qr-pay-email-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        transaction_ref: transactionRef,
        receipt: opts.receipt || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `Local email bridge failed (${res.status})`);
    }
    return {
      ok: true as const,
      to: data?.to || to,
      from: data?.from || "OpenPay Receipts <receipts@notify.openpy.space>",
    };
  };

  if (import.meta.env.DEV) {
    try {
      return await tryLocal();
    } catch {
      /* fall through */
    }
  }

  // 3) Edge function (if deployed)
  try {
    const { data, error } = await supabase.functions.invoke("qr-pay-email-receipt", {
      body: {
        to,
        transaction_ref: transactionRef,
        receipt: opts.receipt || undefined,
      },
    });
    if (error) throw new Error(error.message || "Failed to send receipt");
    if (data?.error) throw new Error(String(data.error));
    return {
      ok: true,
      to: data?.to || to,
      from: data?.from || "OpenPay Receipts <receipts@notify.openpy.space>",
    };
  } catch (edgeErr: any) {
    // Last resort local even outside DEV detection
    try {
      return await tryLocal();
    } catch {
      throw new Error(
        edgeErr?.message?.includes("Edge Function")
          ? "Email backend not ready — run the qr_pay_email_receipt SQL migration in Supabase, then try again."
          : edgeErr?.message || "Could not send receipt email",
      );
    }
  }
}
