import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, Download, ExternalLink, X } from "lucide-react";
import { format } from "date-fns";
import { useCurrency } from "@/contexts/CurrencyContext";
import { playUiSound } from "@/lib/appSounds";

interface ReceiptData {
  transactionId: string;
  ledgerTransactionId?: string;
  type: "send" | "receive" | "topup";
  amount: number;
  platformFee?: number;
  otherPartyName?: string;
  otherPartyUsername?: string;
  note?: string;
  date: Date;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl p-0 overflow-hidden modal-content glass bg-white dark:bg-gray-900">
        <DialogTitle className="sr-only">Transaction receipt</DialogTitle>
        <DialogDescription className="sr-only">Receipt details for the selected transaction.</DialogDescription>
        <div className="bg-gradient-to-br from-paypal-blue via-blue-600 to-[#0073e6] p-6 text-center text-white animate-scaleIn relative overflow-hidden">
          {/* Animated background particles */}
          <div className="absolute inset-0">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-white/30 animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${5 + Math.random() * 3}s`
                }}
              />
            ))}
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-white/20 blur-xl animate-pulse" />
            <CheckCircle className="relative mx-auto h-16 w-16 mb-3 animate-bounce drop-shadow-2xl" />
            <h2 className="text-2xl font-bold animate-fadeInUp">{typeLabel}</h2>
            <p className="text-4xl font-black mt-2 animate-fadeInUp count-animation">{formatCurrency(receipt.amount)}</p>
            {receipt.platformFee && receipt.type === "send" && (
              <p className="text-sm mt-2 text-white/80 animate-fadeInUp">Platform fee: {formatCurrency(receipt.platformFee)}</p>
            )}
          </div>
        </div>

        <div className="p-5 space-y-3 animate-fadeInUp bg-white dark:bg-gray-900" style={{ animationDelay: '0.3s' }}>
          <div className="flex justify-between text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Date</span>
            <span className="text-gray-900 dark:text-white font-medium">{format(receipt.date, "MMM d, yyyy h:mm a")}</span>
          </div>
          <div className="flex justify-between text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
            <span className="text-gray-600 dark:text-gray-400 font-medium">Transaction ID</span>
            <span className="text-gray-900 dark:text-white font-mono text-xs">{transactionIdPreview}</span>
          </div>
          {!!ledgerTransactionId && (
            <div className="flex justify-end">
              <Button variant="link" className="h-auto p-0 text-xs" onClick={openLedgerTransaction}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                View on OpenLedger
              </Button>
            </div>
          )}
          {receipt.otherPartyName && (
            <div className="flex justify-between text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="text-gray-600 dark:text-gray-400 font-medium">{receipt.type === "send" ? "To" : "From"}</span>
              <span className="text-gray-900 dark:text-white font-medium">{receipt.otherPartyName}</span>
            </div>
          )}
          {receipt.otherPartyUsername && (
            <div className="flex justify-between text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Username</span>
              <span className="text-gray-900 dark:text-white">@{receipt.otherPartyUsername}</span>
            </div>
          )}
          {receipt.platformFee && receipt.type === "send" && (
            <div className="flex justify-between text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Platform Fee</span>
              <span className="text-gray-900 dark:text-white font-medium">{formatCurrency(receipt.platformFee)}</span>
            </div>
          )}
          {receipt.note && (
            <div className="text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="text-gray-600 dark:text-gray-400 font-medium block mb-1">Note</span>
              <span className="text-gray-900 dark:text-white break-words">{toPreviewText(receipt.note)}</span>
            </div>
          )}

          <div className="pt-4 flex gap-2 animate-fadeInUp" style={{ animationDelay: '0.5s' }}>
            <Button onClick={handleSave} className="flex-1 rounded-full bg-paypal-blue text-white btn-glow btn-press hover-lift-enhanced">
              <Download className="mr-2 h-4 w-4" /> Save Receipt
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full hover-lift border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export type { ReceiptData };
export default TransactionReceipt;
