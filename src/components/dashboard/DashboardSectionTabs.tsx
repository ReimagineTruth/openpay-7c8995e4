import { cn } from "@/lib/utils";
import { DASHBOARD_SECTION_NAV, type DashboardSection } from "@/lib/dashboardSectionMeta";

type DashboardSectionTabsProps = {
  activeSection: DashboardSection;
  onChange: (section: DashboardSection) => void;
  onNavigate?: (href: string) => void;
};

const DashboardSectionTabs = ({ activeSection, onChange, onNavigate }: DashboardSectionTabsProps) => (
  <div className="dash-panel dash-panel-static p-2.5 hover-lift">
    <div className="grid grid-cols-4 gap-2">

      {DASHBOARD_SECTION_NAV.map((item, index) => {
        const Icon = item.icon;
        const isActive = !item.href && activeSection === item.key;
        return (
          <button
            key={item.key}
            type="button"
            style={{ animationDelay: `${0.02 + index * 0.03}s` }}
            onClick={() => {
              if (item.href) {
                onNavigate?.(item.href);
                return;
              }
              onChange(item.key as DashboardSection);
            }}
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
