import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, Printer, Mail, Home, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { buildQrPayReceiptHtml, downloadQrPayReceipt, printQrPayReceipt, type QrPayReceiptData } from "@/lib/qrPayReceipt";

interface ReceiptExtras {
  after_payment_action?: "receipt" | "download" | "redirect";
  download_url?: string | null;
  redirect_url?: string | null;
}

export default function QrPaySuccessPage() {
  const { token } = useParams();
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

  // Send email via the user's default mail client. This avoids requiring an
  // app-emails backend function and works on every device.
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
    // Open the user's email client pre-filled. Also offer the HTML receipt as a download.
    window.location.href = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try { downloadQrPayReceipt(data); } catch {}
    toast.success("Receipt opened in your email app");
  };

  return (
    <div className="min-h-screen qrp-page-bg flex flex-col">
      <div className="qrp-hero-v2 px-6 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-center">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">OpenPay · QR Pay</div>
        <div className="qrp-ring mx-auto mb-3 inline-flex h-24 w-24 items-center justify-center rounded-full bg-white/15 ring-[6px] ring-white/25 backdrop-blur-md">
          <CheckCircle2 className="h-14 w-14" />
        </div>
        <h1 className="text-[28px] font-bold tracking-tight">Payment complete</h1>
        {data && (
          <p className="mt-1 text-[15px] text-white/85">
            {data.currency} {Number(data.amount).toFixed(2)} paid to {data.merchant.full_name || "merchant"}
          </p>
        )}
        <div className="mx-auto mt-5 max-w-md">
          <QrPaySteps current="done" />
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-md space-y-4 p-4 qrp-pop">
        {/* Order receipt sheet */}
        <div className="qrp-sheet">
          <div className="qrp-sheet-head"><span>Receipt</span><span className="normal-case tracking-normal">Keep for disputes</span></div>
          <div className="space-y-2.5 p-4">
            <div className="qrp-row"><span className="qrp-row-muted">Transaction ID</span><span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{ref}</span></div>
            {data && <>
              <div className="qrp-row"><span className="qrp-row-muted">Method</span><span className="font-medium capitalize">{data.method.replace("_", " ")}</span></div>
              <div className="qrp-row"><span className="qrp-row-muted">Date</span><span className="font-medium">{new Date(data.paidAt).toLocaleString()}</span></div>
              {data.merchant.username && <div className="qrp-row"><span className="qrp-row-muted">Merchant</span><span className="font-medium">@{data.merchant.username}</span></div>}
              {!!data.items?.length && (
                <div className="space-y-1.5 pt-1">
                  {data.items.map((it: any, i: number) => (
                    <div key={i} className="qrp-row text-[13px]">
                      <span className="truncate qrp-row-muted">{it.name} × {it.quantity}</span>
                      <span className="font-medium">{data.currency} {Number(it.line_total ?? it.unit_price * it.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="qrp-total-row">
                <span className="text-sm font-semibold text-muted-foreground">Total paid</span>
                <span className="text-2xl font-extrabold tracking-tight">{data.currency} {Number(data.amount).toFixed(2)}</span>
              </div>
            </>}
          </div>
        </div>

        {data?.after_payment_action === "download" && data.download_url && (
          <div className="qrp-sheet p-4">
            <div className="mb-2 text-sm font-semibold">Your download is ready</div>
            <Button className="qrp-primary-btn w-full" onClick={() => window.open(data.download_url!, "_blank")}>
              <Download className="mr-1 h-4 w-4" />Download your file
            </Button>
          </div>
        )}

        {data?.after_payment_action === "redirect" && data.redirect_url && (
          <div className="qrp-sheet p-4">
            <div className="mb-2 text-sm font-semibold">Continue to merchant</div>
            <Button className="qrp-primary-btn w-full" onClick={() => window.location.href = data.redirect_url!}>
              <ExternalLink className="mr-1 h-4 w-4" />Continue
            </Button>
          </div>
        )}

        {data && (
          <div className="qrp-sheet">
            <div className="qrp-sheet-head"><span>Share receipt</span></div>
            <div className="space-y-2 p-4">
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => downloadQrPayReceipt(data)}><Download className="mr-1 h-4 w-4" />Download</Button>
                <Button variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => printQrPayReceipt(data)}><Printer className="mr-1 h-4 w-4" />Print / PDF</Button>
              </div>
              <Input className="qrp-input" type="email" placeholder="Email receipt to…" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              <Button className="qrp-primary-btn w-full" onClick={emailReceipt}><Mail className="mr-1 h-4 w-4" />Email receipt</Button>
              <p className="text-center text-[11px] text-muted-foreground">Opens your email app with the receipt details.</p>
            </div>
          </div>
        )}

        <Button variant="ghost" className="w-full rounded-xl text-white hover:bg-white/15 hover:text-white" onClick={() => navigate("/dashboard")}>
          <Home className="mr-1 h-4 w-4" />Back to OpenPay
        </Button>
        <div className="flex justify-center pb-4">
          <p className="qrp-footnote">Keep your Transaction ID for any disputes or claims.</p>
        </div>
      </div>
    </div>
  );
}
