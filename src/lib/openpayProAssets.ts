/** OpenPay ↔ OpenPay Pro asset tracking helpers (client-safe). */

import { PRO_PAY_ASSETS, type ProPayAsset } from "@/lib/openpayProTransfer";
import { PI_TOKEN } from "@/lib/piPrice";
import { OUSD_TOKEN } from "@/lib/ousdPrice";

export const OPENPAY_PRO_APP_URL = "https://openpaypro.space/";
export const OPENPAY_PRO_WALLET_URL = "https://openpaypro.space/wallet";
export const OPENPAY_PRO_PORTFOLIO_URLS = [
  "https://openpaypro.space/api/public/openpay/portfolio",
  "https://openpaypromainnet.lovable.app/api/public/openpay/portfolio",
] as const;

const NFT_API_BASE = "https://araojncyittkahvvpdrn.supabase.co/functions/v1/nft-public-api";

export type TrackedAssetSource = "openpay" | "openpay_pro" | "opennft";

export type TrackedAsset = {
  id: string;
  symbol: string;
  name: string;
  balance: number | null;
  usdValue: number | null;
  source: TrackedAssetSource;
  hint: string;
  logoUrl?: string;
  href?: string;
  /** True when balance is known from a live feed / wallet. */
  live: boolean;
};

export type ProPortfolioPayload = {
  username?: string;
  assets?: Array<{
    symbol?: string;
    name?: string;
    balance?: number | string;
    usd_value?: number | string;
    logo?: string;
  }>;
};

export type CollectibleRow = {
  quantity: number;
  item?: {
    id?: string;
    name?: string;
    image?: string;
    permalink?: string;
    code?: string;
  };
};

const PURE_PI_ICON = PI_TOKEN.logo;

const ASSET_LOGOS: Record<string, string> = {
  OUSD: OUSD_TOKEN.logoUrl,
  PI: PURE_PI_ICON,
  USDT: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  USDC: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/small/solana.png",
};

export const proAssetLogo = (symbol: string) =>
  ASSET_LOGOS[String(symbol || "").toUpperCase()] || OUSD_TOKEN.logoUrl;

/** Build the default Pro asset catalog users can track / open in Pro. */
export function buildProAssetCatalog(opts?: {
  openpayOusdBalance?: number;
  piUsd?: number;
}): TrackedAsset[] {
  const ousdBal = Number(opts?.openpayOusdBalance);
  const piUsd = Number(opts?.piUsd);

  const openpayRow: TrackedAsset = {
    id: "openpay-ousd",
    symbol: "OUSD",
    name: "OpenPay Wallet",
    balance: Number.isFinite(ousdBal) ? ousdBal : 0,
    usdValue: Number.isFinite(ousdBal) ? ousdBal : 0,
    source: "openpay",
    hint: "Available in OpenPay",
    logoUrl: OUSD_TOKEN.logoUrl,
    href: "/dashboard",
    live: true,
  };

  const proRows: TrackedAsset[] = PRO_PAY_ASSETS.map((a) => {
    const symbol = a.key as ProPayAsset;
    const isOusdFamily = symbol === "OUSD" || symbol === "USDT" || symbol === "USDC";
    return {
      id: `pro-${symbol.toLowerCase()}`,
      symbol,
      name: a.label,
      balance: null,
      usdValue: null,
      source: "openpay_pro" as const,
      hint: a.hint,
      logoUrl: proAssetLogo(symbol),
      href: OPENPAY_PRO_WALLET_URL,
      live: false,
      ...(symbol === "PI" && Number.isFinite(piUsd) && piUsd > 0
        ? { hint: `Live PI ≈ $${piUsd.toFixed(4)} · track on Pro` }
        : isOusdFamily
          ? { hint: `${a.hint}` }
          : {}),
    };
  });

  return [openpayRow, ...proRows];
}

/** Try OpenPay Pro public portfolio API (graceful no-op if unavailable). */
export async function fetchProPortfolio(username: string): Promise<ProPortfolioPayload | null> {
  const clean = String(username || "").trim().replace(/^@+/, "");
  if (!clean) return null;

  for (const base of OPENPAY_PRO_PORTFOLIO_URLS) {
    try {
      const url = `${base}?username=${encodeURIComponent(clean)}`;
      const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const data = (await res.json()) as ProPortfolioPayload;
      if (data && Array.isArray(data.assets)) return data;
    } catch {
      // try next
    }
  }
  return null;
}

/** Merge Pro portfolio balances into the catalog when the API responds. */
export function mergeProPortfolio(
  catalog: TrackedAsset[],
  portfolio: ProPortfolioPayload | null,
): TrackedAsset[] {
  if (!portfolio?.assets?.length) return catalog;
  const bySymbol = new Map(
    portfolio.assets.map((a) => [String(a.symbol || "").toUpperCase(), a] as const),
  );

  return catalog.map((row) => {
    if (row.source !== "openpay_pro") return row;
    const hit = bySymbol.get(row.symbol.toUpperCase());
    if (!hit) return row;
    const balance = Number(hit.balance);
    const usdValue = Number(hit.usd_value);
    return {
      ...row,
      name: hit.name || row.name,
      balance: Number.isFinite(balance) ? balance : row.balance,
      usdValue: Number.isFinite(usdValue) ? usdValue : row.usdValue,
      logoUrl: hit.logo || row.logoUrl,
      live: Number.isFinite(balance),
      hint: Number.isFinite(balance) ? "Synced from OpenPay Pro" : row.hint,
    };
  });
}

/** Fetch OpenNFT collectibles for an OpenPay @username. */
export async function fetchUserCollectibles(username: string): Promise<CollectibleRow[]> {
  const clean = String(username || "").trim().replace(/^@+/, "");
  if (!clean) return [];
  try {
    const res = await fetch(
      `${NFT_API_BASE}/collectibles/${encodeURIComponent(clean)}?limit=24`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { collectibles?: CollectibleRow[] };
    return Array.isArray(data.collectibles) ? data.collectibles : [];
  } catch {
    return [];
  }
}

export function collectiblesToAssets(rows: CollectibleRow[]): TrackedAsset[] {
  return rows
    .filter((r) => r?.item)
    .map((r, i) => {
      const qty = Number(r.quantity || 0);
      const name = r.item?.name || "Collectible";
      const id = String(r.item?.id || r.item?.code || `nft-${i}`);
      return {
        id: `nft-${id}`,
        symbol: "NFT",
        name,
        balance: Number.isFinite(qty) ? qty : 1,
        usdValue: null,
        source: "opennft" as const,
        hint: "OpenNFT collectible",
        logoUrl: r.item?.image || undefined,
        href: r.item?.permalink || "/web3/nft",
        live: true,
      };
    });
}
