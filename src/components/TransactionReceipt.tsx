import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import { playUiSound } from "@/lib/appSounds";

const OPENPAY_LOGO = "/openpay-logo.jpg";

const PROVIDER_LOGOS: Record<string, string> = {
  "Pi Payment": "https://i.ibb.co/jk8XtTPj/pi-network-pi-icons-pi-logo-design-illustration-trendy-and-modern-crypto-currency-pi-symbol-for-logo.png",
  PayPal: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1920px-PayPal.svg.png",
  "Ewallet QR PH": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234",
  "Apple Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/1920px-Apple_Pay_logo.svg.png",
  "Google Pay": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Google_Pay_Logo.svg/1920px-Google_Pay_Logo.svg.png",
  "Debit Card": "https://i.ibb.co/G3FGwngR/Visa-Inc-logo-design-2014-present-svg.png",
  "Credit Card": "https://i.ibb.co/9kkZmFDq/Mastercard-2019-logo-svg.png",
  Stripe: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1920px-Stripe_Logo%2C_revised_2016.svg.png",
  Venmo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Venmo_Logo.svg/1920px-Venmo_Logo.svg.png",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  MRWN: "https://i.ibb.co/6P2Q3yH/mrwn-token-logo.png",
};

interface ReceiptData {
  transactionId: string;
  ledgerTransactionId?: string;
  type: "send" | "receive" | "topup";
  amount: number;
  platformFee?: number;
  otherPartyName?: string;
  otherPartyUsername?: string;
  otherPartyAvatar?: string;
  note?: string;
  date: Date;
  provider?: string;
}

interface TransactionReceiptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptData | null;
}

const toPreviewText = (value: string, max = 60) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const shortenToken = (token: string, keepStart = 10, keepEnd = 6) => {
    if (token.length <= keepStart + keepEnd + 3) return token;
    return `${token.slice(0, keepStart)}...${token.slice(-keepEnd)}`;
  };

  const tokenShortened = raw
    .replace(/\bopsess_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\boplink_[a-zA-Z0-9_-]+\b/g, (m) => shortenToken(m))
    .replace(/\b[a-zA-Z]{2,}_[a-zA-Z0-9_-]{16,}\b/g, (m) => shortenToken(m))
    .replace(/\bhttps?:\/\/[^\s]+/gi, (m) => shortenToken(m, 22, 10));

  if (tokenShortened.length <= max) return tokenShortened;
  return `${tokenShortened.slice(0, max - 3)}...`;
};

