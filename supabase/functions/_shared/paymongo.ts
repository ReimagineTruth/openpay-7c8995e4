/** Shared PayMongo helpers for QR Pay (QR PH, GCash, BillEase, Online Banking). */

export const PAYMONGO_API = "https://api.paymongo.com/v1";

/** Default PHP per 1 USD / OUSD — matches OpenPay e-wallet top-up rate. */
export const DEFAULT_PHP_PER_USD = 57;

export type PaymongoMethod = "qr_ph" | "gcash" | "billease" | "bank";

/** Online banking bank codes — https://docs.paymongo.com/docs/payment-acceptance-direct-online-banking */
export type BankCode = "bpi" | "ubp" | "bdo" | "landbank" | "metrobank";

export const BANK_OPTIONS: { code: BankCode; label: string; type: "dob" | "brankas"; minPhp: number }[] = [
  { code: "bpi", label: "BPI", type: "dob", minPhp: 1 },
  { code: "ubp", label: "UnionBank", type: "dob", minPhp: 1 },
  { code: "bdo", label: "BDO", type: "brankas", minPhp: 100 },
  { code: "landbank", label: "Land Bank", type: "brankas", minPhp: 1 },
  { code: "metrobank", label: "Metrobank", type: "brankas", minPhp: 1 },
];

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

export const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

export const basicAuth = (key: string) =>
  `Basic ${btoa(`${key}:`)}`;

export function getPaymongoKeys() {
  const secret =
    Deno.env.get("PAYMONGO_SECRET_KEY") ||
    Deno.env.get("PAYMONGO_SECRET") ||
    "";
  const publicKey =
    Deno.env.get("PAYMONGO_PUBLIC_KEY") ||
    Deno.env.get("PAYMONGO_PK") ||
    "";
  if (!secret) throw new Error("PayMongo is not configured (PAYMONGO_SECRET_KEY)");
  return { secret, publicKey };
}

export function resolvePaymongoMethod(
  method: PaymongoMethod,
  bankCode?: string | null,
): {
  pmType: string;
  allowed: string[];
  details?: { bank_code: string };
  needsReturnUrl: boolean;
  minPhp: number;
  allowMetaKey: string;
} {
  if (method === "qr_ph") {
    return { pmType: "qrph", allowed: ["qrph"], needsReturnUrl: false, minPhp: 1, allowMetaKey: "allow_qr_ph" };
  }
  if (method === "gcash") {
    return { pmType: "gcash", allowed: ["gcash"], needsReturnUrl: true, minPhp: 1, allowMetaKey: "allow_gcash" };
  }
  if (method === "billease") {
    // BillEase BNPL — https://docs.paymongo.com/docs/payment-acceptance-bnpl
    return { pmType: "billease", allowed: ["billease"], needsReturnUrl: true, minPhp: 100, allowMetaKey: "allow_billease" };
  }

  // Online banking
  const code = String(bankCode || "").toLowerCase() as BankCode;
  const bank = BANK_OPTIONS.find((b) => b.code === code);
  if (!bank) {
    throw new Error("Select a bank (BPI, UnionBank, BDO, Land Bank, or Metrobank)");
  }
  return {
    pmType: bank.type,
    allowed: [bank.type],
    details: { bank_code: bank.code },
    needsReturnUrl: true,
    minPhp: bank.minPhp,
    allowMetaKey: "allow_bank",
  };
}

/** Convert QR Pay charge amount → PHP centavos for PayMongo. */
export function toPhpCentavos(amount: number, currency: string, minPhp = 1): {
  php: number;
  centavos: number;
  rate: number;
} {
  const cur = String(currency || "").trim().toUpperCase();
  const phpPerUsd = Number(Deno.env.get("PAYMONGO_PHP_PER_USD") || DEFAULT_PHP_PER_USD) || DEFAULT_PHP_PER_USD;
  let rate = phpPerUsd;
  if (cur === "PHP" || cur === "₱") rate = 1;
  else if (cur === "USD" || cur === "OUSD" || cur === "OPEN USD" || cur === "USDC" || cur === "USDT") rate = phpPerUsd;
  else rate = phpPerUsd;

  const php = Math.max(minPhp, Math.round(Number(amount) * rate * 100) / 100);
  const centavos = Math.max(Math.round(minPhp * 100), Math.round(php * 100));
  return { php, centavos, rate };
}

export async function paymongoFetch(
  path: string,
  opts: { method?: string; key: string; body?: unknown },
) {
  const res = await fetch(`${PAYMONGO_API}${path}`, {
    method: opts.method || "GET",
    headers: {
      Authorization: basicAuth(opts.key),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
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
