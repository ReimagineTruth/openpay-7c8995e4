// Lightweight HTML receipt renderer + printable window for QR Pay
import { openLedgerTxRefUrl } from "@/lib/openLedger";

export interface QrPayReceiptData {
  transactionRef: string;
  paidAt: string | Date;
  method: string;
  amount: number;
  currency: string;
  currencySymbol?: string;
  merchant: { full_name?: string | null; username?: string | null };
  payer?: { name?: string | null; email?: string | null; username?: string | null };
  title?: string;
  description?: string | null;
  items: Array<{ name: string; quantity: number; unit_price: number; line_total: number }>;
}

const methodLabel = (m: string) => {
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
};

function receiptLogoUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/openpay-o.svg`;
  }
  return "/openpay-o.svg";
}

function resolveCurrencySymbol(currency?: string, override?: string | null): string {
  if (override && String(override).trim()) return String(override).trim();
  const code = String(currency || "").trim().toUpperCase();
  const map: Record<string, string> = {
    USD: "$",
    OUSD: "$",
    USDC: "$",
    USDT: "$",
    PHP: "₱",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
    CNY: "¥",
    KRW: "₩",
    INR: "₹",
    AUD: "A$",
    CAD: "C$",
    SGD: "S$",
    HKD: "HK$",
    THB: "฿",
    VND: "₫",
    MYR: "RM",
    IDR: "Rp",
    PI: "π",
  };
  return map[code] || (code ? `${code} ` : "$");
}

function formatMoney(amount: number, currency?: string, symbolOverride?: string | null): string {
  const code = String(currency || "").trim().toUpperCase() || "USD";
  const sym = resolveCurrencySymbol(code, symbolOverride);
  const value = Number(amount).toFixed(2);
  // Avoid "$1.00 USD" duplication when symbol already embeds the code (e.g. "A$")
  // Always show matching symbol + code: ₱1.00 PHP
  if (sym.endsWith(" ")) return `${sym}${value}`;
  return `${sym}${value} ${code}`;
}

export function buildQrPayReceiptHtml(d: QrPayReceiptData): string {
  const fmt = (n: number) => formatMoney(n, d.currency, d.currencySymbol);
  const date =
    typeof d.paidAt === "string" ? new Date(d.paidAt) : d.paidAt;
  const dateStr = (() => {
    try { return date.toLocaleString(); } catch { return String(date); }
  })();
  const logoUrl = receiptLogoUrl();
  const ledgerUrl = openLedgerTxRefUrl(d.transactionRef);

  const itemRows = d.items.map(it => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(it.name)} <span style="color:#888">× ${it.quantity}</span></td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right">${fmt(it.line_total)}</td>
    </tr>`).join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <title>OpenPay Receipt — ${escapeHtml(d.transactionRef)}</title>
  <style>
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0a0a0a;max-width:640px;margin:24px auto;padding:24px;background:#fff}
    h1{font-size:20px;margin:0 0 4px}
    .muted{color:#666;font-size:13px}
    .card{border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-top:16px}
    .row{display:flex;justify-content:space-between;margin:6px 0}
    .total{font-size:18px;font-weight:700;margin-top:8px;padding-top:12px;border-top:2px solid #0a0a0a}
    .badge{display:inline-block;background:#0070ba;color:#fff;padding:4px 10px;border-radius:999px;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    .ref{font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;padding:4px 8px;border-radius:6px;font-size:12px}
    .ledger{display:inline-block;margin-top:12px;padding:10px 16px;border-radius:999px;background:#0070ba;color:#fff;text-decoration:none;font-size:13px;font-weight:600}
    @media print { body{margin:0} }
  </style></head><body>
  <div style="display:flex;align-items:center;gap:12px">
    <img src="${escapeHtml(logoUrl)}" alt="OpenPay" width="44" height="44" style="border-radius:8px;display:block;object-fit:contain;background:#f5f5f7"/>
    <div>
      <h1>OpenPay Receipt</h1>
      <div class="muted">QR Payment · <span class="badge">Paid</span></div>
    </div>
  </div>
  <div class="card">
    <div class="row"><span class="muted">Transaction ID</span><span class="ref">${escapeHtml(d.transactionRef)}</span></div>
    <div class="row"><span class="muted">Date</span><span>${escapeHtml(dateStr)}</span></div>
    <div class="row"><span class="muted">Method</span><span>${escapeHtml(methodLabel(d.method))}</span></div>
    <div class="row"><span class="muted">Merchant</span><span>${escapeHtml(d.merchant.full_name || "")}${d.merchant.username ? ` <span class="muted">@${escapeHtml(d.merchant.username)}</span>` : ""}</span></div>
    ${d.payer?.name || d.payer?.username ? `<div class="row"><span class="muted">Payer</span><span>${escapeHtml(d.payer.name || "")}${d.payer.username ? ` <span class="muted">@${escapeHtml(d.payer.username)}</span>` : ""}</span></div>` : ""}
    ${d.payer?.email ? `<div class="row"><span class="muted">Email</span><span>${escapeHtml(d.payer.email)}</span></div>` : ""}
    <div style="text-align:center">
      <a class="ledger" href="${escapeHtml(ledgerUrl)}" target="_blank" rel="noopener">View on OpenLedger</a>
      <div class="muted" style="margin-top:8px;word-break:break-all">${escapeHtml(ledgerUrl)}</div>
    </div>
  </div>
  <div class="card">
    ${d.title ? `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(d.title)}</div>` : ""}
    ${d.description ? `<div class="muted" style="margin-bottom:8px">${escapeHtml(d.description)}</div>` : ""}
    <table>
      <thead><tr><th style="text-align:left;font-size:12px;color:#666;padding-bottom:6px">Item</th><th style="text-align:right;font-size:12px;color:#666;padding-bottom:6px">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="row total"><span>Total Paid</span><span>${fmt(d.amount)}</span></div>
  </div>
  <p class="muted" style="margin-top:16px;text-align:center">Thank you for paying with OpenPay. Keep this Transaction ID for any future disputes.</p>
  </body></html>`;
}

export function downloadQrPayReceipt(data: QrPayReceiptData) {
  const html = buildQrPayReceiptHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `OpenPay-Receipt-${data.transactionRef}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printQrPayReceipt(data: QrPayReceiptData) {
  const html = buildQrPayReceiptHtml(data);
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 250);
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
