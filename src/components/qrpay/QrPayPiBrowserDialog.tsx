import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Checkout URL to open inside Pi Browser */
  checkoutUrl: string;
  onUseOtherMethod?: () => void;
  /** True while this browser is waiting for Pi Browser to finish payment */
  waitingForPayment?: boolean;
}

/**
 * Shown when a payer picks Pi Network outside Pi Browser.
 * QR-first layout so scan/copy stay above the fold — no hidden scroll content.
 */
export default function QrPayPiBrowserDialog({
  open,
  onOpenChange,
  checkoutUrl,
  onUseOtherMethod,
  waitingForPayment = false,
}: Props) {
  const [copied, setCopied] = useState(false);

  const isLocal =
    /localhost|127\.0\.0\.1/i.test(checkoutUrl) ||
    (typeof window !== "undefined" && /localhost|127\.0\.0\.1/i.test(window.location.hostname));

  const shortLink = useMemo(() => {
    try {
      const u = new URL(checkoutUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return checkoutUrl;
    }
  }, [checkoutUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      toast.success(isLocal
        ? "Link copied — use your public OpenPay URL in Pi Browser"
        : "Link copied — open it in Pi Browser");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy. Select the link and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[90] bg-black/40 backdrop-blur-[2px]"
        className="z-[91] flex w-[calc(100vw-2rem)] max-w-[360px] max-h-[min(90dvh,560px)] flex-col gap-0 overflow-hidden rounded-[28px] border border-black/5 !bg-white p-0 op-font text-[#1d1d1f] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.35)] sm:rounded-[28px] [color-scheme:light]"
        style={{ backgroundColor: "#ffffff", color: "#1d1d1f" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Compact header */}
        <div className="relative shrink-0 px-5 pb-0 pt-4 text-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f] transition-colors hover:bg-black/[0.09]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#f7f3e9] ring-1 ring-black/5">
            <img src={PURE_PI_ICON_URL} alt="" className="h-7 w-7 rounded-full object-cover" />
          </div>

          <DialogTitle className="text-[20px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
            Pay with Pi Browser
          </DialogTitle>
          <DialogDescription className="mx-auto mt-1 max-w-[17rem] text-[13px] leading-snug text-[#6e6e73]">
            Scan the QR or copy the link — then pay in Pi Browser.
          </DialogDescription>

          {waitingForPayment && (
            <div className="mx-auto mt-2.5 inline-flex max-w-full items-center gap-2 rounded-full bg-[#007AFF]/[0.1] px-3 py-1.5">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#007AFF]" />
              <span className="truncate text-[12px] font-semibold text-[#007AFF]">
                Waiting for payment — keep this tab open
              </span>
            </div>
          )}
        </div>

        {/* QR first — always visible, no scroll trap */}
        <div className="flex shrink-0 flex-col items-center px-5 pb-1 pt-3">
          <div className="rounded-[16px] bg-[#f2f2f7] p-3">
            <div className="rounded-[12px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <QRCodeSVG value={checkoutUrl || "https://openpay.app"} size={168} level="M" includeMargin={false} />
            </div>
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#8e8e93]">Scan in Pi Browser</p>

          {isLocal && (
            <p className="mt-2 w-full rounded-[10px] bg-[#FFF4E5] px-2.5 py-1.5 text-center text-[11px] leading-snug text-[#9A6700]">
              Local preview — use your published OpenPay URL on a real phone.
            </p>
          )}
        </div>

        {/* Sticky actions — always on screen */}
        <div className="mt-auto shrink-0 px-5 pb-5 pt-3">
          <button
            type="button"
            onClick={copyLink}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {copied ? <Check className="h-[17px] w-[17px]" strokeWidth={2.5} /> : <Copy className="h-[17px] w-[17px]" strokeWidth={2.25} />}
            <span className="text-[15px] font-medium tracking-[-0.01em]">
              {copied ? "Copied" : "Copy link for Pi Browser"}
            </span>
          </button>

          <p className="mt-2 truncate text-center font-mono text-[10px] text-[#aeaeb2]" title={checkoutUrl}>
            {shortLink}
          </p>

          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href="https://minepi.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#007AFF] transition-opacity hover:opacity-80"
            >
              Get Pi Browser
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="text-[#d1d1d6]" aria-hidden>
              ·
            </span>
            <button
              type="button"
              onClick={() => {
                if (onUseOtherMethod) onUseOtherMethod();
                else onOpenChange(false);
              }}
              className="text-[13px] font-medium text-[#6e6e73] transition-opacity hover:opacity-80"
            >
              Other method
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
