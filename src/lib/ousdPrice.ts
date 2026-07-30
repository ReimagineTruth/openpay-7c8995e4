/**
 * OUSD (OpenUSD) pricing for OpenPay.
 *
 * OUSD has NO market feed — it is a fixed internal peg: 1 OUSD = $1.00 USD.
 * There is nothing to poll here. Only PI is realtime (see `@/lib/piPrice`).
 */

export const OUSD_TOKEN = {
  id: "ousd",
  name: "OpenUSD",
  symbol: "OUSD",
  /** Realtime price = always 1. */
  priceUsd: 1,
  change24h: 0,
  peg: true,
  logoUrl: "https://i.ibb.co/DPYPzVdN/app-icon-ios.png",
  about:
    "OUSD is OpenPay's dollar-pegged stablecoin. 1 OUSD \u2248 $1 USD and powers trading, swaps, and wallet transfers.",
  marketCap: null as number | null,
  volume24h: null as number | null,
  source: "Stablecoin",
} as const;

/** Realtime OUSD/USD price — fixed peg, always 1. */
export function getOusdUsdPrice(): number {
  return OUSD_TOKEN.priceUsd;
}

/** OUSD amount for a given USD value (identity, kept for call-site clarity). */
export const usdToOusd = (usd: number) => usd / getOusdUsdPrice();

/** USD value of an OUSD amount. */
export const ousdToUsd = (ousd: number) => ousd * getOusdUsdPrice();

/** OUSD -> PI at a live PI/USD price (6 dp, Pi payment precision). */
export const ousdToPi = (ousdAmount: number, piUsd: number) => {
  if (!Number.isFinite(piUsd) || piUsd <= 0) return 0;
  return Math.round(((ousdAmount * getOusdUsdPrice()) / piUsd) * 1e6) / 1e6;
};

/** PI paid -> OUSD credited at a live PI/USD price (8 dp, ledger precision). */
export const piToOusd = (piAmount: number, piUsd: number) => {
  if (!Number.isFinite(piUsd) || piUsd <= 0) return 0;
  return Math.round(piAmount * piUsd * 1e8) / 1e8;
};
