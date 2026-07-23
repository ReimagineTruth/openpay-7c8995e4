import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardPanelProps = {
  title?: string;
  subtitle?: string;
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** Clean white content card used under section heroes. */
export const DashboardPanel = ({
  title,
  subtitle,
  trailing,
  children,
  className,
  bodyClassName,
}: DashboardPanelProps) => (
  <div className={cn("dash-panel", className)}>
    {(title || trailing) && (
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? <h3 className="text-sm font-bold text-foreground">{title}</h3> : null}
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    )}
    <div className={cn(bodyClassName)}>{children}</div>
  </div>
);

type DashboardTileProps = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export const DashboardTile = ({ title, children, className }: DashboardTileProps) => (
  <div className={cn("dash-tile", className)}>
    {title ? <p className="mb-2 text-sm font-semibold text-foreground">{title}</p> : null}
    {children}
  </div>
);

type DashboardListProps = {
  children: ReactNode;
  empty?: string;
  className?: string;
};

export const DashboardList = ({ children, empty, className }: DashboardListProps) => {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  if (!hasChildren && empty) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return <div className={cn("dash-list", className)}>{children}</div>;
};

type DashboardListRowProps = {
  title: string;
  subtitle?: string;
  meta?: ReactNode;
  value?: ReactNode;
  valueClassName?: string;
};

export const DashboardListRow = ({
  title,
  subtitle,
  meta,
  value,
  valueClassName,
}: DashboardListRowProps) => (
  <div className="flex items-start justify-between gap-3 px-3.5 py-3">
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
      {meta}
    </div>
    {value != null ? (
      <p className={cn("shrink-0 text-sm font-semibold text-foreground", valueClassName)}>{value}</p>
    ) : null}
  </div>
);

export default DashboardPanel;
