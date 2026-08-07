/**
 * Email a QR Pay receipt via Lovable Email (notify.openpy.space).
 * Enqueues onto transactional_emails then kicks process-email-queue.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FROM = "OpenPay Receipts <receipts@notify.openpy.space>";
const SENDER_DOMAIN = "notify.openpy.space";
const SITE = (Deno.env.get("OPENPAY_PUBLIC_SITE") || "https://openpy.space").replace(/\/+$/, "");

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

function methodLabel(m: string) {
  const key = String(m || "").toLowerCase();
  if (key === "pi") return "Pi Network";
  if (key === "wallet") return "OpenPay Wallet";
  if (key === "virtual_card" || key === "card") return "Virtual Card";
  if (key === "qr_ph" || key === "qrph") return "QR PH";
  if (key === "gcash") return "GCash";
  if (key === "maya" || key === "paymaya") return "Maya";
  if (key === "grab_pay") return "GrabPay";
  if (key === "shopee_pay") return "ShopeePay";
  if (key === "google_pay") return "Google Pay";
  if (key === "billease") return "Buy Now, Pay Later";
  if (key === "bank") return "Online Banking";
  if (key === "pro") return "OpenPay Pro";
  return key.replace(/_/g, " ") || "OpenPay";
}

function buildReceiptEmail(opts: {
  transactionRef: string;
  paidAt: string;
  method: string;
  amount: number;
  currency: string;
  merchantName?: string;
  merchantUsername?: string;
  title?: string;
  items?: Array<{ name: string; quantity: number; line_total: number }>;
}) {
  const symbolMap: Record<string, string> = {
    USD: "$", OUSD: "$", USDC: "$", USDT: "$", PHP: "₱", EUR: "€", GBP: "£",
    JPY: "¥", CNY: "¥", KRW: "₩", INR: "₹", AUD: "A$", CAD: "C$", SGD: "S$",
    HKD: "HK$", THB: "฿", VND: "₫", MYR: "RM", IDR: "Rp", PI: "π",
  };
  const code = String(opts.currency || "").toUpperCase();
  const sym = symbolMap[code] || "";
  const formatAmount = (n: number) =>
    sym ? `${sym}${Number(n).toFixed(2)} ${code}` : `${code} ${Number(n).toFixed(2)}`;
  const amountDisplay = formatAmount(opts.amount);
  const dateStr = (() => {
    try {
      return new Date(opts.paidAt).toLocaleString();
    } catch {
      return opts.paidAt;
    }
  })();
  const merchant =
    [opts.merchantName, opts.merchantUsername ? `@${opts.merchantUsername}` : ""]
      .filter(Boolean)
      .join(" ") || "OpenPay merchant";
  const logo = `${SITE}/openpay-o.svg`;

  const itemRows = (opts.items || [])
    .map(
      (it) =>
        `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #eef2f6;font-size:14px;color:#2c2e2f;">${escapeHtml(it.name)} <span style="color:#8a9196;">× ${Number(it.quantity) || 1}</span></td>
          <td style="padding:10px 0;border-bottom:1px solid #eef2f6;font-size:14px;color:#2c2e2f;text-align:right;">${escapeHtml(formatAmount(it.line_total))}</td>
        </tr>`,
    )
    .join("");

  const subject = `Your OpenPay receipt · ${amountDisplay}`;
  const text = [
    "OpenPay Receipt",
    "",
    `Transaction ID: ${opts.transactionRef}`,
    `Date: ${dateStr}`,
    `Method: ${methodLabel(opts.method)}`,
    `Merchant: ${merchant}`,
    opts.title ? `Item: ${opts.title}` : "",
    `Amount: ${amountDisplay}`,
    "",
    "Thank you for paying with OpenPay. Keep this Transaction ID for any disputes.",
  ]
    .filter((l) => l !== "")
    .join("\n");

  const html = `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2c2e2f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf0;">
  <tr>
    <td style="background:#003087;padding:18px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;padding-right:12px;">
          <img src="${logo}" width="36" height="36" alt="OpenPay" style="display:block;border-radius:8px;background:#fff;" />
        </td>
        <td style="vertical-align:middle;color:#ffffff;font-weight:700;font-size:18px;">OpenPay Receipt</td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="padding:24px 28px 8px;">
    <div style="display:inline-block;background:#e8f5e9;color:#1b5e20;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;">Paid</div>
    <div style="margin-top:12px;font-size:28px;font-weight:800;letter-spacing:-0.03em;">${escapeHtml(amountDisplay)}</div>
    <div style="margin-top:4px;font-size:14px;color:#6c7378;">Paid to ${escapeHtml(merchant)}</div>
  </td></tr>
  <tr><td style="padding:8px 28px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
      <tr><td style="padding:8px 0;color:#6c7378;">Transaction ID</td><td style="padding:8px 0;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12px;">${escapeHtml(opts.transactionRef)}</td></tr>
      <tr><td style="padding:8px 0;color:#6c7378;">Date</td><td style="padding:8px 0;text-align:right;">${escapeHtml(dateStr)}</td></tr>
      <tr><td style="padding:8px 0;color:#6c7378;">Method</td><td style="padding:8px 0;text-align:right;">${escapeHtml(methodLabel(opts.method))}</td></tr>
      ${opts.title ? `<tr><td style="padding:8px 0;color:#6c7378;">Title</td><td style="padding:8px 0;text-align:right;">${escapeHtml(opts.title)}</td></tr>` : ""}
    </table>
  </td></tr>
  ${
    itemRows
      ? `<tr><td style="padding:0 28px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:12px;color:#6c7378;padding-bottom:6px;">Item</td><td style="font-size:12px;color:#6c7378;padding-bottom:6px;text-align:right;">Amount</td></tr>
      ${itemRows}
      <tr><td style="padding-top:14px;font-size:16px;font-weight:700;">Total Paid</td><td style="padding-top:14px;font-size:16px;font-weight:700;text-align:right;">${escapeHtml(amountDisplay)}</td></tr>
    </table>
  </td></tr>`
      : `<tr><td style="padding:0 28px 20px;"><div style="border-top:2px solid #0a0a0a;padding-top:14px;font-size:16px;font-weight:700;display:flex;justify-content:space-between;"><span>Total Paid</span><span>${escapeHtml(amountDisplay)}</span></div></td></tr>`
  }
  <tr><td style="padding:16px 28px 24px;border-top:1px solid #eef2f6;font-size:12px;color:#6c7378;line-height:1.5;">
    Thank you for paying with OpenPay. Keep this Transaction ID for any disputes.<br/>
    This message was sent by OpenPay Receipts &lt;receipts@notify.openpy.space&gt;.
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, text, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const to = String(body?.to || body?.email || "").trim().toLowerCase();
    const transactionRef = String(body?.transaction_ref || body?.ref || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.endsWith("@openpay.local")) {
      return json({ error: "Enter a valid email address" }, 400);
    }
    if (!transactionRef) return json({ error: "transaction_ref required" }, 400);

    const { data: tx, error: txErr } = await supabase
      .from("qr_payment_transactions")
      .select("id, transaction_ref, amount, currency, method, paid_at, payer_email, merchant_user_id, qr_payment_id")
      .eq("transaction_ref", transactionRef)
      .eq("status", "succeeded")
      .maybeSingle();

    if (txErr || !tx) return json({ error: "Receipt not found" }, 404);

    // Soft rate limit: max 8 receipt emails per address / hour
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    let recent = 0;
    try {
      const { count } = await supabase
        .from("email_notifications_outbox")
        .select("id", { count: "exact", head: true })
        .eq("to_email", to)
        .gte("created_at", since)
        .ilike("subject", "%receipt%");
      recent = count || 0;
    } catch {
      recent = 0;
    }

    if (recent >= 8) {
      return json({ error: "Too many receipt emails for this address. Try again later." }, 429);
    }

    let merchantName = "";
    let merchantUsername = "";
    if (tx.merchant_user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", tx.merchant_user_id)
        .maybeSingle();
      merchantName = profile?.full_name || "";
      merchantUsername = profile?.username || "";
    }

    let title = "";
    let items: Array<{ name: string; quantity: number; line_total: number }> = [];
    if (tx.qr_payment_id) {
      const { data: pay } = await supabase
        .from("qr_payments")
        .select("title, description")
        .eq("id", tx.qr_payment_id)
        .maybeSingle();
      title = pay?.title || "";
      const { data: payItems } = await supabase
        .from("qr_payment_items")
        .select("name, quantity, unit_price, line_total")
        .eq("qr_payment_id", tx.qr_payment_id);
      items = (payItems || []).map((it: any) => ({
        name: String(it.name || "Item"),
        quantity: Number(it.quantity) || 1,
        line_total: Number(it.line_total ?? Number(it.unit_price) * Number(it.quantity)) || 0,
      }));
    }

    // Prefer client-supplied snapshot when present (success page session)
    const snap = body?.receipt && typeof body.receipt === "object" ? body.receipt : null;
    const email = buildReceiptEmail({
      transactionRef: tx.transaction_ref,
      paidAt: snap?.paidAt || tx.paid_at || new Date().toISOString(),
      method: snap?.method || tx.method,
      amount: Number(snap?.amount ?? tx.amount),
      currency: String(snap?.currency || tx.currency || "USD"),
      merchantName: snap?.merchant?.full_name || merchantName,
      merchantUsername: snap?.merchant?.username || merchantUsername,
      title: snap?.title || title,
      items: Array.isArray(snap?.items) && snap.items.length ? snap.items : items,
    });

    const idempotency = `qr-receipt-${tx.transaction_ref}-${to}-${Date.now()}`;

    const { error: enqueueErr } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject: email.subject,
        html: email.html,
        text: email.text,
        purpose: "transactional",
        label: "qr_pay_customer_receipt",
        idempotency_key: idempotency,
        message_id: idempotency,
      },
    });
    if (enqueueErr) throw new Error(enqueueErr.message || "Failed to enqueue email");

    await supabase.from("email_notifications_outbox").insert({
      user_id: tx.merchant_user_id,
      to_email: to,
      subject: email.subject,
      body: email.text,
      status: "sent",
      sent_at: new Date().toISOString(),
      payload: {
        kind: "qr_pay_customer_receipt",
        ref: tx.transaction_ref,
        provider: "lovable",
        from: FROM,
      },
    });

    // Kick the Lovable dispatcher (best-effort)
    try {
      await fetch(`${supabaseUrl}/functions/v1/process-email-queue`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    } catch (kickErr) {
      console.warn("process-email-queue kick failed", kickErr);
    }

    return json({ ok: true, to, from: FROM, subject: email.subject });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("qr-pay-email-receipt:", message);
    return json({ error: message }, 400);
  }
});
