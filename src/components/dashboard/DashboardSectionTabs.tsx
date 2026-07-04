import { cn } from "@/lib/utils";
import { DASHBOARD_SECTION_NAV, type DashboardSection } from "@/lib/dashboardSectionMeta";

type DashboardSectionTabsProps = {
  activeSection: DashboardSection;
  onChange: (section: DashboardSection) => void;
};

const DashboardSectionTabs = ({ activeSection, onChange }: DashboardSectionTabsProps) => (
  <div className="paypal-surface overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden hover-lift">
    <div className="flex min-w-max gap-1.5">
      {DASHBOARD_SECTION_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              "dash-tab flex min-w-[5.5rem] flex-col items-center gap-1 rounded-xl px-3 py-2.5",
              isActive ? "dash-tab-active" : "text-foreground hover:bg-secondary/70",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon
              className={cn(
                "dash-tab-icon h-4 w-4 shrink-0",
                isActive ? "text-white" : "text-paypal-blue",
              )}
            />
            <span className="text-xs font-bold leading-tight">{item.label}</span>
          </button>
        );
      })}
    </div>
  </div>
);

export default DashboardSectionTabs;
