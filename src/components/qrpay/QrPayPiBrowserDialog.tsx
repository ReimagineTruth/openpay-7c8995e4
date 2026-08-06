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
 * QR + copy-link instructions; waits for callback when payment completes elsewhere.
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
        overlayClassName="z-[90] bg-black/55 backdrop-blur-[2px]"
        className="z-[91] flex w-[calc(100vw-2rem)] max-w-[360px] max-h-[min(92dvh,640px)] flex-col gap-0 overflow-hidden rounded-[28px] border-0 bg-white p-0 op-font shadow-[0_28px_80px_-24px_rgba(0,0,0,0.5)] sm:rounded-[28px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative shrink-0 px-6 pb-1 pt-5 text-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f] transition-colors hover:bg-black/[0.09]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f7f3e9] ring-1 ring-black/5">
            <img src={PURE_PI_ICON_URL} alt="" className="h-9 w-9 rounded-full object-cover" />
          </div>

          <DialogTitle className="text-[22px] font-bold leading-tight tracking-[-0.035em] text-[#1d1d1f] sm:text-[24px]">
            Pay with Pi Browser
          </DialogTitle>
          <DialogDescription className="mx-auto mt-2 max-w-[18rem] text-[14px] leading-snug text-[#6e6e73]">
            Finish in Pi Browser. This page will bring you back here automatically when payment succeeds.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2 pt-3">
          {waitingForPayment && (
            <div className="mb-3 flex items-center gap-2.5 rounded-[14px] bg-[#007AFF]/[0.08] px-3.5 py-3 text-left">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#007AFF]" />
              <div>
                <p className="text-[13px] font-semibold text-[#007AFF]">Waiting for Pi payment…</p>
                <p className="text-[11px] leading-snug text-[#6e6e73]">
                  Keep this tab open. We’ll return you here after you pay.
                </p>
              </div>
            </div>
          )}

          <div className="mx-auto flex w-fit flex-col items-center rounded-[18px] bg-[#f2f2f7] p-3.5">
            <div className="rounded-[12px] bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <QRCodeSVG value={checkoutUrl || "https://openpay.app"} size={148} level="M" includeMargin={false} />
            </div>
            <p className="mt-2 text-[11px] font-medium text-[#8e8e93]">Scan in Pi Browser</p>
          </div>

          {isLocal && (
            <p className="mt-3 rounded-[12px] bg-[#FFF4E5] px-3 py-2 text-left text-[12px] leading-snug text-[#9A6700]">
              This is a local preview link. On a real phone, open your published OpenPay checkout URL in Pi Browser.
            </p>
          )}

          <ol className="mt-3 space-y-1.5">
            {[
              "Scan the QR or copy the link",
              "Pay inside Pi Browser",
              "This browser opens your receipt automatically",
            ].map((step, i) => (
              <li key={step} className="flex items-center gap-2.5 rounded-[12px] bg-[#f2f2f7] px-3 py-2 text-left">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[13px] font-medium text-[#1d1d1f]">{step}</span>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={copyLink}
            className="mt-3 w-full overflow-hidden rounded-[12px] bg-[#f2f2f7] px-3 py-2.5 text-left transition-colors hover:bg-[#ebebf0] active:scale-[0.99]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Checkout link</p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-[#1d1d1f]">{shortLink}</p>
          </button>
        </div>

        <div className="shrink-0 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={copyLink}
            className="flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {copied ? <Check className="h-[17px] w-[17px]" strokeWidth={2.5} /> : <Copy className="h-[17px] w-[17px]" strokeWidth={2.25} />}
            <span className="text-[16px] font-medium tracking-[-0.01em]">
              {copied ? "Copied" : "Copy link for Pi Browser"}
            </span>
          </button>

          <div className="mt-3.5 flex flex-col items-center gap-3">
            <a
              href="https://minepi.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#007AFF] transition-opacity hover:opacity-80"
            >
              Get Pi Browser
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={() => {
                if (onUseOtherMethod) onUseOtherMethod();
                else onOpenChange(false);
              }}
              className="text-[15px] font-medium text-[#6e6e73] transition-opacity hover:opacity-80"
            >
              Use another payment method
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
