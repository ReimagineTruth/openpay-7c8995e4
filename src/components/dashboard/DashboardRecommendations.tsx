import { ExternalLink, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardRecommendation = {
  id: string;
  title: string;
  description: string;
  cta: string;
  badge: string;
  icon: LucideIcon;
  onClick: () => void;
};

type DashboardRecommendationsProps = {
  items: DashboardRecommendation[];
  className?: string;
};

const DashboardRecommendations = ({ items, className }: DashboardRecommendationsProps) => {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white" />
          <h2 className="text-lg font-bold text-white">Recommended for you</h2>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Smart next steps</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="paypal-surface group rounded-[2rem] p-4 text-left text-foreground transition hover:-translate-y-0.5 hover:bg-secondary/50 hover:shadow-lg"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paypal-blue/10 text-paypal-blue shadow-inner transition group-hover:scale-105">
                <item.icon className="h-6 w-6" />
              </div>
              <span className="rounded-full bg-paypal-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-paypal-blue">
                {item.badge}
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground">{item.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-paypal-blue">
              {item.cta}
              <ExternalLink className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardRecommendations;
