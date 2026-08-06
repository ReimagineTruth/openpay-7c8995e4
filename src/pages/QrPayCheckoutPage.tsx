import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck, CreditCard, User, Heart, Coffee, Lock, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QrPaySteps from "@/components/qrpay/QrPaySteps";
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
  const [proAsset, setProAsset] = useState<string>("OUSD");

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

  const payPro = () => {
    if (!validateAmount() || !validateDelivery()) return;
    const dest = data?.pro_settlement_to || "";
    const url = buildProPayUrl({
      to: dest,
      amount: chargeAmount,
      asset: proAsset,
      note: buildProXferNote(dest, makeProXferRef()),
    });
    if (!url) { toast.error("Merchant has no OpenPay Pro destination"); return; }
    toast.success("Opening OpenPay Pro to complete your payment");
    openExternalUrl(url);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
  if (!data) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-bold mb-2">Payment not found</h1><p className="text-muted-foreground">This QR code is invalid or no longer available.</p></div>;
  if (data.status !== "active") return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><Badge variant="secondary" className="mb-3">{data.status}</Badge><h1 className="text-xl font-bold mb-2">This payment is no longer active</h1></div>;

  const piInPi = isPiBrowserUAOnly();
  const tabs = [
    data.allow_pi && (piInPi || (window as any).Pi) ? "pi" : null,
    data.allow_wallet ? "wallet" : null,
    data.allow_virtual_card ? "card" : null,
    data.pro_settlement_to ? "pro" : null,
  ].filter(Boolean) as string[];
  const activeMethod = method && tabs.includes(method) ? method : (tabs[0] || "wallet");

  const TypeIcon = data.payment_type === "donation" ? Heart : data.payment_type === "tip" ? Coffee : null;

  const payLabel = paying
    ? "Processing…"
    : activeMethod === "pi"
      ? `Pay ${chargeAmount.toFixed(2)} π`
      : activeMethod === "pro"
        ? `Pay ${chargeAmount.toFixed(2)} with Pro ${proAsset}`
        : `Pay ${data.currency} ${chargeAmount.toFixed(2)}`;
  const onPay =
    activeMethod === "pi" ? payPi
    : activeMethod === "card" ? payCard
    : activeMethod === "pro" ? payPro
    : payWallet;

  const amountText = activeMethod === "pi"
    ? `${chargeAmount.toFixed(2)} π`
    : `${data.currency} ${chargeAmount.toFixed(2)}`;

  const amountParts = activeMethod === "pi"
    ? { curr: "π", value: chargeAmount.toFixed(2), suffix: true }
    : { curr: data.currency, value: chargeAmount.toFixed(2), suffix: false };

  const merchantLabel = data.merchant.full_name || data.merchant.username || "merchant";

  const renderOrderBody = (align: "center" | "start" = "center") => isFlexible ? (
    <div className={`space-y-3 p-4 ${align === "start" ? "text-left" : ""}`}>
      <Label className="text-[12px] font-medium text-[var(--qrp-muted)]">
        {data.payment_type === "tip" ? "Tip amount" : "Donation amount"}
      </Label>
      <div className="qrp-tip-field">
        <span className="qrp-curr">{data.currency}</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={data.min_amount || 0}
          value={customAmount}
          onChange={e => setCustomAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>
      <div className={`flex flex-wrap gap-2 ${align === "start" ? "justify-start" : "justify-center"}`}>
        {[1, 5, 10, 25].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setCustomAmount(String(v))}
            className={`qrp-chip ${Number(customAmount) === v ? "is-on" : ""}`}
          >
            {data.currency} {v}
          </button>
        ))}
      </div>
      {data.min_amount ? (
        <p className={`text-[11px] text-[var(--qrp-muted)] ${align === "start" ? "text-left" : "text-center"}`}>
          Min {data.currency} {Number(data.min_amount).toFixed(2)}
        </p>
      ) : null}
    </div>
  ) : (
    <>
      {data.items.map(it => (
        <div key={it.id} className="qrp-group-row">
          <div className="flex min-w-0 items-center gap-3">
            {it.image_url
              ? <img src={it.image_url} alt={it.name} className="h-10 w-10 shrink-0 rounded-[10px] object-cover" />
              : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-black/[0.04] text-[11px] font-semibold text-[var(--qrp-muted)]">{it.quantity}×</span>}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium tracking-[-0.01em]">{it.name}</div>
              <div className="truncate text-[12px] text-[var(--qrp-muted)]">Qty {it.quantity}</div>
            </div>
          </div>
          <div className="shrink-0 text-[15px] font-semibold tracking-[-0.01em]">{data.currency} {Number(it.line_total).toFixed(2)}</div>
        </div>
      ))}
      <div className="qrp-group-row">
        <span className="text-[15px] text-[var(--qrp-muted)]">Fees</span>
        <span className="text-[15px] font-medium text-emerald-600">No fee</span>
      </div>
      <div className="qrp-group-row">
        <span className="text-[15px] font-semibold">Total</span>
        <span className="text-[17px] font-semibold tracking-[-0.02em]">{amountText}</span>
      </div>
    </>
  );

  const renderDetailsBody = () => (
    <div className="space-y-3 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-[var(--qrp-muted)]">
            Name{data.collect_delivery && (data.delivery_fields || []).includes("name") ? " *" : ""}
          </Label>
          <Input className="qrp-input" value={payerName} onChange={e => setPayerName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[12px] font-medium text-[var(--qrp-muted)]">
            Email{data.collect_delivery && (data.delivery_fields || []).includes("email") ? " *" : ""}
          </Label>
          <Input className="qrp-input" type="email" value={payerEmail} onChange={e => setPayerEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      </div>
      {data.collect_delivery && (
        <div className="space-y-3 rounded-[12px] bg-black/[0.03] p-3">
          <div className="text-[12px] font-medium text-[var(--qrp-muted)]">Delivery</div>
          {(data.delivery_fields || []).includes("phone") && (
            <Input className="qrp-input" value={payerPhone} onChange={e => setPayerPhone(e.target.value)} placeholder="Phone *" />
          )}
          {(data.delivery_fields || []).includes("address") && (
            <textarea className="qrp-input w-full p-3 text-sm" style={{ height: "auto" }} rows={3}
                      value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                      placeholder="Shipping address *" />
          )}
          <textarea className="qrp-input w-full p-3 text-sm" style={{ height: "auto" }} rows={2}
                    value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)}
                    placeholder="Notes (optional)" />
        </div>
      )}
    </div>
  );

  const renderMethodsBody = () => (
    <div className="overflow-hidden">
      {tabs.includes("wallet") && (
        <PayOpt active={activeMethod === "wallet"} onClick={() => setMethod("wallet")}
          logo={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05]"><BrandLogo className="h-5 w-5 text-[var(--qrp-ink)]" /></span>}
          label="OpenPay Balance"
          hint={`Wallet · ${data.currency}`} />
      )}
      {tabs.includes("pi") && (
        <PayOpt active={activeMethod === "pi"} onClick={() => setMethod("pi")}
          logo={<img src={PURE_PI_ICON_URL} alt="Pi Network" className="h-8 w-8 rounded-full object-cover" />}
          label="Pi Network"
          hint={data.allow_guest ? "Guest checkout" : "Sign-in required"} />
      )}
      {tabs.includes("card") && (
        <PayOpt active={activeMethod === "card"} onClick={() => setMethod("card")}
          logo={
            <span className="flex h-7 w-10 items-center justify-center rounded-[7px] bg-[var(--qrp-ink)]">
              <BrandLogo className="h-3.5 w-3.5 text-white" />
            </span>
          }
          label="Virtual Card"
          hint={savedCard ? `•••• ${String(savedCard.card_number).slice(-4)}` : "OpenPay card"} />
      )}
      {tabs.includes("pro") && (
        <PayOpt active={activeMethod === "pro"} onClick={() => setMethod("pro")}
          logo={
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2c2e] text-[11px] font-black text-white">P</span>
          }
          label="OpenPay Pro"
          hint={formatProDestinationPreview(data.pro_settlement_to || "")} />
      )}

      {activeMethod === "pro" && (
        <div className="qrp-group-footer space-y-2">
          <div className="flex flex-wrap gap-2">
            {PRO_PAY_ASSETS.map(a => (
              <button key={a.key} type="button" onClick={() => setProAsset(a.key)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all active:scale-95 ${
                  proAsset === a.key
                    ? "bg-[var(--qrp-ink)] text-white"
                    : "bg-white text-[var(--qrp-ink)] ring-1 ring-black/10"
                }`}>{a.label}</button>
            ))}
          </div>
          <button type="button" onClick={() => openExternalUrl(PRO_TOPUP_URL)}
            className="text-[12px] font-semibold text-[var(--qrp-accent)]">
            Top up on OpenPay Pro
          </button>
        </div>
      )}

      {activeMethod === "card" && (
        <div className="qrp-group-footer space-y-2">
          {savedCard ? (
            <div className="rounded-[14px] bg-gradient-to-br from-[#1d1d1f] to-[#3a3a3c] px-3.5 py-3 text-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">Virtual Card</p>
                  <p className="mt-1 font-mono text-[15px] font-semibold tracking-[0.12em]">
                    {showCard
                      ? String(savedCard.card_number).replace(/(\d{4})(?=\d)/g, "$1 ").trim()
                      : `•••• •••• •••• ${String(savedCard.card_number).slice(-4)}`}
                  </p>
                </div>
                <button type="button" onClick={() => setShowCard(v => !v)}
                  aria-label={showCard ? "Hide card details" : "Show card details"}
                  className="rounded-full bg-white/15 p-1.5 text-white">
                  {showCard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="min-w-0">
                  <p className="text-white/50">Holder</p>
                  <p className="truncate font-semibold uppercase">{showCard ? (savedCard.cardholder_name || "OPENPAY") : "••••"}</p>
                </div>
                <div>
                  <p className="text-white/50">Expires</p>
                  <p className="font-semibold">{showCard ? `${String(savedCard.expiry_month).padStart(2, "0")}/${String(savedCard.expiry_year).slice(-2)}` : "••/••"}</p>
                </div>
                <div>
                  <p className="text-white/50">CVC</p>
                  <p className="font-semibold">{showCard ? savedCard.cvc : "•••"}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Input placeholder="Card number" className="qrp-input" value={cardNum} onChange={e => setCardNum(e.target.value)} />
              <Input placeholder="CVC" maxLength={4} className="qrp-input" value={cardCvc} onChange={e => setCardCvc(e.target.value)} />
            </>
          )}
        </div>
      )}
    </div>
  );

  const payBtnClass = `h-[54px] min-[900px]:h-[56px] w-full gap-2 text-[16px] min-[900px]:text-[17px] ${activeMethod === "pi" ? "qrp-pi-btn" : activeMethod === "card" ? "qrp-card-btn" : activeMethod === "pro" ? "qrp-pro-btn" : "qrp-primary-btn"}`;
  const payHint = activeMethod === "pro"
    ? "You'll finish securely on OpenPay Pro."
    : activeMethod === "wallet" && !session ? "You'll be asked to sign in." : "Encrypted · Instant receipt";

  const renderPayButton = () => (
    <Button className={payBtnClass} disabled={paying} onClick={onPay}>
      {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : activeMethod === "pi" ? (
        <img src={PURE_PI_ICON_URL} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : activeMethod === "pro" ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-black">P</span>
      ) : activeMethod === "card" ? (
        <CreditCard className="h-4 w-4" />
      ) : (
        <BrandLogo className="h-5 w-5 text-white" />
      )}
      {payLabel}
      <Lock className="h-3.5 w-3.5 opacity-55" />
    </Button>
  );

  return (
    <div className="min-h-screen qrp-page-bg pb-[calc(5.75rem+env(safe-area-inset-bottom))] min-[900px]:pb-12">
      <div className="qrp-bg-mark" aria-hidden><span>PAY</span></div>

      {/* ════════════ DESKTOP / TABLET+ LAYOUT ════════════ */}
      <div className="relative z-[1] hidden qrp-pop min-[900px]:block">
        <div className="qrp-checkout-shell flex items-center justify-between pb-2 pt-[clamp(1rem,2vw,1.75rem)]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--qrp-muted)]">OpenPay Checkout</div>
          <div className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--qrp-muted)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--qrp-accent)]" /> Secure payment
          </div>
        </div>
        <div className="qrp-checkout-shell pb-4">
          <QrPaySteps current="pay" />
        </div>

        <div className="qrp-checkout-desk">
          <div className="qrp-desk-left">
            <div className="qrp-desk-hero">
              {data.cover_image_url && (
                <div className="qrp-desk-hero-cover">
                  <img src={data.cover_image_url} alt="" />
                </div>
              )}
              <div className="qrp-desk-hero-main">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.04] ring-1 ring-black/5">
                    {data.merchant.avatar_url
                      ? <img src={data.merchant.avatar_url} alt="" className="h-full w-full object-cover" />
                      : <User className="h-5 w-5 text-[var(--qrp-muted)]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold tracking-[-0.01em]">
                      Paying {merchantLabel}
                      {TypeIcon && <TypeIcon className="ml-1.5 inline h-3.5 w-3.5 align-[-2px] text-[var(--qrp-accent)]" />}
                    </p>
                    {data.merchant.username && data.merchant.full_name && (
                      <p className="truncate text-[13px] text-[var(--qrp-muted)]">@{data.merchant.username}</p>
                    )}
                  </div>
                </div>
                <div className="qrp-desk-amount">
                  {amountParts.suffix ? (
                    <><span>{amountParts.value}</span> <span className="qrp-curr">{amountParts.curr}</span></>
                  ) : (
                    <><span className="qrp-curr">{amountParts.curr}</span><span>{amountParts.value}</span></>
                  )}
                </div>
                {(data.title || data.description) && (
                  <p className="mt-2.5 max-w-xl text-[15px] leading-snug text-[var(--qrp-muted)]">
                    {data.title || data.description}
                  </p>
                )}
                {data.pro_settlement_to && (
                  <p className="mt-2 text-[12px] text-[var(--qrp-muted)]">
                    Settles to Pro · <span className="font-medium text-[var(--qrp-ink)]">{data.pro_settlement_to}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="qrp-desk-panel">
              <div className="qrp-desk-panel-head">Order</div>
              <div className="qrp-group !m-0 !rounded-none !shadow-none">{renderOrderBody("start")}</div>
            </div>

            <div className="qrp-desk-panel">
              <div className="qrp-desk-panel-head">Your details</div>
              {renderDetailsBody()}
            </div>
          </div>

          <div className="qrp-desk-right">
            <div className="qrp-desk-panel p-[clamp(1.15rem,2vw,1.5rem)]">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[var(--qrp-muted)]">Pay with</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--qrp-muted)]">
                  <ShieldCheck className="h-3.5 w-3.5 text-[var(--qrp-accent)]" /> Secure
                </span>
              </div>
              <div className="qrp-group !mt-2 !rounded-[14px]">{renderMethodsBody()}</div>

              <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-black/[0.06] pt-4 px-0.5">
                <span className="text-[14px] font-medium text-[var(--qrp-muted)]">Total due</span>
                <span className="qrp-desk-amount is-total">
                  {amountParts.suffix ? (
                    <>{amountParts.value} <span className="qrp-curr">{amountParts.curr}</span></>
                  ) : (
                    <><span className="qrp-curr">{amountParts.curr}</span>{amountParts.value}</>
                  )}
                </span>
              </div>

              <div className="mt-4">
                {renderPayButton()}
                <p className="mt-2.5 text-center text-[11px] text-[var(--qrp-muted)]">{payHint}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <p className="qrp-footnote">
                <ShieldCheck className="h-3.5 w-3.5" />
                Powered by OpenPay
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ MOBILE LAYOUT ════════════ */}
      <div className="qrp-stage relative z-[1] qrp-pop min-[900px]:hidden">
        <div className="mb-3 flex items-center justify-between px-0.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--qrp-muted)]">OpenPay</div>
          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--qrp-muted)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--qrp-accent)]" /> Secure
          </div>
        </div>

        <div className="mb-4 px-0.5">
          <QrPaySteps current="pay" />
        </div>

        <div className="qrp-pay-sheet">
          <div className="qrp-pay-sheet-hero">
            {data.cover_image_url && (
              <img src={data.cover_image_url} alt="" className="mb-4 h-32 w-full rounded-2xl object-cover sm:h-40" />
            )}
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-black/[0.04] ring-1 ring-black/5 shadow-lg">
              {data.merchant.avatar_url
                ? <img src={data.merchant.avatar_url} alt="" className="h-full w-full object-cover" />
                : <User className="h-6 w-6 text-[var(--qrp-muted)]" />}
            </div>
            <p className="text-[13px] font-medium text-[var(--qrp-muted)]">
              Paying {merchantLabel}
              {TypeIcon && <TypeIcon className="ml-1 inline h-3.5 w-3.5 align-[-2px] text-[var(--qrp-accent)]" />}
            </p>
            <div className="qrp-amount-hero mt-2">
              {amountParts.suffix ? (
                <><span>{amountParts.value}</span> <span className="qrp-curr">{amountParts.curr}</span></>
              ) : (
                <><span className="qrp-curr">{amountParts.curr}</span><span>{amountParts.value}</span></>
              )}
            </div>
            {(data.title || data.description) && (
              <p className="mx-auto mt-2 max-w-[22rem] text-[14px] leading-snug text-[var(--qrp-muted)]">
                {data.title || data.description}
              </p>
            )}
          </div>

          <div className="space-y-5 px-0 pb-4 pt-4">
            <div>
              <span className="qrp-section-label qrp-group-inset">Order</span>
              <div className="qrp-group qrp-group-inset">{renderOrderBody("center")}</div>
            </div>
            <div>
              <span className="qrp-section-label qrp-group-inset">Your details</span>
              <div className="qrp-group qrp-group-inset">{renderDetailsBody()}</div>
            </div>
            <div>
              <span className="qrp-section-label qrp-group-inset">Pay with</span>
              <div className="qrp-group qrp-group-inset">{renderMethodsBody()}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          <p className="qrp-footnote">
            <ShieldCheck className="h-3.5 w-3.5" />
            Powered by OpenPay
          </p>
        </div>
      </div>

      {/* Mobile sticky pay bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 min-[900px]:hidden">
        <div className="qrp-paybar mx-auto w-full max-w-[42rem]">
          <Button className={payBtnClass} disabled={paying} onClick={onPay}>
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-3.5 w-3.5 opacity-55" />}
            {payLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}


const PayOpt = ({ active, onClick, logo, label, hint }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`qrp-pay-opt ${active ? "is-active" : ""}`}
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center">
      {logo}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[var(--qrp-ink)]">{label}</span>
      {hint && <span className="block truncate text-[12px] text-[var(--qrp-muted)]">{hint}</span>}
    </span>
    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] ${active ? "border-[var(--qrp-accent)] bg-[var(--qrp-accent)]" : "border-black/20"}`}>
      {active && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden>
          <path d="M2.5 6.2 L4.8 8.5 L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  </button>
);
