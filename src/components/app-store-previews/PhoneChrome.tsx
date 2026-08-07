import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";

export const PhoneChrome = ({
  children,
  frameRef,
  className,
  statusLight = false,
  previewId,
}: {
  children: ReactNode;
  frameRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  /** White status text for dark/blue screens */
  statusLight?: boolean;
  previewId?: string;
}) => (
  <div
    ref={frameRef}
    data-preview-id={previewId}
    className={cn(
      "relative mx-auto w-[390px] overflow-hidden rounded-[40px] bg-black shadow-[0_24px_80px_-20px_rgba(0,0,0,0.45)] ring-[10px] ring-[#1d1d1f]",
      className,
    )}
    style={{ height: 844 }}
  >
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-30 flex h-11 items-end justify-between px-7 pb-1.5 text-[12px] font-semibold",
        statusLight ? "text-white" : "text-white mix-blend-difference",
      )}
    >
      <span>9:41</span>
      <div className="flex items-center gap-1.5 text-[11px]">
        <span>●●●●</span>
        <span>5G</span>
        <span className="rounded-[3px] border border-current px-1 text-[9px]">100</span>
      </div>
    </div>
    <div className="pointer-events-none absolute left-1/2 top-2 z-30 h-[28px] w-[120px] -translate-x-1/2 rounded-full bg-black" />
    <div className="h-full overflow-hidden bg-white">{children}</div>
  </div>
);

export const BluePage = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("h-full overflow-y-auto bg-paypal-blue pb-10 text-white", className)}>{children}</div>
);

export const LightPage = ({
  children,
  className,
  bg = "bg-[#F2F2F7]",
}: {
  children: ReactNode;
  className?: string;
  bg?: string;
}) => (
  <div className={cn("h-full overflow-y-auto pb-10", bg, className)}>{children}</div>
);

export const SoftHeader = ({
  title,
  onBack,
  trailing,
  light = false,
}: {
  title: string;
  onBack?: boolean;
  trailing?: ReactNode;
  light?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 px-4 pb-3 pt-12",
      light ? "text-white" : "text-[#1d1d1f]",
    )}
  >
    <div className="flex items-center gap-3">
      {onBack !== false && (
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full shadow-sm",
            light ? "bg-white/15" : "bg-white",
          )}
        >
          <span className="text-lg leading-none">‹</span>
        </div>
      )}
      <h1 className={cn("text-xl font-bold", light ? "text-white" : "text-paypal-dark")}>{title}</h1>
    </div>
    {trailing}
  </div>
);
