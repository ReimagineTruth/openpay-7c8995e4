import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Wallet, CreditCard, User, Heart, Coffee } from "lucide-react";
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
  payment_type: "product" | "digital" | "donation" | "tip";
  after_payment_action: "receipt" | "download" | "redirect";
  download_url?: string | null;
  redirect_url?: string | null;
  suggested_amount?: number | null;
  min_amount?: number | null;
  allow_custom_amount?: boolean;
  cover_image_url?: string | null;
  collect_delivery?: boolean;
  delivery_fields?: string[];
  merchant: { id: string; full_name?: string; username?: string; avatar_url?: string };
  items: Array<{ id: string; name: string; description?: string; image_url?: string; quantity: number; unit_price: number; line_total: number }>;
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
  const [customAmount, setCustomAmount] = useState<string>("");
  const [payerPhone, setPayerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    (async () => {
      const { data: res, error } = await (supabase as any).rpc("qr_pay_get_by_token", { p_token: token });
      if (error || !res) { setData(null); setLoading(false); return; }
      setData(res as QrPayData);
      if (res?.suggested_amount) setCustomAmount(String(res.suggested_amount));
      setLoading(false);
    })();
  }, [token]);

  const isFlexible = !!data && (data.payment_type === "donation" || data.payment_type === "tip");
  const chargeAmount = useMemo(() => {
    if (!data) return 0;
    if (isFlexible) return Number(customAmount || 0);
    return Number(data.total);
  }, [data, isFlexible, customAmount]);

  const validateAmount = () => {
    if (chargeAmount <= 0) { toast.error("Enter an amount"); return false; }
    if (data?.min_amount && chargeAmount < Number(data.min_amount)) {
      toast.error(`Minimum ${data.currency} ${Number(data.min_amount).toFixed(2)}`);
      return false;
    }
    return true;
  };

  const validateDelivery = () => {
    if (!data?.collect_delivery) return true;
    const f = data.delivery_fields || [];
    if (f.includes("name") && !payerName.trim()) { toast.error("Your name is required"); return false; }
    if (f.includes("email") && !payerEmail.trim()) { toast.error("Email is required"); return false; }
    if (f.includes("phone") && !payerPhone.trim()) { toast.error("Phone is required"); return false; }
    if (f.includes("address") && !deliveryAddress.trim()) { toast.error("Delivery address is required"); return false; }
    return true;
  };

  const deliveryPayload = () => ({
    p_payer_phone: payerPhone || null,
    p_delivery_address: deliveryAddress || null,
    p_delivery_notes: deliveryNotes || null,
  });


  const requireSignIn = () => {
    toast.error("Please sign in first");
    navigate(`/auth?return=/qr-pay/${token}`);
  };

  const goAfterPayment = (ref: string, method: string) => {
    const receipt = {
      transactionRef: ref, method, paidAt: new Date().toISOString(),
      amount: chargeAmount, currency: data!.currency,
      merchant: data!.merchant, title: data!.title, description: data!.description,
      items: data!.items, payer: { name: payerName, email: payerEmail },
      after_payment_action: data!.after_payment_action,
      download_url: data!.download_url,
      redirect_url: data!.redirect_url,
    };
    sessionStorage.setItem(`qrp_receipt_${ref}`, JSON.stringify(receipt));
    if (data!.after_payment_action === "redirect" && data!.redirect_url) {
      try { window.location.href = data!.redirect_url; return; } catch {}
    }
    navigate(`/qr-pay/${token}/success?ref=${ref}`);
  };

  const payWallet = async () => {
    if (!validateAmount() || !validateDelivery()) return;
    if (!session) { requireSignIn(); return; }
    setPaying(true);
    const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_wallet", {
      p_token: token, p_payer_name: payerName || null, p_payer_email: payerEmail || null,
      p_amount: isFlexible ? chargeAmount : null,
      ...deliveryPayload(),
    });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    goAfterPayment(res.transaction_ref, "wallet");
  };

  const payCard = async () => {
    if (!validateAmount() || !validateDelivery()) return;
    if (!session) { requireSignIn(); return; }
    if (!cardNum || !cardCvc) { toast.error("Enter card details"); return; }
    setPaying(true);
    const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_virtual_card", {
      p_token: token, p_card_number: cardNum, p_cvc: cardCvc,
      p_payer_name: payerName || null, p_payer_email: payerEmail || null,
      p_amount: isFlexible ? chargeAmount : null,
      ...deliveryPayload(),
    });
    setPaying(false);
    if (error) { toast.error(error.message); return; }
    goAfterPayment(res.transaction_ref, "virtual_card");
  };

  const payPi = async () => {
    if (!validateAmount() || !validateDelivery()) return;
    if (typeof window === "undefined" || !(window as any).Pi) {
      toast.error("Pi SDK not available. Please open in Pi Browser.");
      return;
    }
    if (!data!.allow_guest && !session) { requireSignIn(); return; }
    setPaying(true);
    try {
      const Pi = (window as any).Pi;
      // Ensure the user is authenticated with "payments" scope before creating a payment.
      try {
        await Pi.authenticate(["username", "payments"], async (incomplete: any) => {
          // If there is an incomplete payment, complete it via our edge function
          try {
            if (incomplete?.identifier && incomplete?.transaction?.txid) {
              await supabase.functions.invoke("pi-platform", {
                body: { action: "complete", paymentId: incomplete.identifier, txid: incomplete.transaction.txid },
              });
            }
          } catch {}
        });
      } catch (e: any) {
        throw new Error(e?.message || "Pi sign-in required");
      }

      const piAmount = chargeAmount;
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
                p_amount: isFlexible ? chargeAmount : null,
                ...deliveryPayload(),
              });
              if (error) { reject(new Error(error.message)); return; }
              goAfterPayment(res.transaction_ref, "pi");
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
  const TypeIcon = data.payment_type === "donation" ? Heart : data.payment_type === "tip" ? Coffee : null;

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
        {data.cover_image_url && (
          <Card><CardContent className="p-0"><img src={data.cover_image_url} className="w-full h-44 object-cover rounded-lg"/></CardContent></Card>
        )}

        {/* Merchant */}
        <Card><CardContent className="p-4 flex items-center gap-3">
          {data.merchant.avatar_url ? <img src={data.merchant.avatar_url} className="h-12 w-12 rounded-full object-cover"/> : <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center"><User className="h-6 w-6"/></div>}
          <div>
            <div className="font-semibold flex items-center gap-2">{data.merchant.full_name || "Merchant"}{TypeIcon && <TypeIcon className="h-4 w-4 text-paypal-blue"/>}</div>
            {data.merchant.username && <div className="text-xs text-muted-foreground">@{data.merchant.username}</div>}
          </div>
        </CardContent></Card>

        {/* Items / Amount */}
        {isFlexible ? (
          <Card><CardContent className="p-4 space-y-3">
            <div>
              {data.title && <div className="font-semibold">{data.title}</div>}
              {data.description && <div className="text-sm text-muted-foreground mt-1">{data.description}</div>}
            </div>
            <div>
              <Label className="text-xs">{data.payment_type === "tip" ? "Tip amount" : "Donation amount"} ({data.currency})</Label>
              <Input type="number" inputMode="decimal" step="0.01" min={data.min_amount || 0}
                     value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder="0.00"/>
              <div className="flex gap-2 mt-2">
                {[1,5,10,25].map(v => (
                  <Button key={v} type="button" variant="outline" size="sm" onClick={() => setCustomAmount(String(v))}>
                    {data.currency} {v}
                  </Button>
                ))}
              </div>
              {data.min_amount ? <p className="text-xs text-muted-foreground mt-1">Minimum: {data.currency} {Number(data.min_amount).toFixed(2)}</p> : null}
            </div>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="p-4">
            {data.title && <div className="font-semibold mb-1">{data.title}</div>}
            {data.description && <div className="text-sm text-muted-foreground mb-3">{data.description}</div>}
            <div className="divide-y">
              {data.items.map(it => (
                <div key={it.id} className="py-2 flex justify-between text-sm gap-2">
                  {it.image_url && <img src={it.image_url} className="h-10 w-10 rounded object-cover"/>}
                  <div className="flex-1"><span className="font-medium">{it.name}</span> <span className="text-muted-foreground">× {it.quantity}</span>{it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}</div>
                  <div>{data.currency} {Number(it.line_total).toFixed(2)}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t font-bold text-lg">
              <span>Total</span><span>{data.currency} {Number(data.total).toFixed(2)}</span>
            </div>
          </CardContent></Card>
        )}

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
              <Button className="w-full bg-[#7d3cff] hover:bg-[#6a2fe0] text-white" disabled={paying} onClick={payPi}>{paying ? "Processing…" : `Pay ${chargeAmount.toFixed(2)} π`}</Button>
            </TabsContent>}
            {tabs.includes("wallet") && <TabsContent value="wallet" className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">Pay from your OpenPay wallet balance.</p>
              <Button className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-primary-foreground" disabled={paying} onClick={payWallet}>{paying ? "Processing…" : `Pay ${data.currency} ${chargeAmount.toFixed(2)}`}</Button>
              {!session && <p className="text-xs text-center mt-2 text-muted-foreground">You'll be asked to sign in.</p>}
            </TabsContent>}
            {tabs.includes("card") && <TabsContent value="card" className="pt-3 space-y-2">
              <Input placeholder="Card number" value={cardNum} onChange={e => setCardNum(e.target.value)}/>
              <Input placeholder="CVC" maxLength={4} value={cardCvc} onChange={e => setCardCvc(e.target.value)}/>
              <Button className="w-full bg-paypal-blue hover:bg-paypal-blue/90 text-primary-foreground" disabled={paying} onClick={payCard}>{paying ? "Processing…" : `Pay with virtual card`}</Button>
            </TabsContent>}
          </Tabs>
        </CardContent></Card>

        <p className="text-center text-xs text-muted-foreground">Powered by OpenPay · Transactions are protected by dispute resolution.</p>
      </div>
    </div>
  );
}
