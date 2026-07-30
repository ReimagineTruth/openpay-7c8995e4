import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** CoinGecko id must be exactly `pi-network` (never `pi`). */
const COINGECKO_PI_URL = "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd";
const COINGECKO_PI_MARKET_URL =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=pi-network&order=market_cap_desc&sparkline=true&price_change_percentage=24h";

const CG_HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; OpenPayBot/1.0; +https://openpay)",
};

const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchCoinGeckoPiPrice = async (): Promise<number | null> => {
  const response = await fetch(COINGECKO_PI_URL, { headers: CG_HEADERS });
  if (!response.ok) return null;
  const payload = (await response.json()) as { "pi-network"?: { usd?: number | string } };
  const parsed = Number(payload?.["pi-network"]?.usd ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

type PiMarketRow = {
  current_price?: number;
  price_change_percentage_24h?: number;
  market_cap?: number;
  total_volume?: number;
  circulating_supply?: number;
  total_supply?: number;
  ath?: number;
  atl?: number;
  image?: string;
  sparkline_in_7d?: { price?: number[] };
};

const fetchCoinGeckoPiMarket = async () => {
  try {
    const response = await fetch(COINGECKO_PI_MARKET_URL, { headers: CG_HEADERS });
    if (!response.ok) return null;
    const rows = (await response.json()) as PiMarketRow[];
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !(num(row.current_price) > 0)) return null;
    return {
      price: num(row.current_price),
      change_24h: num(row.price_change_percentage_24h),
      market_cap: num(row.market_cap),
      volume_24h: num(row.total_volume),
      circulating_supply: num(row.circulating_supply),
      total_supply: num(row.total_supply),
      ath: num(row.ath),
      atl: num(row.atl),
      image: typeof row.image === "string" ? row.image : null,
      sparkline: Array.isArray(row.sparkline_in_7d?.price)
        ? row.sparkline_in_7d!.price!.map((p) => num(p))
        : [],
    };
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // The market endpoint carries the same `current_price`, so prefer it and
    // fall back to the lightweight simple-price endpoint.
    const market = await fetchCoinGeckoPiMarket();
    const cgPrice = market?.price ?? (await fetchCoinGeckoPiPrice());
    if (!cgPrice) {
      return jsonResponse(
        { success: false, error: "Unable to fetch PI price from CoinGecko" },
        502,
      );
    }

    return jsonResponse({
      success: true,
      source: "https://www.coingecko.com/en/coins/pi-network",
      pair: "PI/USD",
      coingecko_id: "pi-network",
      name: "Pi Network",
      symbol: "PI",
      logo: market?.image ?? "https://coin-images.coingecko.com/coins/images/54342/large/pi_network.jpg",
      website: "https://minepi.com/",
      price_usd: cgPrice,
      market: market ?? null,
      fetched_at: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ success: false, error: message }, 500);
  }
});
