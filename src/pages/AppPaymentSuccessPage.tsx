import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Download, Share2, Home, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import AuthMark from "@/components/AuthMark";

const AppPaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [transactionId, setTransactionId] = useState("");
  const [appName, setAppName] = useState("");

  useEffect(() => {
    const tx = searchParams.get("tx") || "";
    const app = searchParams.get("app") || "";
    setTransactionId(tx);
    setAppName(app);
  }, [searchParams]);

  const handleShareReceipt = async () => {
    const receiptUrl = `${window.location.origin}/app-payment/receipt?tx=${transactionId}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Payment Receipt - ${appName}`,
          text: `Payment completed successfully for ${appName}`,
          url: receiptUrl
        });
      } catch (error) {
        // Fallback to clipboard if share fails
        await navigator.clipboard.writeText(receiptUrl);
        toast.success("Receipt link copied to clipboard");
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(receiptUrl);
      toast.success("Receipt link copied to clipboard");
    }
  };

  const handleDownloadReceipt = () => {
    const receiptData = {
      transactionId,
      appName,
      date: new Date().toISOString(),
      status: "completed"
    };
    
    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${transactionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Receipt downloaded");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="flex h-14 items-center border-b border-border bg-white px-4">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="mx-3 h-7 w-px bg-border" />
        <p className="flex items-center gap-2 text-xl font-medium text-foreground">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          Payment Successful
        </p>
      </div>

      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>

          <h1 className="mb-2 text-3xl font-bold text-foreground">Payment Completed!</h1>
          <p className="mb-6 text-lg text-muted-foreground">
            Your payment for <span className="font-semibold text-foreground">{appName}</span> was successful
          </p>

          <div className="mb-8 rounded-xl border border-border bg-white p-6 text-left">
            <h3 className="mb-4 text-lg font-semibold text-foreground">Transaction Details</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction ID</span>
                <span className="font-mono text-sm text-foreground">{transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">App</span>
                <span className="font-medium text-foreground">{appName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-emerald-600">Completed</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleShareReceipt}
              className="w-full h-12 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share Receipt
            </Button>
            
            <Button
              onClick={handleDownloadReceipt}
              variant="outline"
              className="w-full h-12 rounded-full"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Receipt
            </Button>
            
            <Button
              onClick={() => navigate("/menu")}
              variant="outline"
              className="w-full h-12 rounded-full"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Powered by OpenPay</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppPaymentSuccessPage;
