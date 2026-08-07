import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";

const QR_PH_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  qrImageUrl: string;
  phpAmount?: number | null;
  waitingForPayment?: boolean;
  onUseOtherMethod?: () => void;
}

/**
 * Centered Pi-style modal for QR PH scan-to-pay.
 */
export default function QrPayQrPhDialog({
  open,
  onOpenChange,
  qrImageUrl,
  phpAmount,
  waitingForPayment = false,
  onUseOtherMethod,
}: Props) {
  const amountLabel =
    phpAmount != null && Number.isFinite(phpAmount)
      ? ` · ₱${phpAmount.toFixed(2)}`
      : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[90] bg-black/40 backdrop-blur-[2px]"
        className="z-[91] flex w-[calc(100vw-2rem)] max-w-[360px] max-h-[min(90dvh,560px)] flex-col gap-0 overflow-hidden rounded-[28px] border border-black/5 !bg-white p-0 op-font text-[#1d1d1f] shadow-[0_28px_80px_-24px_rgba(0,0,0,0.35)] sm:rounded-[28px] [color-scheme:light]"
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

          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#f2f7ff] ring-1 ring-black/5">
            <img src={QR_PH_LOGO} alt="" className="h-7 w-7 object-contain" />
          </div>

          <DialogTitle className="text-[20px] font-bold leading-tight tracking-[-0.03em] text-[#1d1d1f]">
            Pay with QR PH
          </DialogTitle>
          <DialogDescription className="mx-auto mt-1 max-w-[17rem] text-[13px] leading-snug text-[#6e6e73]">
            Scan with GCash, Maya, or any QR PH bank app{amountLabel}.
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
            <div className="overflow-hidden rounded-[12px] bg-white p-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <img
                src={qrImageUrl}
                alt="QR PH code"
                className="h-[168px] w-[168px] object-contain"
              />
            </div>
          </div>
          <p className="mt-2 text-[12px] font-medium text-[#8e8e93]">Scan with your bank or e-wallet</p>
        </div>

        <div className="mt-auto shrink-0 px-5 pb-5 pt-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span className="text-[15px] font-medium tracking-[-0.01em]">
              Done scanning
            </span>
          </button>

          <p className="mt-2 text-center text-[11px] leading-snug text-[#aeaeb2]">
            Code expires in about 30 minutes
          </p>

          <div className="mt-3 flex items-center justify-center">
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
