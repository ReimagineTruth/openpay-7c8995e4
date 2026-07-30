/**
 * Server-side realtime PI/USD price (CoinGecko `pi-network`).
 *
 * Settlement rule: always re-fetch on the server before crediting a Pi top-up.
 * Never trust a price sent by the browser.
 */

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd";

/** Last-resort PI/USD if CoinGecko is unavailable (matches client policy). */
export const FALLBACK_PI_USD = 0.079;

const CACHE_TTL_MS = 20_000;
let cache: { price: number; fetchedAt: number } | null = null;

export type ServerPiPrice = {
  price: number;
  source: "coingecko" | "cache" | "fallback";
  fetchedAt: string;
};

export const fetchPiUsdPriceServer = async (
  options?: { force?: boolean },
): Promise<ServerPiPrice> => {
  const force = options?.force === true;
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return { price: cache.price, source: "cache", fetchedAt: new Date(cache.fetchedAt).toISOString() };
  }

  try {
    const proApiKey = Deno.env.get("COINGECKO_API_KEY");
    const url = proApiKey
      ? COINGECKO_URL.replace("api.coingecko.com", "pro-api.coingecko.com")
      : COINGECKO_URL;
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...(proApiKey ? { "x-cg-pro-api-key": proApiKey } : {}),
      },
    });
    if (!response.ok) throw new Error(`CoinGecko failed (${response.status})`);
    const payload = (await response.json()) as { "pi-network"?: { usd?: number | string } };
    const price = Number(payload?.["pi-network"]?.usd);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid CoinGecko payload");
    cache = { price, fetchedAt: Date.now() };
    return { price, source: "coingecko", fetchedAt: new Date(cache.fetchedAt).toISOString() };
  } catch (_error) {
    if (cache) {
      return { price: cache.price, source: "cache", fetchedAt: new Date(cache.fetchedAt).toISOString() };
    }
    return { price: FALLBACK_PI_USD, source: "fallback", fetchedAt: new Date().toISOString() };
  }
};

/** π paid -> OUSD credited (1 OUSD = $1). */
export const ousdFromPiAmount = (pi: number, piUsd: number): number => {
  const amount = Number(pi);
  const price = Number(piUsd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(price) || price <= 0) return 0;
  return amount * price;
};

/** $ / OUSD amount -> π needed. */
export const piAmountForOusd = (ousd: number, piUsd: number): number => {
  const amount = Number(ousd);
  const price = Number(piUsd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(price) || price <= 0) return 0;
  return amount / price;
};
