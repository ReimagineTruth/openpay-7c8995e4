import { currencies } from "@/contexts/CurrencyContext";

const symbolFor = (code?: string | null): { symbol: string; suffix: boolean } => {
  const c = (code || "USD").toUpperCase();
  const match = currencies.find((x) => x.code.toUpperCase() === c);
  if (match?.symbol) {
    // Codes like PI / OUSD / BTC look better as a suffix (e.g. "10 Pi")
    const suffix = match.symbol.length > 1 || /^[A-Z]+$/.test(match.symbol);
    return { symbol: match.symbol, suffix };
  }
  return { symbol: c, suffix: true };
};

/**
 * Format an NFT price using the currency the creator selected
 * (PI, OUSD, USD, etc.) — does NOT convert to the viewer's preferred currency.
 */
export const formatNftPrice = (amount: number | string | null | undefined, code?: string | null): string => {
  const n = Number(amount || 0);
  const { symbol, suffix } = symbolFor(code);
  const fixed = n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return suffix ? `${fixed} ${symbol}` : `${symbol}${fixed}`;
};
