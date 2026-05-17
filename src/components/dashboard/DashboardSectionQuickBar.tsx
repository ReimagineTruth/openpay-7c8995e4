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
              "ios-active inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all disabled:opacity-50",
              action.variant === "primary"
                ? "bg-paypal-blue text-white shadow-md shadow-paypal-blue/20 hover:bg-paypal-blue/90"
                : "border border-white/20 bg-white/10 text-white backdrop-blur-sm hover:bg-white/15",
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
