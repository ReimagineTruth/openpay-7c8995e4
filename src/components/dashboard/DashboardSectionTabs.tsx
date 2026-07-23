import { cn } from "@/lib/utils";
import { DASHBOARD_SECTION_NAV, type DashboardSection } from "@/lib/dashboardSectionMeta";

type DashboardSectionTabsProps = {
  activeSection: DashboardSection;
  onChange: (section: DashboardSection) => void;
};

const DashboardSectionTabs = ({ activeSection, onChange }: DashboardSectionTabsProps) => (
  <div className="paypal-surface rounded-2xl p-2 hover-lift">
    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
      {DASHBOARD_SECTION_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "dash-tab flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center",
              isActive ? "dash-tab-active" : "text-foreground hover:bg-secondary/70",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center",
                isActive ? "rounded-lg bg-white/20" : "rounded-full bg-paypal-blue/10",
              )}
            >
              <Icon
                className={cn(
                  "dash-tab-icon h-4 w-4 shrink-0",
                  isActive ? "text-white" : "text-paypal-blue",
                )}
              />
            </span>
            <span
              className={cn(
                "w-full truncate text-[10px] font-bold leading-tight",
                isActive ? "text-white" : "text-foreground",
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  </div>
);

export default DashboardSectionTabs;
