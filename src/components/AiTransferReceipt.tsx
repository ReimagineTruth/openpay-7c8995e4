import { ExternalLink, CheckCircle2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export type AiReceiptData = {
  transactionId: string;
  recipient: string;
  amount: number;
  balanceAfter?: number;
  status?: string;
  timestamp: string;
  note?: string;
};

const shortenId = (id: string) =>
  id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-6)}` : id;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

type Props = {
  receipt: AiReceiptData;
};

/** Paper-style transfer receipt for OpenPay AI chat, with OpenLedger deep link. */
const AiTransferReceipt = ({ receipt }: Props) => {
  const navigate = useNavigate();
  const ledgerReady = isUuid(receipt.transactionId);
  const when = (() => {
    try {
      return new Date(receipt.timestamp).toLocaleString();
    } catch {
      return receipt.timestamp;
    }
  })();

  return (
    <div className="ai-receipt relative mx-auto w-full max-w-md overflow-hidden rounded-sm bg-[#fffdf8] text-[#1a1a18] shadow-[0_12px_40px_-18px_rgba(0,0,0,0.45)] dark:bg-[#141414] dark:text-[#f3f1ea] dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]">
      {/* perforated top */}
      <div
        className="h-3 w-full bg-[radial-gradient(circle_at_bottom,#F4F1EA_6px,transparent_7px)] bg-[length:14px_12px] dark:bg-[radial-gradient(circle_at_bottom,#000_6px,transparent_7px)]"
        aria-hidden
      />

      <div className="px-5 pb-2 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" animate={false} />
            <div>
              <p className="font-ai-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-paypal-blue">
                OpenPay Receipt
              </p>
              <p className="font-ai-serif text-sm text-foreground/70">Transfer confirmation</p>
            </div>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>

        <div className="mt-4 text-center">
          <p className="font-ai-sans text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amount sent
          </p>
          <p className="mt-1 font-ai-serif text-3xl font-semibold tracking-tight text-foreground">
            ${receipt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 font-ai-sans text-sm text-emerald-700 dark:text-emerald-400">
            {receipt.status || "Completed"}
          </p>
        </div>

        <div className="my-4 border-t border-dashed border-black/15 dark:border-white/15" />

        <dl className="space-y-2.5 font-ai-sans text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Recipient</dt>
            <dd className="font-medium">@{receipt.recipient.replace(/^@/, "")}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Transaction</dt>
            <dd className="font-mono text-xs">{shortenId(receipt.transactionId)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Time</dt>
            <dd className="text-right text-xs sm:text-sm">{when}</dd>
          </div>
          {typeof receipt.balanceAfter === "number" && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Balance after</dt>
              <dd className="font-medium">
                $
                {receipt.balanceAfter.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
          {receipt.note && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Note</dt>
              <dd className="max-w-[60%] text-right text-xs">{receipt.note}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="h-10 flex-1 rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5]"
            disabled={!ledgerReady}
            onClick={() => navigate(`/ledger?tx=${encodeURIComponent(receipt.transactionId)}`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View on OpenLedger
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 rounded-xl"
            onClick={() => navigate("/activity")}
          >
            Activity
          </Button>
        </div>

        <p className="mt-3 text-center font-ai-sans text-[10px] text-muted-foreground">
          Deducted from your connected OpenPay wallet · Verified on OpenLedger
        </p>
      </div>

      {/* perforated bottom */}
      <div
        className="h-3 w-full rotate-180 bg-[radial-gradient(circle_at_bottom,#F4F1EA_6px,transparent_7px)] bg-[length:14px_12px] dark:bg-[radial-gradient(circle_at_bottom,#000_6px,transparent_7px)]"
        aria-hidden
      />
    </div>
  );
};

export default AiTransferReceipt;
