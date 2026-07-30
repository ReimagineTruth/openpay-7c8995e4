import { ShieldCheck } from "lucide-react";
import { OUSD_TOKEN, getOusdUsdPrice } from "@/lib/ousdPrice";

/** OUSD token details card — fixed $1.00 peg, no market feed to poll. */
const OusdTokenCard = () => {
  const price = getOusdUsdPrice();

  return (
    <div className="dash-panel">
      <div className="flex items-center gap-3">
        <img
          src={OUSD_TOKEN.logoUrl}
          alt="OpenUSD logo"
          loading="lazy"
          className="h-10 w-10 rounded-full object-cover ring-1 ring-border/60"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">
            {OUSD_TOKEN.name} <span className="text-muted-foreground">· {OUSD_TOKEN.symbol}</span>
          </p>
          <p className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-paypal-success" />
            Pegged · {OUSD_TOKEN.source}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-lg font-extrabold tracking-tight text-foreground">${price.toFixed(2)}</p>
          <p className="text-xs font-bold text-muted-foreground">0.00%</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Price", value: `$${price.toFixed(2)}` },
          { label: "Peg", value: `1 ${OUSD_TOKEN.symbol} = $${price.toFixed(2)}` },
          { label: "Market cap", value: OUSD_TOKEN.marketCap ? `$${OUSD_TOKEN.marketCap}` : "N/A" },
          { label: "24h volume", value: OUSD_TOKEN.volume24h ? `$${OUSD_TOKEN.volume24h}` : "N/A" },
        ].map((stat) => (
          <div key={stat.label} className="dash-tile">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p className="mt-0.5 truncate text-sm font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs font-medium leading-relaxed text-muted-foreground">{OUSD_TOKEN.about}</p>
    </div>
  );
};

export default OusdTokenCard;
