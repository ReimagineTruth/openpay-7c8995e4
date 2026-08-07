/** OpenLedger public explorer helpers — deep links by OpenPay order / tx ref. */

export const OPENLEDGER_SITE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENLEDGER_SITE_URL) ||
  "https://openpyledger.space";

/** Lovable preview alias (same app). Prefer OPENLEDGER_SITE in production. */
export const OPENLEDGER_SITE_ALIAS = "https://openledger.lovable.app";

export const OPENLEDGER_API_BASE = `${OPENLEDGER_SITE}/api/public`;

/** Stable deep link by your order / transaction id (external_ref). */
export function openLedgerTxRefUrl(externalRef: string): string {
  const ref = String(externalRef || "").trim();
  if (!ref) return `${OPENLEDGER_SITE}/explorer?source=openpay`;
  return `${OPENLEDGER_SITE}/tx/ref/${encodeURIComponent(ref)}`;
}

/** Canonical permalink by ledger hash. */
export function openLedgerTxHashUrl(hash: string): string {
  const h = String(hash || "").trim();
  if (!h) return `${OPENLEDGER_SITE}/explorer?source=openpay`;
  return `${OPENLEDGER_SITE}/tx/${encodeURIComponent(h)}`;
}

export function openLedgerExplorerUrl(source = "openpay"): string {
  return `${OPENLEDGER_SITE}/explorer?source=${encodeURIComponent(source)}`;
}

export function openLedgerMerchantUrl(merchantId: string): string {
  return `${OPENLEDGER_SITE}/merchants/${encodeURIComponent(String(merchantId || "").trim())}`;
}

/** Prefer hash permalink when known; otherwise ref deep link. */
export function openLedgerOrderUrl(opts: {
  externalRef?: string | null;
  ledgerHash?: string | null;
}): string {
  const hash = String(opts.ledgerHash || "").trim();
  if (hash) return openLedgerTxHashUrl(hash);
  const ref = String(opts.externalRef || "").trim();
  if (ref) return openLedgerTxRefUrl(ref);
  return openLedgerExplorerUrl();
}

export function openOpenLedger(opts: {
  externalRef?: string | null;
  ledgerHash?: string | null;
}): void {
  const url = openLedgerOrderUrl(opts);
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Resolve ledger entry (hash / verified) for an OpenPay order id. */
export async function resolveOpenLedgerRef(externalRef: string): Promise<{
  found: boolean;
  permalink?: string;
  hash?: string;
  verified?: boolean;
  transaction?: Record<string, unknown>;
}> {
  const ref = String(externalRef || "").trim();
  if (!ref) return { found: false };
  try {
    const res = await fetch(
      `${OPENLEDGER_API_BASE}/ledger/resolve?ref=${encodeURIComponent(ref)}`,
      { headers: { Accept: "application/json" } },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.found) return { found: false };
    return {
      found: true,
      permalink: data.permalink,
      hash: data.transaction?.hash,
      verified: !!data.transaction?.verified,
      transaction: data.transaction,
    };
  } catch {
    return { found: false };
  }
}
