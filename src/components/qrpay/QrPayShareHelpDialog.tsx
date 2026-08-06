import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BrandLogo from "@/components/BrandLogo";
import { OpenPayWordmark } from "@/components/qr-pay/OpenPayPayButton";
import { Smartphone, Monitor } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick?: (section: "mobile" | "desktop") => void;
}

/**
 * Apple Pay–style promo modal for OpenPay share / collect choices.
 */
export default function QrPayShareHelpDialog({ open, onOpenChange, onPick }: Props) {
  const [channel, setChannel] = useState<"mobile" | "desktop">("mobile");

  const continueWith = (section: "mobile" | "desktop") => {
    onPick?.(section);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-[380px] gap-0 overflow-hidden rounded-[28px] border-0 bg-white p-0 op-font shadow-[0_28px_80px_-24px_rgba(0,0,0,0.45)] sm:rounded-[28px]"
      >
        <div className="flex flex-col items-center px-7 pb-8 pt-10 text-center sm:px-9 sm:pb-9 sm:pt-11">
          {/* Logo badge — Apple Pay style outlined mark */}
          <div className="mb-6 inline-flex items-center justify-center rounded-[14px] border-[1.5px] border-[#1d1d1f] px-4 py-2.5">
            <span className="inline-flex items-center gap-2">
              <BrandLogo animate={false} className="h-7 w-7" />
              <span className="text-[20px] font-semibold leading-none tracking-[-0.035em] text-[#1d1d1f]">
                OpenPay
              </span>
            </span>
          </div>

          <DialogTitle className="max-w-[16rem] text-center text-[26px] font-bold leading-[1.15] tracking-[-0.035em] text-[#1d1d1f] sm:text-[28px]">
            Now Accepting OpenPay
          </DialogTitle>

          <DialogDescription className="mt-4 max-w-[18.5rem] text-center text-[15px] leading-[1.45] text-[#6e6e73] sm:text-[16px]">
            OpenPay is an easy and secure way to get paid. Share a link or QR with your customer,
            or add a Pay button to your website — no cart or forms required.
          </DialogDescription>

          {/* Channel pick — compact, Apple-like */}
          <div className="mt-6 grid w-full grid-cols-2 gap-2 rounded-[14px] bg-[#f2f2f7] p-1">
            <button
              type="button"
              onClick={() => setChannel("mobile")}
              className={`flex flex-col items-center gap-1 rounded-[11px] px-2 py-2.5 transition-all ${
                channel === "mobile"
                  ? "bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                  : "text-[#6e6e73]"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Share link</span>
            </button>
            <button
              type="button"
              onClick={() => setChannel("desktop")}
              className={`flex flex-col items-center gap-1 rounded-[11px] px-2 py-2.5 transition-all ${
                channel === "desktop"
                  ? "bg-white text-[#1d1d1f] shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                  : "text-[#6e6e73]"
              }`}
            >
              <Monitor className="h-4 w-4" />
              <span className="text-[13px] font-semibold">Website</span>
            </button>
          </div>

          {/* Primary — Set Up + OpenPay wordmark */}
          <button
            type="button"
            onClick={() => continueWith(channel)}
            className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            <span className="text-[16px] font-medium tracking-[-0.01em]">Set Up</span>
            <OpenPayWordmark
              variant="white"
              logoClassName="h-[20px] w-[20px]"
              textClassName="text-[17px]"
            />
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-5 text-[16px] font-medium text-[#007AFF] transition-opacity hover:opacity-80"
          >
            Maybe Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
