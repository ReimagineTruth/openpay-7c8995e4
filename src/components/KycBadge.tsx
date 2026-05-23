import { AlertCircle, Clock, ShieldAlert, ShieldCheck, ShieldQuestion, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { kycStatusLabel, type KycStatus } from "@/lib/kyc";

type Size = "xs" | "sm" | "md";

interface KycBadgeProps {
  status: KycStatus | string | null | undefined;
  size?: Size;
  showLabel?: boolean;
  className?: string;
}

const styleByStatus: Record<string, { icon: typeof ShieldCheck; bg: string; text: string; ring: string }> = {
  approved: { icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  verified: { icon: ShieldCheck, bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  pending: { icon: Clock, bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  under_review: { icon: Clock, bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-200" },
  additional_info_required: { icon: AlertCircle, bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  rejected: { icon: XCircle, bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200" },
  not_submitted: { icon: ShieldQuestion, bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" },
};

const sizeClasses: Record<Size, { wrap: string; icon: string; text: string }> = {
  xs: { wrap: "h-5 px-1.5 gap-1", icon: "h-3 w-3", text: "text-[10px]" },
  sm: { wrap: "h-6 px-2 gap-1", icon: "h-3.5 w-3.5", text: "text-xs" },
  md: { wrap: "h-7 px-2.5 gap-1.5", icon: "h-4 w-4", text: "text-sm" },
};

const KycBadge = ({ status, size = "sm", showLabel = true, className }: KycBadgeProps) => {
  const key = String(status || "not_submitted");
  const style = styleByStatus[key] || styleByStatus.not_submitted || { icon: ShieldAlert, bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border" };
  const Icon = style.icon;
  const sz = sizeClasses[size];

  return (
    <span
      aria-label={`KYC ${kycStatusLabel(key)}`}
      title={`Identity verification: ${kycStatusLabel(key)}`}
      className={cn(
        "inline-flex items-center rounded-full font-semibold ring-1",
        style.bg,
        style.text,
        style.ring,
        sz.wrap,
        sz.text,
        className,
      )}
    >
      <Icon className={cn(sz.icon, "flex-shrink-0")} />
      {showLabel ? <span>{kycStatusLabel(key)}</span> : null}
    </span>
  );
};

export default KycBadge;
