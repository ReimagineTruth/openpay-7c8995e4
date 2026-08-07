import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import RegulatoryStatusModal from "@/components/RegulatoryStatusModal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PI_TOKEN, usePiMarket } from "@/lib/piPrice";
import { OUSD_TOKEN, getOusdUsdPrice } from "@/lib/ousdPrice";

interface DigitalRateDisplayProps {
  className?: string;
  rates: {
    piToOusd: number;
    usdToOusd: number;
    currencyTag: string;
    currencyCode?: string;
    currencyRate?: number;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  liveRateClosed?: boolean;
}

const priceLabel = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1) return value.toFixed(4);
  if (value >= 0.01) return value.toFixed(4);
  return value.toPrecision(4);
};

const DigitalNumber: React.FC<{
  value: string | number;
  className?: string;
}> = ({ value, className }) => (
  <span className={cn("font-semibold tabular-nums tracking-[-0.02em]", className)}>{value}</span>
);

/** Full expandable rates panel (legacy consumers). */
export const DigitalRateDisplay: React.FC<DigitalRateDisplayProps> = ({
  className,
  rates,
  open = true,
  onOpenChange,
  liveRateClosed = false,
}) => {
  const [regulatoryModalOpen, setRegulatoryModalOpen] = useState(false);
  const market = usePiMarket(45_000);
  const piRate = market.price > 0 ? market.price : rates.piToOusd;
  const ousdRate = getOusdUsdPrice();
  const up = market.change24h >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;

  return (
    <>
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        className={cn(
          "relative overflow-hidden rounded-[24px] border-0 bg-white p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                liveRateClosed ? "bg-[#FF3B30]" : "bg-[#34C759] animate-pulse",
              )}
            />
            <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">
              {liveRateClosed ? "Rates" : "Live Rates"}
            </h3>
            <span className="text-[11px] font-medium text-[#8e8e93]">
              {market.isFallback ? "Estimate" : "CoinGecko"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRegulatoryModalOpen(true)}
              className="h-8 rounded-full bg-[#f2f2f7] px-2.5 text-[#8e8e93] hover:bg-[#e5e5ea] hover:text-[#1d1d1f]"
            >
              <Scale className="h-3.5 w-3.5" />
              <Info className="h-3 w-3" />
            </Button>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2f2f7] text-[#8e8e93]"
              >
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] bg-[#f2f2f7] p-4">
              <div className="flex items-center gap-3">
                <img
                  src={market.logo || PI_TOKEN.logo}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">Pi Network</p>
                  <p className="text-[11px] text-[#8e8e93]">1 PI → OUSD</p>
                </div>
                {market.change24h !== 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                      up ? "bg-[#34C759]/15 text-[#248A3D]" : "bg-[#FF3B30]/15 text-[#D70015]",
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {up ? "+" : ""}
                    {market.change24h.toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-[#1d1d1f]">
                ${priceLabel(piRate)}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-[#8e8e93]">
                1 PI = {priceLabel(piRate)} OUSD
              </p>
            </div>

            <div className="rounded-[18px] bg-[#f2f2f7] p-4">
              <div className="flex items-center gap-3">
                <img
                  src={OUSD_TOKEN.logoUrl}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-black/5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">OpenUSD</p>
                  <p className="text-[11px] text-[#8e8e93]">USD peg</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#007AFF]/12 px-2 py-0.5 text-[11px] font-bold text-[#007AFF]">
                  <ShieldCheck className="h-3 w-3" />
                  Pegged
                </span>
              </div>
              <p className="mt-3 text-[28px] font-bold tracking-[-0.03em] text-[#1d1d1f]">
                ${ousdRate.toFixed(2)}
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-[#8e8e93]">
                1 OUSD = ${ousdRate.toFixed(2)} USD
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-[#8e8e93]">
            Display · {rates.currencyTag}
          </p>
        </CollapsibleContent>
      </Collapsible>

      <RegulatoryStatusModal open={regulatoryModalOpen} onOpenChange={setRegulatoryModalOpen} />
    </>
  );
};

/**
 * Menu Services live-rate card — dual PI + OUSD tiles with live CoinGecko PI price.
 */
export const CompactDigitalRateDisplay: React.FC<{
  rates?: { piToOusd?: number; usdToOusd?: number };
  className?: string;
  liveRateClosed?: boolean;
}> = ({ rates, className, liveRateClosed = false }) => {
  const [open, setOpen] = useState(true);
  const [regulatoryModalOpen, setRegulatoryModalOpen] = useState(false);
  const market = usePiMarket(30_000);
  const piRate =
    market.price > 0
      ? market.price
      : Number(rates?.piToOusd) > 0
        ? Number(rates?.piToOusd)
        : 0;
  const ousdRate = getOusdUsdPrice();
  const up = market.change24h >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  const ousdPerPi = piRate; // 1 OUSD = $1, so PI/USD == PI/OUSD
  const piPerOusd = piRate > 0 ? 1 / piRate : 0;

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-[24px] border-0 bg-white shadow-[0_8px_28px_-18px_rgba(0,0,0,0.35)]",
          className,
        )}
      >
        {/* Header */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 pb-2 pt-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                liveRateClosed ? "bg-[#FF3B30]" : "bg-[#34C759] animate-pulse",
              )}
            />
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
              {liveRateClosed ? "Rates" : "Live Rates"}
            </span>
            <span className="rounded-full bg-[#f2f2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
              {liveRateClosed ? "Offline" : market.isFallback ? "Est." : "Live"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setRegulatoryModalOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  setRegulatoryModalOpen(true);
                }
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f2f2f7] text-[#8e8e93]"
            >
              <Scale className="h-3.5 w-3.5" />
            </span>
            {open ? (
              <ChevronUp className="h-4 w-4 text-[#c7c7cc]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#c7c7cc]" />
            )}
          </div>
        </button>

        {/* Dual asset tiles */}
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {/* PI */}
          <div className="rounded-[18px] bg-gradient-to-br from-[#007AFF]/[0.08] to-[#5856D6]/[0.06] p-3 ring-1 ring-[#007AFF]/10">
            <div className="flex items-center gap-2">
              <img
                src={market.logo || PI_TOKEN.logo}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8e8e93]">PI</p>
                <p className="truncate text-[12px] font-semibold text-[#1d1d1f]">Pi Network</p>
              </div>
            </div>
            <p className="mt-2.5 text-[20px] font-bold tracking-[-0.03em] text-[#1d1d1f]">
              ${priceLabel(piRate)}
            </p>
            <div className="mt-1 flex items-center justify-between gap-1">
              <p className="text-[11px] font-medium text-[#8e8e93]">→ OUSD</p>
              {market.change24h !== 0 && !liveRateClosed ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[11px] font-bold",
                    up ? "text-[#248A3D]" : "text-[#D70015]",
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {up ? "+" : ""}
                  {market.change24h.toFixed(2)}%
                </span>
              ) : (
                <Activity className="h-3 w-3 text-[#007AFF]" />
              )}
            </div>
          </div>

          {/* OUSD */}
          <div className="rounded-[18px] bg-gradient-to-br from-[#34C759]/[0.08] to-[#30B0C7]/[0.05] p-3 ring-1 ring-[#34C759]/12">
            <div className="flex items-center gap-2">
              <img
                src={OUSD_TOKEN.logoUrl}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-black/5"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#8e8e93]">OUSD</p>
                <p className="truncate text-[12px] font-semibold text-[#1d1d1f]">OpenUSD</p>
              </div>
            </div>
            <p className="mt-2.5 text-[20px] font-bold tracking-[-0.03em] text-[#1d1d1f]">
              ${ousdRate.toFixed(2)}
            </p>
            <div className="mt-1 flex items-center justify-between gap-1">
              <p className="text-[11px] font-medium text-[#8e8e93]">USD peg</p>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#007AFF]">
                <ShieldCheck className="h-3 w-3" />
                Stable
              </span>
            </div>
          </div>
        </div>

        {/* Conversion strip */}
        <div className="mx-3 mb-3 rounded-[14px] bg-[#f2f2f7] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                Conversion
              </p>
              <p className="mt-0.5 font-semibold text-[#1d1d1f]">
                1 PI = <DigitalNumber value={priceLabel(ousdPerPi)} className="text-[#007AFF]" /> OUSD
              </p>
            </div>
            <div className="h-8 w-px bg-black/5" />
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8e8e93]">
                Inverse
              </p>
              <p className="mt-0.5 font-semibold text-[#1d1d1f]">
                1 OUSD ={" "}
                <DigitalNumber value={priceLabel(piPerOusd)} className="text-[#007AFF]" /> PI
              </p>
            </div>
          </div>
        </div>

        {/* Expand detail */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300",
            open ? "max-h-24 opacity-100" : "max-h-0 opacity-0",
          )}
        >
          <div className="mx-3 mb-3 flex items-start gap-2 rounded-[14px] bg-[#007AFF]/[0.06] px-3 py-2.5">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#007AFF]" />
            <p className="text-[11px] leading-relaxed text-[#3a3a3c]">
              {liveRateClosed
                ? "Live rates temporarily unavailable. Showing last known values."
                : market.isFallback
                  ? "Using estimated PI price. Live CoinGecko feed reconnects automatically."
                  : "PI price updates live from CoinGecko. OUSD stays pegged at $1.00 USD."}
            </p>
          </div>
        </div>
      </div>

      <RegulatoryStatusModal open={regulatoryModalOpen} onOpenChange={setRegulatoryModalOpen} />
    </>
  );
};

export default DigitalRateDisplay;
