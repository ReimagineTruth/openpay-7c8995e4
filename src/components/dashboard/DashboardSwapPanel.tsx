import { ArrowDownUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MRWN_SWAP_OUSD_PER_TOKEN } from "@/lib/mrwnRates";
import { OUSD_SOL_LABEL, OUSD_SOL_LOGO_URL } from "@/lib/ousdSol";

export type SwapWithdrawalType = "PI" | "MRWN" | "OUSD" | "OUSD_SOL";

const WITHDRAWAL_OPTIONS: {
  id: SwapWithdrawalType;
  label: string;
  sublabel: string;
  iconUrl: string;
  accent: string;
  ring: string;
}[] = [
  {
    id: "OUSD",
    label: "OUSD",
    sublabel: "1:1 rate",
    iconUrl: "/openpay-o.svg",
    accent: "from-emerald-500/15 to-teal-500/10",
    ring: "ring-paypal-blue/70",
  },
  // PI, OUSD_SOL and MRWN withdrawals are temporarily hidden
];


export type DashboardSwapPanelProps = {
  withdrawalType: SwapWithdrawalType;
  onWithdrawalTypeChange: (type: SwapWithdrawalType) => void;
  amount: string;
  onAmountChange: (value: string) => void;
  safeAmount: number;
  feeAmount: number;
  payoutLabel: React.ReactNode;
  showPrice: boolean;
  rateLine: React.ReactNode;
  meetsMinimum: boolean;
  piToOusd: number;
  usdToOusd?: number;
  onContinue: () => void;
  onViewWithdrawals: () => void;
  footerNote?: string;
  className?: string;
};

function SwapRateChip({
  from,
  to,
  rate,
  className,
}: {
  from: string;
  to: string;
  rate: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dash-tile flex min-w-0 flex-1 flex-col !p-2.5",
        className,
      )}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {from} – {to}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-foreground">
        1 {from} = {rate} {to}
      </p>
    </div>
  );
}

export default function DashboardSwapPanel({
  withdrawalType,
  onWithdrawalTypeChange,
  amount,
  onAmountChange,
  safeAmount,
  feeAmount,
  payoutLabel,
  showPrice,
  rateLine,
  meetsMinimum,
  piToOusd,
  usdToOusd = 1,
  onContinue,
  onViewWithdrawals,
  footerNote = "You will confirm your OpenPay identity and mainnet wallet on the next screen.",
  className,
}: DashboardSwapPanelProps) {
  const selected = WITHDRAWAL_OPTIONS.find((o) => o.id === withdrawalType) ?? WITHDRAWAL_OPTIONS[0];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-2">
        <SwapRateChip from="USD" to="OUSD" rate={usdToOusd.toFixed(4)} />
      </div>

      <div className="dash-panel overflow-hidden p-0">
        <div className="border-b border-border/40 px-4 py-3">
          <p className="text-sm font-bold text-foreground">Withdraw OUSD</p>
          <p className="text-xs text-muted-foreground">Convert OUSD to mainnet payout</p>
        </div>

        <div className="px-3 pt-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payout asset</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {WITHDRAWAL_OPTIONS.map((opt) => {
              const active = withdrawalType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onWithdrawalTypeChange(opt.id)}
                  className={cn(
                    "flex min-w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-3 py-2.5 transition-all duration-200",
                    active
                      ? "bg-paypal-blue text-white shadow-md shadow-paypal-blue/30"
                      : "bg-secondary/50 text-foreground hover:bg-secondary dark:bg-white/5",
                  )}
                >
                  <img src={opt.iconUrl} alt="" className="h-7 w-7 rounded-full object-contain" />
                  <span className={cn("text-xs font-bold", active ? "text-white" : "text-foreground")}>
                    {opt.label}
                  </span>
                  <span className={cn("text-[10px]", active ? "text-white/75" : "text-muted-foreground")}>
                    {opt.sublabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative space-y-0 px-3 pb-3 pt-2">
          <div className="dash-tile">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">You pay</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm dark:bg-[#0f172a]">
                <img src="/openpay-o.svg" alt="" className="h-4 w-4 shrink-0 object-contain" />
                OUSD
              </span>
            </div>
            <input
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              type="text"
              inputMode="decimal"
              placeholder="0"
              className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Min 10 OUSD</p>
          </div>

          <div className="relative z-10 -my-3 flex justify-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-paypal-blue text-white shadow-lg shadow-blue-500/30 dark:border-[#0f172a]"
              aria-hidden
            >
              <ArrowDownUp className="h-4 w-4" />
            </div>
          </div>

          <div className="dash-tile">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">You receive</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm dark:bg-[#0f172a]">
                <img src={selected.iconUrl} alt="" className="h-4 w-4 object-contain" />
                {withdrawalType === "OUSD_SOL" ? OUSD_SOL_LABEL : withdrawalType}
              </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-foreground">
              {showPrice ? payoutLabel : "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              After 2% fee · {safeAmount > 0 ? `${(safeAmount - feeAmount).toFixed(2)} OUSD net` : "Enter amount"}
            </p>
          </div>
        </div>

        <div className="dash-tile mx-3 mb-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Amount</span>
            <span className="font-medium text-foreground">{safeAmount.toFixed(2)} OUSD</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Fee (2%)</span>
            <span>-{feeAmount.toFixed(2)} OUSD</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
            <span className="font-semibold text-foreground">You will receive</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-paypal-blue">
              <img src={selected.iconUrl} alt="" className="h-4 w-4" />
              {payoutLabel}
            </span>
          </div>
        </div>

        <p className="px-4 pb-2 text-center text-[11px] text-muted-foreground">{rateLine}</p>

        <div className="space-y-2 border-t border-border/40 px-3 py-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={!meetsMinimum}
            className={cn(
              "dash-btn-primary",
              !meetsMinimum && "cursor-not-allowed bg-muted text-muted-foreground shadow-none hover:bg-muted",
            )}
          >
            Continue
            <ChevronRight className="h-4 w-4 opacity-80" />
          </button>
          <button
            type="button"
            onClick={onViewWithdrawals}
            className="dash-btn-secondary"
          >
            View Withdrawals
          </button>
        </div>

        <p className="border-t border-border/40 px-4 py-3 text-center text-[11px] leading-relaxed text-muted-foreground">
          {footerNote}
        </p>
      </div>
    </div>
  );
}