const shortenTransactionId = (transactionId: string) =>
  transactionId.length > 18 ? `${transactionId.slice(0, 10)}...${transactionId.slice(-6)}` : transactionId;

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const TransactionReceipt = ({ open, onOpenChange, receipt }: TransactionReceiptProps) => {
  const { format: formatCurrency } = useCurrency();

  if (!receipt) return null;

  const typeLabel =
    receipt.type === "topup" ? "Top Up" : receipt.type === "send" ? "Payment Sent" : "Payment Received";
  const transactionIdPreview = shortenTransactionId(receipt.transactionId);
  const ledgerTransactionId = isUuid(receipt.ledgerTransactionId || "")
    ? String(receipt.ledgerTransactionId)
    : isUuid(receipt.transactionId)
      ? receipt.transactionId
      : "";

  const handleSave = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.crossOrigin = "anonymous";
        img.src = src;
      });

    const wrapText = (text: string, maxWidth: number) => {
      const words = String(text || "").split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";

      const splitLongWord = (word: string) => {
        const chunks: string[] = [];
        let current = "";
        for (const char of word) {
          const test = `${current}${char}`;
          if (ctx.measureText(test).width <= maxWidth) {
            current = test;
          } else {
            if (current) chunks.push(current);
            current = char;
          }
        }
        if (current) chunks.push(current);
        return chunks;
      };

      for (const word of words) {
        if (ctx.measureText(word).width > maxWidth) {
          if (line) {
            lines.push(line);
            line = "";
          }
          const chunks = splitLongWord(word);
          for (let i = 0; i < chunks.length; i += 1) {
            const chunk = chunks[i];
            if (i === chunks.length - 1) line = chunk;
            else lines.push(chunk);
          }
          continue;
        }
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
      if (line) lines.push(line);
      return lines.length ? lines : [""];
    };

    ctx.fillStyle = "#f3f4f7";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#d4d8e2";
    ctx.lineWidth = 2;
    const cardX = 90;
    const cardY = 80;
    const cardW = 900;
    const cardH = 1320;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0057d8";
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, 330, [34, 34, 0, 0]);
    ctx.fill();

    const logo = await loadImage(`${window.location.origin}/openpay-logo.jpg`);
    if (logo) {
      const logoSize = 84;
      ctx.drawImage(logo, canvas.width / 2 - logoSize / 2, 120, logoSize, logoSize);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "600 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("OpenPay", canvas.width / 2, 230);

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 52px Arial";
    ctx.textAlign = "center";
    ctx.fillText(typeLabel, canvas.width / 2, 285);
    ctx.font = "700 66px Arial";
    ctx.fillText(formatCurrency(receipt.amount), canvas.width / 2, 365);

    const rows: Array<[string, string]> = [
      ["Date", format(receipt.date, "MMM d, yyyy h:mm a")],
      ["Transaction ID", transactionIdPreview],
      [receipt.type === "send" ? "To" : "From", receipt.otherPartyName || "N/A"],
      ["Username", receipt.otherPartyUsername ? `@${receipt.otherPartyUsername}` : "N/A"],
      ...(receipt.platformFee && receipt.type === "send" ? [["Platform Fee", formatCurrency(receipt.platformFee)] as [string, string]] : []),
      ["Note", receipt.note ? toPreviewText(receipt.note, 90) : "N/A"],
    ];

    ctx.textAlign = "left";
    let y = 500;
    for (const [label, value] of rows) {
      ctx.fillStyle = "#66758f";
      ctx.font = "500 34px Arial";
      ctx.fillText(label, 140, y);

      ctx.fillStyle = "#1a2740";
      ctx.font = "600 34px Arial";
      const lines = wrapText(value, 480);
      lines.forEach((line, idx) => {
        const lineY = y + idx * 46;
        ctx.textAlign = "right";
        ctx.fillText(line, 940, lineY);
      });
      ctx.textAlign = "left";
      y += Math.max(74, lines.length * 46 + 24);
    }

    ctx.fillStyle = "#9aa4b5";
    ctx.font = "500 30px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Powered by OpenPay", canvas.width / 2, cardY + cardH - 60);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `openpay-receipt-${receipt.transactionId.slice(0, 8)}.png`;
    a.click();
    playUiSound("receipt");
  };

  const openLedgerTransaction = () => {
    if (!ledgerTransactionId) return;
    const txId = encodeURIComponent(ledgerTransactionId);
    window.location.assign(`/ledger?tx=${txId}`);
  };

  const getInitials = (name: string) => (name || "U").split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const isCredit = receipt.type !== "send";
  const providerLogo =
    receipt.type === "topup" && receipt.provider
      ? PROVIDER_LOGOS[receipt.provider] ||
        PROVIDER_LOGOS[receipt.provider?.toUpperCase()] ||
        PROVIDER_LOGOS[receipt.provider?.toLowerCase()]
      : undefined;

  const detailRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: "Status", value: "Confirmed" },
    { label: "Type", value: typeLabel },
    { label: "Date", value: format(receipt.date, "MMM d, yyyy h:mm a") },
    ...(receipt.platformFee && receipt.type === "send"
      ? [{ label: "Network fee", value: formatCurrency(receipt.platformFee) }]
      : []),
    ...(receipt.otherPartyName
      ? [{ label: receipt.type === "send" ? "To" : "From", value: receipt.otherPartyName }]
      : []),
    ...(receipt.otherPartyUsername ? [{ label: "Username", value: `@${receipt.otherPartyUsername}` }] : []),
    { label: "Transaction ID", value: transactionIdPreview, mono: true },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100vw-2rem)] max-w-[400px] grid-cols-1 overflow-hidden rounded-[28px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[420px]"
      >
        <DialogTitle className="sr-only">Transaction receipt</DialogTitle>
        <DialogDescription className="sr-only">Receipt details for the selected transaction.</DialogDescription>

        {/* Header */}
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
            aria-label="Close receipt"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={OPENPAY_LOGO}
              alt="OpenPay"
              className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border"
            />
            <p className="truncate text-sm font-bold text-foreground">{typeLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition hover:bg-muted/70"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hero */}
        <div className="flex min-w-0 flex-col items-center px-5 pb-5 pt-5">
          <div className="relative">
            {providerLogo ? (
              <div className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-border">
                <img src={providerLogo} alt={receipt.provider} className="h-10 w-10 object-contain" />
              </div>
            ) : receipt.otherPartyAvatar ? (
              <img
                src={receipt.otherPartyAvatar}
                alt={receipt.otherPartyName || "Profile"}
                className="h-[68px] w-[68px] rounded-full object-cover ring-1 ring-border"
                onError={(event) => {
                  event.currentTarget.src = OPENPAY_LOGO;
                }}
              />
            ) : (
              <div className="flex h-[68px] w-[68px] items-center justify-center overflow-hidden rounded-full bg-paypal-blue ring-1 ring-border">
                <img src={OPENPAY_LOGO} alt="OpenPay" className="h-full w-full object-cover" />
              </div>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-paypal-success">
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
            </span>
          </div>

          <p
            className={`mt-4 text-[30px] font-extrabold leading-none tracking-tight ${
              isCredit ? "text-paypal-success" : "text-foreground"
            }`}
          >
            {isCredit ? "+" : "-"}
            {formatCurrency(receipt.amount)}
          </p>
          <p className="mt-2 text-sm font-medium text-muted-foreground">
            {receipt.otherPartyName || "OpenPay"}
            {receipt.otherPartyUsername ? ` · @${receipt.otherPartyUsername}` : ""}
          </p>
          {receipt.note && (
            <p className="mt-2 max-w-full truncate px-2 text-xs text-muted-foreground/80">{toPreviewText(receipt.note)}</p>
          )}
        </div>

        {/* Details */}
        <div className="px-4 pb-5 sm:px-5">
          <div className="rounded-2xl border border-border bg-muted/40 p-1">
            {detailRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0"
              >
                <span className="shrink-0 text-[13px] font-medium text-muted-foreground">{row.label}</span>
                <span
                  className={`min-w-0 truncate text-right text-[13px] font-semibold ${
                    row.mono ? "font-mono text-muted-foreground" : "text-foreground"
                  } ${row.label === "Status" ? "text-paypal-success" : ""}`}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {!!ledgerTransactionId && (
              <Button
                variant="outline"
                onClick={openLedgerTransaction}
                className="h-12 flex-1 rounded-full border-paypal-blue/30 bg-transparent font-bold text-paypal-blue hover:bg-paypal-blue/10 hover:text-paypal-blue"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                OpenLedger
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="h-12 flex-1 rounded-full bg-paypal-blue font-bold text-white hover:bg-paypal-blue/90"
            >
              <Download className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export type { ReceiptData };
export default TransactionReceipt;
