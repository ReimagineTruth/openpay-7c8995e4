import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QrPayHeaderProps {
  /** Small uppercase eyebrow above the title, e.g. "OpenPay · QR Pay" */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Giant watermark word behind the header (visual only) */
  watermark?: string;
  /** Where the back arrow goes. Omit to hide the back button. */
  backTo?: string;
  backLabel?: string;
  /** Right-aligned actions (buttons, chips…) */
  actions?: ReactNode;
  /** Extra content rendered under the title block (stats chips etc.) */
  children?: ReactNode;
  className?: string;
}

/**
 * Shared QR Pay header — frosted chrome, big display type, optional watermark.
 */
export default function QrPayHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  watermark,
  backTo,
  backLabel,
  actions,
  children,
  className = "",
}: QrPayHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={`qrp-hero-v2 ${className}`}>
      {watermark && (
        <div className="qrp-bg-mark" aria-hidden>
          <span>{watermark}</span>
        </div>
      )}
      <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 pb-5 pt-[max(0.9rem,env(safe-area-inset-top))] sm:pb-6">
        <div className="flex items-start gap-3">
          {backTo && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={backLabel || "Go back"}
              className="qrp-hero-btn mt-1 h-10 w-10 shrink-0 rounded-full"
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          )}

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="mb-1.5 text-[13px] font-semibold tracking-[-0.01em] text-[var(--qrp-muted,#86868b)] sm:text-[14px]">
                {eyebrow}
              </div>
            )}
            <div className="flex items-center gap-3">
              {Icon && (
                <span className="qrp-hero-icon shrink-0">
                  <Icon className="h-5 w-5" strokeWidth={2.25} />
                </span>
              )}
              <h1 className="qrp-display-lg truncate text-[var(--qrp-ink,#1d1d1f)]">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-1.5 max-w-xl text-[15px] leading-snug text-[var(--qrp-muted,#86868b)] sm:text-[16px]">
                {subtitle}
              </p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          )}
        </div>

        {children && <div className="mt-5">{children}</div>}
      </div>
    </header>
  );
}
