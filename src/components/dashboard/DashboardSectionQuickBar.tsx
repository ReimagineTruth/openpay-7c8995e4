import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardQuickAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "primary" | "default";
  disabled?: boolean;
};

type DashboardSectionQuickBarProps = {
  actions: DashboardQuickAction[];
  className?: string;
};

const DashboardSectionQuickBar = ({ actions, className }: DashboardSectionQuickBarProps) => {
  if (actions.length === 0) return null;

  return (
    <div className={cn("mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", className)}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(
              "dash-chip ios-active inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50",
              action.variant === "primary"
                ? "bg-gradient-to-r from-paypal-blue to-[#0073e6] text-white shadow-lg shadow-paypal-blue/30 hover:shadow-paypal-blue/50"
                : "border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/20",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

export default DashboardSectionQuickBar;
