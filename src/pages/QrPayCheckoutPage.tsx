import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Wallet, CreditCard, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isPiBrowserUAOnly } from "@/lib/appSecurity";

interface QrPayData {
  id: string;
  token: string;
  title: string;
  description?: string | null;
  currency: string;
  total: number;
  status: string;
  allow_pi: boolean;
  allow_wallet: boolean;
  allow_virtual_card: boolean;
  allow_guest: boolean;
  merchant: { id: string; full_name?: string; username?: string; avatar_url?: string };
  items: Array<{ id: string; name: string; description?: string; quantity: number; unit_price: number; line_total: number }>;
}

export default function QrPayCheckoutPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<QrPayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [cardNum, setCardNum] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    (async () => {
      const { data: res, error } = await (supabase as any).rpc("qr_pay_get_by_token", { p_token: token });
      if (error || !res) { setData(null); setLoading(false); return; }
      setData(res as QrPayData);
      setLoading(false);
    })();
  }, [token]);

  const requireSignIn = () => {
    toast.error("Please sign in first");
    navigate(`/auth?return=/qr-pay/${token}`);
  };

  const goSuccess = (ref: string, method: string) => {
    sessionStorage.setItem(`qrp_receipt_${ref}`, JSON.stringify({
      transactionRef: ref, method, paidAt: new Date().toISOString(),
      amount: data!.total, currency: data!.currency,
      merchant: data!.merchant, title: data!.title, description: data!.description,
      items: data!.items, payer: { name: payerName, email: payerEmail },
    }));
    navigate(`/qr-pay/${token}/success?ref=${ref}`);
  };

  const payWallet = async () => {
    if (!session) { requireSignIn(); return; }
    setPaying(true);
    const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_wallet", {
      p_token: token, p_payer_name: payerName || null, p_payer_email: payerEmail || null,
    });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    goSuccess(res.transaction_ref, "wallet");
  };

  const payCard = async () => {
    if (!session) { requireSignIn(); return; }
    if (!cardNum || !cardCvc) { toast.error("Enter card details"); return; }
    setPaying(true);
    const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_virtual_card", {
      p_token: token, p_card_number: cardNum, p_cvc: cardCvc,
      p_payer_name: payerName || null, p_payer_email: payerEmail || null,
    });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    goSuccess(res.transaction_ref, "virtual_card");
  };

  const payPi = async () => {
    if (typeof window === "undefined" || !(window as any).Pi) {
      toast.error("Pi SDK not available. Please open in Pi Browser.");
      return;
    }
    if (!data!.allow_guest && !session) { requireSignIn(); return; }
    setPaying(true);
    try {
      const Pi = (window as any).Pi;
      // Approximate Pi amount: treat 1 PI = 1 USD-equivalent unit. Total is in merchant's currency.
      const piAmount = Number(data!.total);
      await new Promise<void>((resolve, reject) => {
        Pi.createPayment(
          { amount: piAmount, memo: `OpenPay QR · ${data!.title || data!.token}`.slice(0, 64),
            metadata: { qr_token: data!.token, kind: "qr_pay" } },
          {
            onReadyForServerApproval: async (paymentId: string) => {
              await supabase.functions.invoke("pi-platform", { body: { action: "approve", paymentId } });
            },
            onReadyForServerCompletion: async (paymentId: string, txid: string) => {
              await supabase.functions.invoke("pi-platform", { body: { action: "complete", paymentId, txid } });
              const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_pi", {
                p_token: token, p_pi_payment_id: paymentId, p_pi_txid: txid,
                p_payer_name: payerName || null, p_payer_email: payerEmail || null,
                p_payer_username: null,
              });
              if (error) { reject(new Error(error.message)); return; }
              goSuccess(res.transaction_ref, "pi");
              resolve();
            },
            onCancel: () => reject(new Error("Payment cancelled")),
            onError: (e: any) => reject(new Error(e?.message || "Pi payment failed")),
          },
        );
      });
    } catch (e: any) {
      toast.error(e?.message || "Pi payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
  if (!data) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-bold mb-2">Payment not found</h1><p className="text-muted-foreground">This QR code is invalid or no longer available.</p></div>;
  if (data.status !== "active") return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><Badge variant="secondary" className="mb-3">{data.status}</Badge><h1 className="text-xl font-bold mb-2">This payment is no longer active</h1></div>;

  const piInPi = isPiBrowserUAOnly();
  const tabs = [
    data.allow_pi && (piInPi || (window as any).Pi) ? "pi" : null,
    data.allow_wallet ? "wallet" : null,
    data.allow_virtual_card ? "card" : null,
  ].filter(Boolean) as string[];
  const defaultTab = tabs[0] || "wallet";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-primary-foreground p-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <img src="/openpay-logo.jpg" alt="OpenPay" className="h-9 w-9 rounded-lg"/>
          <div className="flex-1">
            <div className="text-sm opacity-90">OpenPay Checkout</div>
            <div className="font-bold flex items-center gap-1"><ShieldCheck className="h-4 w-4"/>Secure QR Payment</div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-4">
        {/* Merchant */}
        <Card><CardContent className="p-4 flex items-center gap-3">
          {data.merchant.avatar_url ? <img src={data.merchant.avatar_url} className="h-12 w-12 rounded-full object-cover"/> : <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><User className="h-6 w-6"/></div>}
          <div>
            <div className="font-semibold">{data.merchant.full_name || "Merchant"}</div>
            {data.merchant.username && <div className="text-xs text-muted-foreground">@{data.merchant.username}</div>}
          </div>
        </CardContent></Card>

        {/* Items */}
        <Card><CardContent className="p-4">
          {data.title && <div className="font-semibold mb-1">{data.title}</div>}
          {data.description && <div className="text-sm text-muted-foreground mb-3">{data.description}</div>}
          <div className="divide-y">
            {data.items.map(it => (
              <div key={it.id} className="py-2 flex justify-between text-sm">
                <div><span className="font-medium">{it.name}</span> <span className="text-muted-foreground">× {it.quantity}</span>{it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}</div>
                <div>{data.currency} {Number(it.line_total).toFixed(2)}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 pt-3 border-t font-bold text-lg">
            <span>Total</span><span>{data.currency} {Number(data.total).toFixed(2)}</span>
          </div>
        </CardContent></Card>

        {/* Payer info */}
        <Card><CardContent className="p-4 space-y-2">
          <Label className="text-xs">Your name (for receipt)</Label>
          <Input value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Your name"/>
          <Label className="text-xs">Email (optional, for emailed receipt)</Label>
          <Input type="email" value={payerEmail} onChange={e => setPayerEmail(e.target.value)} placeholder="you@example.com"/>
        </CardContent></Card>

        {/* Methods */}
        <Card><CardContent className="p-4">
          <Tabs defaultValue={defaultTab}>
            <TabsList className="w-full grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
              {tabs.includes("pi") && <TabsTrigger value="pi">Pi</TabsTrigger>}
              {tabs.includes("wallet") && <TabsTrigger value="wallet"><Wallet className="h-4 w-4 mr-1"/>Wallet</TabsTrigger>}
              {tabs.includes("card") && <TabsTrigger value="card"><CreditCard className="h-4 w-4 mr-1"/>Card</TabsTrigger>}
            </TabsList>
            {tabs.includes("pi") && <TabsContent value="pi" className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">Pay with your Pi balance via Pi Browser. {data.allow_guest ? "Guest checkout allowed." : "Sign-in required."}</p>
              <Button className="w-full bg-[#7d3cff] hover:bg-[#6a2fe0] text-white" disabled={paying} onClick={payPi}>{paying ? "Processing…" : `Pay ${data.total.toFixed(2)} π`}</Button>
            </TabsContent>}
            {tabs.includes("wallet") && <TabsContent value="wallet" className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">Pay from your OpenPay wallet balance.</p>
              <Button className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-primary-foreground" disabled={paying} onClick={payWallet}>{paying ? "Processing…" : `Pay ${data.currency} ${data.total.toFixed(2)}`}</Button>
              {!session && <p className="text-xs text-center mt-2 text-muted-foreground">You'll be asked to sign in.</p>}
            </TabsContent>}
            {tabs.includes("card") && <TabsContent value="card" className="pt-3 space-y-2">
              <Input placeholder="Card number" value={cardNum} onChange={e => setCardNum(e.target.value)}/>
              <Input placeholder="CVC" maxLength={3} value={cardCvc} onChange={e => setCardCvc(e.target.value)}/>
              <Button className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-primary-foreground" disabled={paying} onClick={payCard}>{paying ? "Processing…" : `Pay with virtual card`}</Button>
            </TabsContent>}
          </Tabs>
        </CardContent></Card>

        <p className="text-center text-xs text-muted-foreground">Powered by OpenPay · Transactions are protected by dispute resolution.</p>
      </div>
    </div>
  );
}
