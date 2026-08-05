import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, Wallet, CreditCard, User, Heart, Coffee, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QrPayHeader from "@/components/qrpay/QrPayHeader";
import QrPaySteps from "@/components/qrpay/QrPaySteps";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { isPiBrowserUAOnly } from "@/lib/appSecurity";
import BrandLogo from "@/components/BrandLogo";
import { openExternalUrl } from "@/lib/externalLink";
import {
  PRO_PAY_ASSETS,
  PRO_TOPUP_URL,
  buildProPayUrl,
  buildProXferNote,
  makeProXferRef,
  formatProDestinationPreview,
} from "@/lib/openpayProTransfer";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";


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
  pro_settlement_to?: string | null;

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
  const [savedCard, setSavedCard] = useState<any>(null);
  const [showCard, setShowCard] = useState(false);
  const [method, setMethod] = useState<string | null>(null);

  const [customAmount, setCustomAmount] = useState<string>("");
  const [payerPhone, setPayerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: s }) => {
      setSession(s.session);
      const uid = s.session?.user?.id;
      if (!uid) return;
      // Auto-fill virtual card details (same pattern as OpenNFT checkout)
      const { data: cards } = await (supabase as any)
        .from("virtual_cards").select("card_number, cvc, expiry_month, expiry_year, cardholder_name")
        .eq("user_id", uid).eq("is_active", true).limit(1);
      if (cards && cards[0]) {
        setSavedCard(cards[0]);
        setCardNum(String(cards[0].card_number || ""));
        setCardCvc(String(cards[0].cvc || ""));
      }
    });
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

  const settleToPro = async (ref: string) => {
    if (!data?.pro_settlement_to) return;
    try {
      await supabase.functions.invoke("qr-pay-pro-settle", {
        body: { token: data.token, transaction_ref: ref },
      });
    } catch (e) {
      console.error("OpenPay Pro settlement failed:", e);
    }
  };

  const goAfterPayment = async (ref: string, method: string) => {
    await settleToPro(ref);
    const receipt = {
      transactionRef: ref, method, paidAt: new Date().toISOString(),
      amount: chargeAmount, currency: data!.currency,
      merchant: data!.merchant, title: data!.title, description: data!.description,
      items: data!.items, payer: { name: payerName, email: payerEmail },
      after_payment_action: data!.after_payment_action,
      download_url: data!.download_url,
      redirect_url: data!.redirect_url,
      pro_settlement_to: data!.pro_settlement_to || null,
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
  const activeMethod = method && tabs.includes(method) ? method : (tabs[0] || "wallet");

  const TypeIcon = data.payment_type === "donation" ? Heart : data.payment_type === "tip" ? Coffee : null;

  const subtotal = isFlexible ? chargeAmount : Number(data.total);
  const payLabel = paying
    ? "Processing…"
    : activeMethod === "pi"
      ? `Pay ${chargeAmount.toFixed(2)} π`
      : `Pay ${data.currency} ${chargeAmount.toFixed(2)}`;
  const onPay = activeMethod === "pi" ? payPi : activeMethod === "card" ? payCard : payWallet;

  return (
    <div className="min-h-screen qrp-page-bg">
      <QrPayHeader
        eyebrow="OpenPay Checkout"
        title="Secure checkout"
        subtitle={`You're paying ${data.merchant.full_name || "a merchant"} · protected by OpenPay dispute resolution`}
        icon={ShieldCheck}
      >
        <QrPaySteps current="pay" />
      </QrPayHeader>

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 p-4 lg:grid-cols-12 qrp-pop">
        {/* ── Order column ─────────────────────────────── */}
        <div className="space-y-4 lg:col-span-7 qrp-stagger">
          <div className="qrp-sheet">
            {data.cover_image_url && (
              <img src={data.cover_image_url} alt={data.title} className="h-44 w-full object-cover" />
            )}
            <div className="flex items-center gap-3 p-4">
              {data.merchant.avatar_url
                ? <img src={data.merchant.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-paypal-blue/15" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted"><User className="h-6 w-6" /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="truncate">{data.merchant.full_name || "Merchant"}</span>
                  {TypeIcon && <TypeIcon className="h-4 w-4 shrink-0 text-paypal-blue" />}
                </div>
                {data.merchant.username && <div className="truncate text-xs text-muted-foreground">@{data.merchant.username}</div>}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paypal-blue/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-paypal-blue">
                <ShieldCheck className="h-3 w-3" /> Verified
              </span>
            </div>
            {data.pro_settlement_to && (
              <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white"
                  style={{ background: "#ab9ff2" }}
                >
                  P
                </span>
                Settles to OpenPay Pro · <span className="font-semibold text-foreground">{data.pro_settlement_to}</span>
              </div>
            )}

          </div>

          {/* Order summary */}
          <div className="qrp-sheet">
            <div className="qrp-sheet-head">
              <span>Order summary</span>
              {!isFlexible && <span className="normal-case tracking-normal">{data.items.length} item{data.items.length === 1 ? "" : "s"}</span>}
            </div>
            <div className="space-y-3 p-4">
              {data.title && <div className="text-base font-semibold text-foreground">{data.title}</div>}
              {data.description && <p className="-mt-1 text-sm text-muted-foreground">{data.description}</p>}

              {isFlexible ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {data.payment_type === "tip" ? "Tip amount" : "Donation amount"} ({data.currency})
                  </Label>
                  <Input className="qrp-input h-12 text-lg font-semibold" type="number" inputMode="decimal" step="0.01"
                         min={data.min_amount || 0} value={customAmount}
                         onChange={e => setCustomAmount(e.target.value)} placeholder="0.00" />
                  <div className="flex flex-wrap gap-2">
                    {[1, 5, 10, 25].map(v => (
                      <button key={v} type="button" onClick={() => setCustomAmount(String(v))}
                        className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                          Number(customAmount) === v ? "border-paypal-blue bg-paypal-blue text-primary-foreground" : "border-border bg-card text-foreground hover:border-paypal-blue/50"
                        }`}>{data.currency} {v}</button>
                    ))}
                  </div>
                  {data.min_amount ? <p className="text-xs text-muted-foreground">Minimum {data.currency} {Number(data.min_amount).toFixed(2)}</p> : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {data.items.map(it => (
                    <div key={it.id} className="flex items-center gap-3">
                      {it.image_url
                        ? <img src={it.image_url} alt={it.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                        : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">{it.quantity}×</span>}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{it.name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {it.description ? `${it.description} · ` : ""}Qty {it.quantity}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold">{data.currency} {Number(it.line_total).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <div className="qrp-row"><span className="qrp-row-muted">Subtotal</span><span className="font-medium">{data.currency} {subtotal.toFixed(2)}</span></div>
                <div className="qrp-row"><span className="qrp-row-muted">Fees</span><span className="font-medium text-emerald-600">No fee</span></div>
                <div className="qrp-total-row">
                  <span className="text-sm font-semibold text-muted-foreground">Total</span>
                  <span className="text-2xl font-extrabold tracking-tight">
                    {activeMethod === "pi" ? `${chargeAmount.toFixed(2)} π` : `${data.currency} ${chargeAmount.toFixed(2)}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Buyer + delivery */}
          <div className="qrp-sheet">
            <div className="qrp-sheet-head"><span>Your details</span><span className="normal-case tracking-normal">For your receipt</span></div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Name{data.collect_delivery && (data.delivery_fields || []).includes("name") ? " *" : ""}
                  </Label>
                  <Input className="qrp-input" value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Email{data.collect_delivery && (data.delivery_fields || []).includes("email") ? " *" : ""}
                  </Label>
                  <Input className="qrp-input" type="email" value={payerEmail} onChange={e => setPayerEmail(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>

              {data.collect_delivery && (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/40 p-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Delivery details</div>
                  {(data.delivery_fields || []).includes("phone") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone *</Label>
                      <Input className="qrp-input" value={payerPhone} onChange={e => setPayerPhone(e.target.value)} placeholder="+1 555 0100" />
                    </div>
                  )}
                  {(data.delivery_fields || []).includes("address") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Shipping address *</Label>
                      <textarea className="qrp-input w-full p-2 text-sm" style={{ height: "auto" }} rows={3}
                                value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="Street, city, postal code, country" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Notes (optional)</Label>
                    <textarea className="qrp-input w-full p-2 text-sm" style={{ height: "auto" }} rows={2}
                              value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                              placeholder="Anything the merchant should know" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Payment column ───────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="qrp-sheet lg:sticky lg:top-4">
            <div className="qrp-sheet-head">
              <span>Payment method</span>
              <span className="inline-flex items-center gap-1 normal-case tracking-normal">
                <ShieldCheck className="h-3.5 w-3.5 text-paypal-blue" /> Secure
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-2">
                {tabs.includes("wallet") && (
                  <PayOpt active={activeMethod === "wallet"} onClick={() => setMethod("wallet")}
                    logo={<span className="flex h-7 w-7 items-center justify-center rounded-full bg-paypal-blue/10"><BrandLogo className="h-5 w-5 text-paypal-blue" /></span>}
                    label="OpenPay Balance (OUSD)"
                    hint={`Pay ${data.currency} ${chargeAmount.toFixed(2)} from your wallet`} />
                )}
                {tabs.includes("pi") && (
                  <PayOpt active={activeMethod === "pi"} onClick={() => setMethod("pi")}
                    logo={<img src={PURE_PI_ICON_URL} alt="Pi Network" className="h-7 w-7 rounded-full object-cover" />}
                    label="Pi Network"
                    hint={data.allow_guest ? "Pi Browser · guest checkout allowed" : "Pi Browser · sign-in required"} />
                )}
                {tabs.includes("card") && (
                  <PayOpt active={activeMethod === "card"} onClick={() => setMethod("card")}
                    logo={
                      <span className="flex h-6 w-9 items-center justify-center rounded-[6px] bg-gradient-to-br from-[#0b2d6b] to-[#0070ba] shadow-sm">
                        <BrandLogo className="h-3.5 w-3.5 text-white" />
                      </span>
                    }
                    label="Virtual Card"
                    hint={savedCard ? `OpenPay card •••• ${String(savedCard.card_number).slice(-4)}` : "Pay with your OpenPay virtual card"} />
                )}
              </div>

              {activeMethod === "card" && (
                <div className="space-y-2 pt-1 qrp-rise">
                  {savedCard ? (
                    <div className="rounded-2xl bg-gradient-to-br from-[#0b2d6b] to-[#0070ba] px-3.5 py-3 text-white shadow-[0_14px_30px_-18px_rgba(0,60,140,0.9)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">OpenPay Virtual Card</p>
                          <p className="mt-1 font-mono text-base font-semibold tracking-wider">
                            {showCard
                              ? String(savedCard.card_number).replace(/(.{4})/g, "$1 ").trim()
                              : `•••• •••• •••• ${String(savedCard.card_number).slice(-4)}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => setShowCard(v => !v)}
                            aria-label={showCard ? "Hide card details" : "Show card details"}
                            className="rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25 active:scale-95">
                            {showCard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <CreditCard className="h-6 w-6 text-white/85" />
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                        <div className="min-w-0">
                          <p className="text-white/60">Card holder</p>
                          <p className="truncate font-semibold uppercase">
                            {showCard ? (savedCard.cardholder_name || "OPENPAY USER") : "•••• ••••"}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/60">Expires</p>
                          <p className="font-semibold">
                            {showCard ? `${String(savedCard.expiry_month).padStart(2, "0")}/${String(savedCard.expiry_year).slice(-2)}` : "••/••"}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/60">CVC</p>
                          <p className="font-semibold">{showCard ? savedCard.cvc : "•••"}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-[10px] text-white/70">Auto-filled from your OpenPay wallet</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Enter your OpenPay virtual card details.</p>
                  )}
                  {!savedCard && (
                    <>
                      <Input placeholder="Card number" className="qrp-input" value={cardNum} onChange={e => setCardNum(e.target.value)} />
                      <Input placeholder="CVC" maxLength={4} className="qrp-input" value={cardCvc} onChange={e => setCardCvc(e.target.value)} />
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
                <span className="font-semibold text-muted-foreground">Total due</span>
                <span className="font-extrabold">
                  {activeMethod === "pi" ? `${chargeAmount.toFixed(2)} π` : `${data.currency} ${chargeAmount.toFixed(2)}`}
                </span>
              </div>

              <div className="qrp-paybar lg:static lg:m-0 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
                <Button
                  className={`h-12 w-full gap-2 text-base ${activeMethod === "pi" ? "qrp-pi-btn" : activeMethod === "card" ? "qrp-card-btn" : "qrp-primary-btn"}`}
                  disabled={paying}
                  onClick={onPay}
                >
                  {paying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : activeMethod === "pi" ? (
                    <img src={PURE_PI_ICON_URL} alt="" className="h-5 w-5 rounded-full object-cover" />
                  ) : activeMethod === "card" ? (
                    <span className="flex h-5 w-7 items-center justify-center rounded-[5px] bg-gradient-to-br from-[#0b2d6b] to-[#0070ba]">
                      <BrandLogo className="h-3 w-3 text-white" />
                    </span>
                  ) : (
                    <BrandLogo className="h-5 w-5" />
                  )}
                  {payLabel}
                  <Lock className="h-3.5 w-3.5 opacity-70" />
                </Button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  {activeMethod === "wallet" && !session ? "You'll be asked to sign in." : "Encrypted payment · instant receipt"}
                </p>
              </div>

            </div>
          </div>

          <div className="mt-4 flex justify-center pb-4">
            <p className="qrp-footnote">
              <ShieldCheck className="h-3.5 w-3.5" />
              Powered by OpenPay · Protected by dispute resolution
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


const PayOpt = ({ active, onClick, logo, label, hint }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border text-left transition-all ${
      active
        ? "border-paypal-blue bg-paypal-blue/[0.07] shadow-[0_6px_18px_-10px_rgba(0,112,186,0.7)]"
        : "border-border bg-background hover:border-paypal-blue/40 hover:bg-muted/40"
    }`}
  >
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-paypal-blue/10" : "bg-muted"}`}>
      {logo}
    </span>
    <span className="min-w-0 flex-1">
      <span className={`block text-sm font-semibold ${active ? "text-paypal-blue" : "text-foreground"}`}>{label}</span>
      {hint && <span className="block truncate text-[11px] text-muted-foreground">{hint}</span>}
    </span>
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? "border-paypal-blue bg-paypal-blue" : "border-muted-foreground/40"}`}>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  </button>
);
