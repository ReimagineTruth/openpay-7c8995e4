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
 * Unified premium header used across every QR Pay page.
 * Deep navy → electric blue gradient, soft light bloom, glass back button
 * and a rounded bottom edge that the page content tucks under.
 */
export default function QrPayHeader({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  backTo,
  backLabel,
  actions,
  children,
  className = "",
}: QrPayHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className={`qrp-hero-v2 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start gap-3">
          {backTo && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={backLabel || "Go back"}
              className="qrp-hero-btn mt-0.5 h-10 w-10 shrink-0 rounded-full"
              onClick={() => navigate(backTo)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                <span className="inline-block h-1 w-1 rounded-full bg-white/70" />
                {eyebrow}
              </div>
            )}
            <div className="flex items-center gap-2.5">
              {Icon && (
                <span className="qrp-hero-icon">
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <h1 className="truncate text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-1 max-w-xl text-[13px] leading-snug text-white/80">{subtitle}</p>
            )}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
          )}
        </div>

        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
  );
}
