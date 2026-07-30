import { ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { PI_TOKEN, usePiMarket } from "@/lib/piPrice";

const compact = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

const compactUnits = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
};

const priceLabel = (value: number) => (value >= 0.01 ? value.toFixed(4) : value.toPrecision(4));

const Sparkline = ({ points, up }: { points: number[]; up: boolean }) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 28 - ((p - min) / span) * 26 - 1;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <path
        d={d}
        fill="none"
        strokeWidth={1.8}
        vectorEffect="non-scaling-stroke"
        className={up ? "stroke-paypal-success" : "stroke-destructive"}
      />
    </svg>
  );
};

/** Realtime Pi Network token card (CoinGecko `pi-network`). */
const PiTokenCard = () => {
  const market = usePiMarket(45_000);
  const up = market.change24h >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;

  return (
    <div className="dash-panel">
      <div className="flex items-center gap-3">
        <img
          src={market.logo || PI_TOKEN.logo}
          alt="Pi Network logo"
          loading="lazy"
          className="h-10 w-10 rounded-full object-cover ring-1 ring-border/60"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {PI_TOKEN.name} <span className="text-muted-foreground">· {PI_TOKEN.symbol}</span>
          </p>
          <p className="text-xs font-medium text-muted-foreground">
            {market.isFallback ? "Estimated price" : "Live · CoinGecko"}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-extrabold tracking-tight text-foreground">${priceLabel(market.price)}</p>
          {market.change24h !== 0 && (
            <p
              className={`inline-flex items-center gap-1 text-xs font-bold ${
                up ? "text-paypal-success" : "text-destructive"
              }`}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {up ? "+" : ""}
              {market.change24h.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      {market.sparkline.length > 1 && (
        <div className="mt-3">
          <Sparkline points={market.sparkline} up={up} />
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">7-day trend</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Market cap", value: compact(market.marketCap) },
          { label: "24h volume", value: compact(market.volume24h) },
          { label: "Circulating", value: compactUnits(market.circulatingSupply) },
          { label: "ATH / ATL", value: `$${priceLabel(market.ath)} / $${priceLabel(market.atl)}` },
        ].map((stat) => (
          <div key={stat.label} className="dash-tile">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <a
        href={PI_TOKEN.website}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-paypal-blue"
      >
        minepi.com <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
};

export default PiTokenCard;
