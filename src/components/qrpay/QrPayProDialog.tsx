import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import BrandLogo from "@/components/BrandLogo";
import {
  formatProDestinationPreview,
  isProWalletAddress,
} from "@/lib/openpayProTransfer";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** OpenPay Pro hosted pay URL (QR + open target) */
  payUrl: string;
  /** Merchant Pro @username or 0x wallet */
  destination: string;
  amountLabel: string;
  assetLabel: string;
  waitingForPayment?: boolean;
  confirming?: boolean;
  onOpenPro: () => void;
  onConfirmPaid: () => void;
  onUseOtherMethod?: () => void;
}

/**
 * Pi-style modal for OpenPay Pro checkout: QR of merchant Pro pay link,
 * copy destination, open Pro wallet, then wait/confirm once paid.
 */
export default function QrPayProDialog({
  open,
  onOpenChange,
  payUrl,
  destination,
  amountLabel,
  assetLabel,
  waitingForPayment = false,
  confirming = false,
  onOpenPro,
  onConfirmPaid,
  onUseOtherMethod,
}: Props) {
  const [copied, setCopied] = useState<"url" | "dest" | null>(null);

  const destPreview = useMemo(
    () => formatProDestinationPreview(destination) || destination,
    [destination],
  );
  const destFull = String(destination || "").trim();
  const isWallet = isProWalletAddress(destFull);

  const shortLink = useMemo(() => {
    try {
      const u = new URL(payUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return payUrl;
    }
  }, [payUrl]);

  const copy = async (value: string, kind: "url" | "dest") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === "dest" ? "Merchant Pro address copied" : "Pay link copied");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn’t copy. Select and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[90] bg-black/40 backdrop-blur-[2px]"
        className="z-[91] flex w-[calc(100vw-2rem)] max-w-[360px] max-h-[min(90dvh,600px)] flex-col gap-0 overflow-hidden rounded-[28px] border border-black/5 !bg-white p-0 op-font text-[#1d1d1f] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.35)] sm:rounded-[28px] [color-scheme:light]"
        style={{ backgroundColor: "#ffffff", color: "#1d1d1f" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative shrink-0 px-5 pb-0 pt-4 text-center">
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[#1d1d1f] transition-colors hover:bg-black/[0.09]"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1d1f] ring-1 ring-black/5">
            <BrandLogo variant="white" animate={false} className="h-6 w-6" />
          </div>

          <DialogTitle className="text-[20px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
            Pay with OpenPay Pro
          </DialogTitle>
          <DialogDescription className="mx-auto mt-1 max-w-[17rem] text-[13px] leading-snug text-[#6e6e73]">
            Scan or open Pro to pay {amountLabel} in {assetLabel} to the merchant wallet.
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

        <div className="flex shrink-0 flex-col items-center px-5 pb-1 pt-3">
          <div className="rounded-[16px] bg-[#f2f2f7] p-3">
            <div className="rounded-[12px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <QRCodeSVG value={payUrl || "https://openpaypro.space"} size={168} level="M" includeMargin={false} />
            </div>
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#8e8e93]">Scan in OpenPay Pro</p>

          <button
            type="button"
            onClick={() => copy(destFull, "dest")}
            className="mt-2.5 w-full rounded-[12px] bg-[#f2f2f7] px-3 py-2.5 text-left transition-colors hover:bg-[#e8e8ed]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8e8e93]">
              Merchant Pro {isWallet ? "wallet" : "account"}
            </p>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="truncate font-mono text-[13px] font-semibold text-[#1d1d1f]" title={destFull}>
                {isWallet ? destFull : destPreview}
              </p>
              {copied === "dest" ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-[#34C759]" strokeWidth={2.5} />
              ) : (
                <Copy className="h-3.5 w-3.5 shrink-0 text-[#8e8e93]" strokeWidth={2.25} />
              )}
            </div>
          </button>
        </div>

        <div className="mt-auto shrink-0 px-5 pb-5 pt-3">
          <button
            type="button"
            onClick={onOpenPro}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <ExternalLink className="h-[17px] w-[17px]" strokeWidth={2.25} />
            <span className="text-[15px] font-medium tracking-[-0.01em]">
              Open OpenPay Pro
            </span>
          </button>

          <button
            type="button"
            onClick={() => copy(payUrl, "url")}
            className="mt-2 flex h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#f2f2f7] px-5 text-[#1d1d1f] transition-opacity hover:bg-[#e8e8ed] active:scale-[0.98]"
          >
            {copied === "url" ? (
              <Check className="h-[17px] w-[17px]" strokeWidth={2.5} />
            ) : (
              <Copy className="h-[17px] w-[17px]" strokeWidth={2.25} />
            )}
            <span className="text-[14px] font-medium tracking-[-0.01em]">
              {copied === "url" ? "Copied" : "Copy pay link"}
            </span>
          </button>

          <p className="mt-2 truncate text-center font-mono text-[10px] text-[#aeaeb2]" title={payUrl}>
            {shortLink}
          </p>

          <button
            type="button"
            disabled={confirming}
            onClick={onConfirmPaid}
            className="mt-3 flex h-[44px] w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-5 text-[#1d1d1f] transition-opacity hover:bg-[#f9f9fb] active:scale-[0.98] disabled:opacity-60"
          >
            {confirming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            <span className="text-[14px] font-semibold tracking-[-0.01em]">
              {confirming ? "Confirming…" : "I’ve paid — continue"}
            </span>
          </button>

          <div className="mt-3 flex items-center justify-center gap-4">
            <a
              href="https://openpaypro.space/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#007AFF] transition-opacity hover:opacity-80"
            >
              Get OpenPay Pro
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
