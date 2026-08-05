import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  QrCode, Package, Share2, CreditCard, CheckCircle2, Wallet,
  Code2, ShieldCheck, LinkIcon, Receipt,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate?: () => void;
}

const STEPS = [
  {
    icon: Package,
    title: "1 · Set up your payment",
    body: "Tap New to open the creator. Choose a payment type (simple amount, product, or multi-item order), add a title and description, then set the price. Add line items with photos and quantities if you're selling products.",
    tips: ["Pick the currency with the picker — OUSD, Pure Pi and 30+ fiat currencies are supported.", "Enable buyer details if you need name, email or a delivery address."],
  },
  {
    icon: Share2,
    title: "2 · Generate & share the QR",
    body: "Hit Generate & Share QR. OpenPay creates a hosted checkout page, a short link and a scannable QR code you can print, post or send in chat.",
    tips: ["Download the QR as an image for receipts, posters or your storefront.", "Copy the link to share on social media, email or messaging apps."],
  },
  {
    icon: CreditCard,
    title: "3 · Customer checks out",
    body: "Your buyer scans or opens the link, reviews the order summary, and pays with OpenPay Balance (OUSD), Pi Network, or their OpenPay Virtual Card. Card details auto-fill from their wallet.",
    tips: ["Pi Browser users can pay with Pi at the live CoinGecko rate.", "Every payment is encrypted and protected by OpenPay dispute resolution."],
  },
  {
    icon: CheckCircle2,
    title: "4 · Get paid & track orders",
    body: "Funds land in your OpenPay balance instantly and the order appears under Orders with the buyer's details and receipt. Overview shows revenue, conversion and your top performing items.",
    tips: ["Open an order row to see customer info, notes and line items.", "Use the time-range control on the revenue chart to compare periods."],
  },
];

const EXTRAS = [
  { icon: LinkIcon, title: "Payment links", body: "Reuse a link forever or deactivate it once an order is filled — manage all of them under the Payment links tab." },
  { icon: Code2, title: "QR Pay API", body: "Create checkouts programmatically and receive webhooks. Open the API tab for keys and docs." },
  { icon: Receipt, title: "Receipts", body: "Buyers get an instant receipt; you can download, print or email a copy from the success screen." },
  { icon: ShieldCheck, title: "Protection", body: "All payments run through OpenPay's dispute resolution with a full audit trail on OpenLedger." },
];

export default function QrPayGuideDialog({ open, onOpenChange, onCreate }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto p-0">
        <div className="qrp-hero-v2 px-5 pb-5 pt-5">
          <DialogHeader className="space-y-1 text-left">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <span className="inline-block h-1 w-1 rounded-full bg-white/70" />
              OpenPay · QR Pay
            </div>
            <DialogTitle className="flex items-center gap-2 text-2xl text-white">
              <span className="qrp-hero-icon"><QrCode className="h-5 w-5" /></span>
              How QR Pay works
            </DialogTitle>
            <DialogDescription className="text-[15px] leading-relaxed text-white/85">
              A complete step-by-step guide, from setting up a product to getting paid.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 p-4">
          {STEPS.map((s) => (
            <div key={s.title} className="qrp-sheet rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{s.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {s.tips.map((t) => (
                      <li key={t} className="flex gap-2 text-[13px] leading-relaxed text-muted-foreground">
                        <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXTRAS.map((e) => (
              <div key={e.title} className="rounded-xl border border-border bg-muted/40 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <e.icon className="h-4 w-4 text-primary" /> {e.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{e.body}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button
              className="qrp-primary-btn flex-1"
              onClick={() => { onOpenChange(false); onCreate?.(); }}
            >
              <Wallet className="mr-1.5 h-4 w-4" /> Create my first QR payment
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
