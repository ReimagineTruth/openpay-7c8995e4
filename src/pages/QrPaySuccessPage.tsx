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
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-primary-foreground p-6 text-center">
        <CheckCircle2 className="h-14 w-14 mx-auto mb-2"/>
        <h1 className="text-2xl font-bold">Payment Successful</h1>
        {data && <p className="opacity-90 mt-1">{data.currency} {Number(data.amount).toFixed(2)} paid to {data.merchant.full_name || "merchant"}</p>}
      </div>

      <div className="max-w-md mx-auto p-4 w-full space-y-4">
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Transaction ID</span><span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{ref}</span></div>
          {data && <>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Method</span><span className="capitalize">{data.method.replace("_"," ")}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Date</span><span>{new Date(data.paidAt).toLocaleString()}</span></div>
            {data.merchant.username && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Merchant</span><span>@{data.merchant.username}</span></div>}
          </>}
        </CardContent></Card>

        {data?.after_payment_action === "download" && data.download_url && (
          <Card><CardContent className="p-4">
            <div className="text-sm font-semibold mb-2">Your download is ready</div>
            <Button className="w-full" onClick={() => window.open(data.download_url!, "_blank")}>
              <Download className="h-4 w-4 mr-1"/>Download your file
            </Button>
          </CardContent></Card>
        )}

        {data?.after_payment_action === "redirect" && data.redirect_url && (
          <Card><CardContent className="p-4">
            <div className="text-sm font-semibold mb-2">Continue to merchant</div>
            <Button className="w-full" onClick={() => window.location.href = data.redirect_url!}>
              <ExternalLink className="h-4 w-4 mr-1"/>Continue
            </Button>
          </CardContent></Card>
        )}

        {data && (
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Receipt</div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadQrPayReceipt(data)}><Download className="h-4 w-4 mr-1"/>Download</Button>
              <Button variant="outline" className="flex-1" onClick={() => printQrPayReceipt(data)}><Printer className="h-4 w-4 mr-1"/>Print / Save PDF</Button>
            </div>
            <div className="pt-2">
              <Input type="email" placeholder="Email receipt to…" value={emailTo} onChange={e => setEmailTo(e.target.value)}/>
              <Button className="w-full mt-2" onClick={emailReceipt}><Mail className="h-4 w-4 mr-1"/>Email receipt</Button>
              <p className="text-[11px] text-muted-foreground mt-1 text-center">Opens your email app with the receipt details.</p>
            </div>
          </CardContent></Card>
        )}

        <Button variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}><Home className="h-4 w-4 mr-1"/>Back to OpenPay</Button>
        <p className="text-center text-xs text-muted-foreground">Keep your Transaction ID for any disputes or claims.</p>
      </div>
    </div>
  );
}
