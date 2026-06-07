import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, Printer, Mail, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildQrPayReceiptHtml, downloadQrPayReceipt, printQrPayReceipt, type QrPayReceiptData } from "@/lib/qrPayReceipt";

export default function QrPaySuccessPage() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ref = params.get("ref") || "";
  const [data, setData] = useState<QrPayReceiptData | null>(null);
  const [emailing, setEmailing] = useState(false);
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

  const sendEmail = async () => {
    if (!data || !emailTo) { toast.error("Enter an email"); return; }
    setEmailing(true);
    try {
      const html = buildQrPayReceiptHtml(data);
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "qr-payment-receipt",
          recipientEmail: emailTo,
          idempotencyKey: `qrp-receipt-${data.transactionRef}`,
          templateData: {
            transactionRef: data.transactionRef,
            amount: data.amount,
            currency: data.currency,
            merchantName: data.merchant.full_name || "Merchant",
            method: data.method,
            html,
          },
        },
      });
      if (error) throw error;
      toast.success("Receipt emailed");
    } catch (e: any) {
      toast.error(e?.message || "Could not send email (template may not be set up).");
    } finally {
      setEmailing(false);
    }
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

        {data && (
          <Card><CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Receipt</div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => downloadQrPayReceipt(data)}><Download className="h-4 w-4 mr-1"/>Download</Button>
              <Button variant="outline" className="flex-1" onClick={() => printQrPayReceipt(data)}><Printer className="h-4 w-4 mr-1"/>Print / Save PDF</Button>
            </div>
            <div className="pt-2">
              <Input type="email" placeholder="Email receipt to…" value={emailTo} onChange={e => setEmailTo(e.target.value)}/>
              <Button className="w-full mt-2" disabled={emailing} onClick={sendEmail}><Mail className="h-4 w-4 mr-1"/>{emailing ? "Sending…" : "Email receipt"}</Button>
            </div>
          </CardContent></Card>
        )}

        <Button variant="ghost" className="w-full" onClick={() => navigate("/dashboard")}><Home className="h-4 w-4 mr-1"/>Back to OpenPay</Button>
        <p className="text-center text-xs text-muted-foreground">Keep your Transaction ID for any disputes or claims.</p>
      </div>
    </div>
  );
}
