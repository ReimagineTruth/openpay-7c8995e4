import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { cn } from "@/lib/utils";

export type DashboardSectionHeroStat = {
  label: string;
  value: ReactNode;
  tone?: string;
};

type DashboardSectionHeroProps = {
  badge: string;
  badgeIcon?: LucideIcon;
  metricLabel: string;
  metricValue: ReactNode;
  metricSubtitle?: string;
  icon?: LucideIcon;
  showBrandLogo?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  secondaryAction?: { label: string; onClick: () => void; icon?: LucideIcon };
  stats?: DashboardSectionHeroStat[];
  balanceHidden?: boolean;
  onToggleHidden?: () => void;
  children?: ReactNode;
  className?: string;
};

/**
 * Shared hero card matching the Wallet Available Balance card (top blue card).
 */
const DashboardSectionHero = ({
  badge,
  badgeIcon: BadgeIcon,
  metricLabel,
  metricValue,
  metricSubtitle,
  icon: Icon,
  showBrandLogo = false,
  leading,
  trailing,
  action,
  secondaryAction,
  stats,
  balanceHidden,
  onToggleHidden,
  children,
  className,
}: DashboardSectionHeroProps) => {
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-paypal-blue to-[#0059c1] p-5 text-white shadow-2xl shadow-paypal-blue/20",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {leading ?? (
          <div className="inline-flex rounded-full bg-white/15 p-1 backdrop-blur-sm">
            <div className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-paypal-blue shadow">
              {BadgeIcon ? <BadgeIcon className="h-3 w-3" /> : null}
              {badge}
            </div>
          </div>
        )}
        {trailing ? <div className="ml-auto flex flex-wrap items-center gap-2">{trailing}</div> : null}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-white/75">
            <span>{metricLabel}</span>
            {onToggleHidden ? (
              <button
                type="button"
                onClick={onToggleHidden}
                aria-label="Toggle visibility"
                className="opacity-80 hover:opacity-100"
              >
                {balanceHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {showBrandLogo ? <BrandLogo className="h-6 w-6 shrink-0 text-white/90" /> : null}
            {Icon ? <Icon className="h-6 w-6 shrink-0 text-white/90" /> : null}
            <h2 className="truncate text-3xl font-black tracking-tight">{metricValue}</h2>
          </div>
          {metricSubtitle ? (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-white/60">
              {metricSubtitle}
            </p>
          ) : null}
        </div>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className="ios-active shrink-0 rounded-full bg-white px-4 py-2 text-xs font-black text-paypal-blue shadow-lg shadow-black/10 hover:bg-white/95 disabled:opacity-50"
          >
            {action.label}
          </button>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div
          className={cn(
            "mt-5 grid gap-2",
            stats.length >= 4
              ? "grid-cols-2 sm:grid-cols-4"
              : stats.length === 3
                ? "grid-cols-3"
                : "grid-cols-2",
          )}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/10 p-3 backdrop-blur-sm">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/60">{stat.label}</p>
              <p className={cn("mt-1 text-sm font-bold text-white", stat.tone)}>{stat.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {children}

      {secondaryAction ? (
        <div className="mt-5">
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="ios-active inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/25"
          >
            {SecondaryIcon ? <SecondaryIcon className="h-4 w-4" /> : null}
            {secondaryAction.label}
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardSectionHero;
