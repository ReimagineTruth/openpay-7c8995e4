import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Checkout URL to open inside Pi Browser */
  checkoutUrl: string;
}

/**
 * Shown when a payer picks Pi Network outside Pi Browser.
 * Explains that Pi payments only work in Pi Browser and lets them copy the link.
 */
export default function QrPayPiBrowserDialog({ open, onOpenChange, checkoutUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      toast.success("Link copied — open it in Pi Browser");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy. Select the link and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-[380px] gap-0 overflow-hidden rounded-[28px] border-0 bg-white p-0 op-font shadow-[0_28px_80px_-24px_rgba(0,0,0,0.45)] sm:rounded-[28px]"
      >
        <div className="flex flex-col items-center px-7 pb-8 pt-10 text-center sm:px-9 sm:pb-9 sm:pt-11">
          <div className="mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#f7f3e9] ring-1 ring-black/5">
            <img src={PURE_PI_ICON_URL} alt="Pi Network" className="h-12 w-12 rounded-full object-cover" />
          </div>

          <DialogTitle className="max-w-[17rem] text-center text-[26px] font-bold leading-[1.15] tracking-[-0.035em] text-[#1d1d1f] sm:text-[28px]">
            Pay with Pi Browser
          </DialogTitle>

          <DialogDescription className="mt-3.5 max-w-[19rem] text-center text-[15px] leading-[1.45] text-[#6e6e73] sm:text-[16px]">
            Pi Network payments only work inside the official Pi Browser. Copy this checkout link,
            then finish payment there.
          </DialogDescription>

          {/* Steps */}
          <ol className="mt-6 w-full space-y-2.5 text-left">
            {[
              "Copy the payment link below",
              "Open the Pi Browser app on your phone",
              "Paste the link and confirm with π",
            ].map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-[14px] bg-[#f2f2f7] px-3.5 py-3"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-[14px] font-medium leading-snug text-[#1d1d1f]">{step}</span>
              </li>
            ))}
          </ol>

          {/* Link preview */}
          <div className="mt-4 w-full overflow-hidden rounded-[14px] bg-[#f2f2f7] px-3.5 py-2.5 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">Checkout link</p>
            <p className="mt-0.5 truncate font-mono text-[12px] text-[#1d1d1f]">{checkoutUrl}</p>
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-5 text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
          >
            {copied ? <Check className="h-[18px] w-[18px]" strokeWidth={2.5} /> : <Copy className="h-[18px] w-[18px]" strokeWidth={2.25} />}
            <span className="text-[16px] font-medium tracking-[-0.01em]">
              {copied ? "Copied" : "Copy link for Pi Browser"}
            </span>
          </button>

          <a
            href="https://minepi.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-medium text-[#007AFF] transition-opacity hover:opacity-80"
          >
            Get Pi Browser
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="mt-5 text-[16px] font-medium text-[#6e6e73] transition-opacity hover:opacity-80"
          >
            Use another payment method
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
