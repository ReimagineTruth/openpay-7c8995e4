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
    id: "PI",
    label: "Pi Network",
    sublabel: "OUSD → PI payout",
    iconUrl:
      "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png",
    accent: "from-blue-500/15 to-sky-500/10",
    ring: "ring-paypal-blue/70",
  },
  {
    id: "OUSD",
    label: "OUSD",
    sublabel: "1:1 rate",
    iconUrl: "/openpay-o.svg",
    accent: "from-emerald-500/15 to-teal-500/10",
    ring: "ring-paypal-blue/70",
  },
  // OUSD_SOL and MRWN withdrawals are temporarily hidden
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
        "flex min-w-0 flex-1 flex-col rounded-2xl border border-zinc-200/90 bg-zinc-50/90 px-3 py-2.5 dark:border-zinc-700/80 dark:bg-zinc-800/60",
        className,
      )}
    >
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {from} – {to}
      </p>
      <p className="mt-0.5 truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
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
        <SwapRateChip from="PI" to="OUSD" rate={piToOusd.toFixed(4)} />
        <SwapRateChip from="USD" to="OUSD" rate={usdToOusd.toFixed(4)} />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-zinc-200/90 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] dark:border-zinc-700/80 dark:bg-zinc-900 dark:shadow-black/30">
        <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Swap Withdrawal</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Convert OUSD to mainnet payout</p>
        </div>

        <div className="px-3 pt-3">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Payout asset</p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {WITHDRAWAL_OPTIONS.map((opt) => {
              const active = withdrawalType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onWithdrawalTypeChange(opt.id)}
                  className={cn(
                    "flex min-w-[104px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 transition-all duration-200",
                    active
                      ? cn(
                          "border-transparent bg-gradient-to-b shadow-md ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900",
                          opt.accent,
                          opt.ring,
                        )
                      : "border-zinc-200/80 bg-zinc-50/80 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600",
                  )}
                >
                  <img src={opt.iconUrl} alt="" className="h-7 w-7 rounded-full object-contain" />
                  <span
                    className={cn(
                      "text-xs font-bold",
                      active ? "text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-300",
                    )}
                  >
                    {opt.label}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{opt.sublabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative space-y-0 px-3 pb-3 pt-2">
          <div className="rounded-2xl bg-zinc-100/90 p-3 dark:bg-zinc-800/70">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">You pay</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm dark:bg-zinc-900">
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
              className="w-full border-0 bg-transparent p-0 text-3xl font-semibold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-zinc-600"
            />
            <p className="mt-1 text-[11px] text-zinc-500">Min 10 OUSD</p>
          </div>

          <div className="relative z-10 -my-3 flex justify-center">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-paypal-blue text-white shadow-lg shadow-blue-500/30 dark:border-zinc-900"
              aria-hidden
            >
              <ArrowDownUp className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-100/90 p-3 dark:bg-zinc-800/70">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">You receive</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-semibold shadow-sm dark:bg-zinc-900">
                <img src={selected.iconUrl} alt="" className="h-4 w-4 object-contain" />
                {withdrawalType === "OUSD_SOL" ? OUSD_SOL_LABEL : withdrawalType}
              </span>
            </div>
            <p className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {showPrice ? payoutLabel : "—"}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              After 2% fee · {safeAmount > 0 ? `${(safeAmount - feeAmount).toFixed(2)} OUSD net` : "Enter amount"}
            </p>
          </div>
        </div>

        <div className="mx-3 mb-3 space-y-1.5 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-800/40">
          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span>Amount</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{safeAmount.toFixed(2)} OUSD</span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Fee (2%)</span>
            <span>-{feeAmount.toFixed(2)} OUSD</span>
          </div>
          <div className="flex items-center justify-between border-t border-zinc-200/80 pt-1.5 dark:border-zinc-700">
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">You will receive</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-paypal-blue">
              <img src={selected.iconUrl} alt="" className="h-4 w-4" />
              {payoutLabel}
            </span>
          </div>
        </div>

        <p className="px-4 pb-2 text-center text-[11px] text-zinc-500">{rateLine}</p>

        <div className="space-y-2 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={onContinue}
            disabled={!meetsMinimum}
            className={cn(
              "flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition-all",
              meetsMinimum
                ? "bg-paypal-blue shadow-md shadow-blue-500/25 hover:bg-[#004dc5] active:scale-[0.99]"
                : "cursor-not-allowed bg-zinc-300 dark:bg-zinc-700",
            )}
          >
            Continue
            <ChevronRight className="h-4 w-4 opacity-80" />
          </button>
          <button
            type="button"
            onClick={onViewWithdrawals}
            className="h-11 w-full rounded-2xl border border-paypal-blue/40 bg-white text-sm font-semibold text-paypal-blue transition-colors hover:bg-blue-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            View Withdrawals
          </button>
        </div>

        <p className="border-t border-zinc-100 px-4 py-3 text-center text-[11px] leading-relaxed text-zinc-500 dark:border-zinc-800">
          {footerNote}
        </p>
      </div>
    </div>
  );
}
