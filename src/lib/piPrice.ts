/**
 * Realtime PI/USD pricing for OpenPay.
 *
 * Source of truth: CoinGecko (`pi-network`), proxied by the `pi-price` edge
 * function so the browser never hits CoinGecko directly (CORS + rate limits).
 *
 * Rule: 1 OUSD = $1 USD. Never hard-code PI/USD for settlement — the server
 * always re-fetches the live price before crediting a Pi top-up.
 *
 * Fallback policy (documented, consistent everywhere):
 *   live price -> last cached price (localStorage) -> FALLBACK_PI_USD.
 * A fallback price is always flagged so the UI can label it as an estimate.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Last-resort PI/USD if CoinGecko and the cache are both unavailable. */
export const FALLBACK_PI_USD = 0.079;

const CACHE_KEY = "openpay_pi_usd_price";
const CACHE_TTL_MS = 30_000;

export type PiUsdPrice = {
  /** PI price in USD (1 OUSD = 1 USD). */
  price: number;
  /** Epoch ms of when the price was fetched. */
  fetchedAt: number;
  /** True when the value is not a fresh CoinGecko read. */
  isFallback: boolean;
  source: "coingecko" | "cache" | "fallback";
};

let cachedPiUsd: PiUsdPrice | null = null;
let inflight: Promise<PiUsdPrice> | null = null;

const readPersistedCache = (): PiUsdPrice | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { price?: unknown; fetchedAt?: unknown };
    const price = Number(parsed?.price);
    const fetchedAt = Number(parsed?.fetchedAt);
    if (!Number.isFinite(price) || price <= 0) return null;
    return {
      price,
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0,
      isFallback: true,
      source: "cache",
    };
  } catch {
    return null;
  }
};

export const setCachedPiUsdPrice = (price: number, source: PiUsdPrice["source"] = "coingecko") => {
  if (!Number.isFinite(price) || price <= 0) return;
  cachedPiUsd = { price, fetchedAt: Date.now(), isFallback: source !== "coingecko", source };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ price, fetchedAt: cachedPiUsd.fetchedAt }));
    } catch {
      // storage unavailable — memory cache still works
    }
  }
};

/** Last known price without triggering a network request. */
export const getCachedPiUsdPrice = (): PiUsdPrice => {
  if (cachedPiUsd) return cachedPiUsd;
  const persisted = readPersistedCache();
  if (persisted) {
    cachedPiUsd = persisted;
    return persisted;
  }
  return { price: FALLBACK_PI_USD, fetchedAt: 0, isFallback: true, source: "fallback" };
};

/** Fetch the live PI/USD price (30s in-memory cache unless `force`). */
export const fetchPiUsdPrice = async (options?: { force?: boolean }): Promise<PiUsdPrice> => {
  const force = options?.force === true;
  if (!force && cachedPiUsd && Date.now() - cachedPiUsd.fetchedAt < CACHE_TTL_MS && !cachedPiUsd.isFallback) {
    return cachedPiUsd;
  }
  if (inflight && !force) return inflight;

  inflight = (async (): Promise<PiUsdPrice> => {
    try {
      const { data, error } = await supabase.functions.invoke("pi-price");
      if (error) throw error;
      const payload = data as { success?: boolean; price_usd?: number | string } | null;
      const price = Number(payload?.price_usd);
      if (!payload?.success || !Number.isFinite(price) || price <= 0) {
        throw new Error("Invalid PI price payload");
      }
      setCachedPiUsdPrice(price, "coingecko");
      return cachedPiUsd!;
    } catch {
      return getCachedPiUsdPrice();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
};

/** $ / OUSD amount -> π needed (rounded to 6 decimals, matching OpenPay Pro). */
export const piAmountForOusd = (ousd: number, piUsd: number): number => {
  const amount = Number(ousd);
  const price = Number(piUsd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round((amount / price) * 1e6) / 1e6;
};

/** π paid -> OUSD credited (rounded to 8 decimals). */
export const ousdFromPiAmount = (pi: number, piUsd: number): number => {
  const amount = Number(pi);
  const price = Number(piUsd);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(price) || price <= 0) return 0;
  return Math.round(amount * price * 1e8) / 1e8;
};

/** Memo shown in the Pi wallet — must be identical in UI and in createPayment. */
export const buildPiTopupMemo = (ousdAmount: number, piAmount: number, piUsdPrice: number): string => {
  const ousd = Number(Number(ousdAmount).toFixed(2));
  const pi = piAmount >= 1 ? piAmount.toFixed(4) : Number(piAmount || 0).toPrecision(6);
  const price = piUsdPrice >= 0.01 ? piUsdPrice.toFixed(4) : Number(piUsdPrice || 0).toPrecision(4);
  return `OpenPay: ${ousd} OUSD (~${pi} π @ $${price})`;
};

export type PiTopupQuote = {
  /** What the user typed (USD / OUSD, 1 OUSD = $1). */
  ousdAmount: number;
  /** π to charge in Pi.createPayment. */
  piAmount: number;
  /** Live $/π used for the quote. */
  piUsdPrice: number;
  /** True when the price is a cached/fallback estimate. */
  isFallback: boolean;
  priceSource: PiUsdPrice["source"];
  /** Memo shown in the Pi wallet. */
  memo: string;
};

/** Build a quote from a known price (sync, for rendering). */
export const buildPiTopupQuote = (ousdAmount: number, price: PiUsdPrice): PiTopupQuote => {
  const piAmount = piAmountForOusd(ousdAmount, price.price);
  return {
    ousdAmount: Number(ousdAmount) || 0,
    piAmount,
    piUsdPrice: price.price,
    isFallback: price.isFallback,
    priceSource: price.source,
    memo: buildPiTopupMemo(Number(ousdAmount) || 0, piAmount, price.price),
  };
};

/** Fetch a fresh live price and build the quote used for Pi.createPayment. */
export const quotePiTopup = async (ousdAmount: number): Promise<PiTopupQuote> => {
  const price = await fetchPiUsdPrice({ force: true });
  return buildPiTopupQuote(ousdAmount, price);
};


/** Live PI/USD price with polling, for wallet / top-up / quote screens. */
export const usePiUsdPrice = (pollMs = 45_000): PiUsdPrice => {
  const [price, setPrice] = useState<PiUsdPrice>(() => getCachedPiUsdPrice());

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const next = await fetchPiUsdPrice();
      if (mounted) setPrice(next);
    };
    void load();
    if (!pollMs) return () => { mounted = false; };
    const interval = window.setInterval(() => void load(), pollMs);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  return price;
};
