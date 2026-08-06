import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Download, Printer, Mail, Home, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import QrPaySteps from "@/components/qrpay/QrPaySteps";
import { downloadQrPayReceipt, printQrPayReceipt, type QrPayReceiptData } from "@/lib/qrPayReceipt";

interface ReceiptExtras {
  after_payment_action?: "receipt" | "download" | "redirect";
  download_url?: string | null;
  redirect_url?: string | null;
}

export default function QrPaySuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ref = params.get("ref") || "";
  const [data, setData] = useState<(QrPayReceiptData & ReceiptExtras) | null>(null);
  const [emailTo, setEmailTo] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(`qrp_receipt_${ref}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setData(parsed);
        if (parsed.payer?.email) setEmailTo(parsed.payer.email);
      } catch {}
    }
  }, [ref]);

  const emailReceipt = () => {
    if (!data) return;
    if (!emailTo) { toast.error("Enter an email"); return; }
    const subject = `OpenPay receipt ${data.transactionRef}`;
    const body = [
      `OpenPay Receipt`,
      ``,
      `Transaction ID: ${data.transactionRef}`,
      `Date: ${new Date(data.paidAt).toLocaleString()}`,
      `Method: ${data.method}`,
      `Merchant: ${data.merchant.full_name || ""}${data.merchant.username ? ` (@${data.merchant.username})` : ""}`,
      `Amount: ${data.currency} ${Number(data.amount).toFixed(2)}`,
      ``,
      `Keep this Transaction ID for any disputes or claims.`,
    ].join("\n");
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { downloadQrPayReceipt(data); } catch {}
    toast.success("Receipt opened in your email app");
  };

  return (
    <div className="min-h-screen qrp-page-bg">
      <div className="qrp-bg-mark" aria-hidden><span>DONE</span></div>
      <div className="qrp-stage relative z-[1] qrp-pop">
        <div className="px-1 pb-3 pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--qrp-muted)]">
            OpenPay
          </div>
          <div className="qrp-success-wrap mx-auto mb-4 h-[72px] w-[72px]">
            <span className="qrp-success-ring" />
            <span className="qrp-success-badge" style={{ height: 72, width: 72 }}>
              <svg viewBox="0 0 52 52" className="h-10 w-10" fill="none" aria-hidden>
                <path className="qrp-check-path" d="M14 27.5 L22.5 36 L38 18"
                      stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
          <p className="text-[14px] font-medium text-[var(--qrp-muted)]">Payment Successful</p>
          {data ? (
            <h1 className="qrp-amount-hero mt-2">
              {data.currency} {Number(data.amount).toFixed(2)}
            </h1>
          ) : (
            <h1 className="qrp-display-lg mt-2">Done</h1>
          )}
          {data && (
            <p className="mt-2 text-[15px] text-[var(--qrp-muted)]">
              Paid to {data.merchant.full_name || "merchant"}
            </p>
          )}
          <div className="mx-auto mt-5 max-w-sm">
            <QrPaySteps current="done" />
          </div>
        </div>

        <div className="qrp-pay-sheet qrp-stagger">
          <div className="space-y-5 p-4 sm:p-5">
            <div>
              <span className="qrp-section-label">Receipt</span>
              <div className="qrp-group">
                <div className="qrp-group-row">
                  <span className="qrp-row-muted text-[14px]">Transaction ID</span>
                  <span className="rounded-md bg-black/[0.04] px-2 py-0.5 font-mono text-[12px]">{ref}</span>
                </div>
                {data && <>
                  <div className="qrp-group-row">
                    <span className="qrp-row-muted text-[14px]">Method</span>
                    <span className="text-[14px] font-medium capitalize">{data.method.replace("_", " ")}</span>
                  </div>
                  <div className="qrp-group-row">
                    <span className="qrp-row-muted text-[14px]">Date</span>
                    <span className="text-[14px] font-medium">{new Date(data.paidAt).toLocaleString()}</span>
                  </div>
                  {data.merchant.username && (
                    <div className="qrp-group-row">
                      <span className="qrp-row-muted text-[14px]">Merchant</span>
                      <span className="text-[14px] font-medium">@{data.merchant.username}</span>
                    </div>
                  )}
                  {!!data.items?.length && data.items.map((it: any, i: number) => (
                    <div key={i} className="qrp-group-row">
                      <span className="truncate text-[14px] text-[var(--qrp-muted)]">{it.name} × {it.quantity}</span>
                      <span className="text-[14px] font-medium">{data.currency} {Number(it.line_total ?? it.unit_price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </>}
              </div>
            </div>

            {data?.after_payment_action === "download" && data.download_url && (
              <Button className="qrp-primary-btn w-full" onClick={() => window.open(data.download_url!, "_blank")}>
                <Download className="mr-1 h-4 w-4" />Download your file
              </Button>
            )}

            {data?.after_payment_action === "redirect" && data.redirect_url && (
              <Button className="qrp-primary-btn w-full" onClick={() => { window.location.href = data.redirect_url!; }}>
                <ExternalLink className="mr-1 h-4 w-4" />Continue
              </Button>
            )}

            {data && (
              <div>
                <span className="qrp-section-label">Share receipt</span>
                <div className="qrp-group">
                  <div className="qrp-group-body space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" className="h-11 rounded-[12px] border-0 bg-black/[0.04]" onClick={() => downloadQrPayReceipt(data)}>
                        <Download className="mr-1 h-4 w-4" />Download
                      </Button>
                      <Button variant="outline" className="h-11 rounded-[12px] border-0 bg-black/[0.04]" onClick={() => printQrPayReceipt(data)}>
                        <Printer className="mr-1 h-4 w-4" />Print
                      </Button>
                    </div>
                    <Input className="qrp-input" type="email" placeholder="Email receipt to…" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
                    <Button className="qrp-primary-btn w-full" onClick={emailReceipt}>
                      <Mail className="mr-1 h-4 w-4" />Email receipt
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <Button className="qrp-primary-btn w-full" onClick={() => navigate("/dashboard")}>
              Done
            </Button>
            <Button variant="ghost" className="w-full rounded-xl text-[var(--qrp-muted)] hover:bg-black/[0.04]" onClick={() => navigate("/dashboard")}>
              <Home className="mr-1 h-4 w-4" />Back to OpenPay
            </Button>
          </div>
        </div>

        <div className="flex justify-center pb-8 pt-4">
          <p className="qrp-footnote">Keep your Transaction ID for disputes.</p>
        </div>
      </div>
    </div>
  );
}
