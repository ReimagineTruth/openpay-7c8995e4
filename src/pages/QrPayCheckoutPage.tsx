import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, ShieldCheck, User, Heart, Coffee, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import QrPaySteps from "@/components/qrpay/QrPaySteps";
import QrPayPiBrowserDialog from "@/components/qrpay/QrPayPiBrowserDialog";
import QrPayQrPhDialog from "@/components/qrpay/QrPayQrPhDialog";
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
import {
  authenticatePiForPayments,
  resolvePiPaymentAmount,
  waitForPiSdk,
  initPiSdk,
} from "@/lib/piPayment";
import { invokePaymongoQrPay } from "@/lib/paymongoQrPay";

const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";
const MOONPAY_LOGO = "/icons/moonpay.svg";
const GOOGLE_PAY_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Google_Pay_Logo.svg/1920px-Google_Pay_Logo.svg.png";
const APPLE_PAY_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Apple_Pay_logo.svg/1920px-Apple_Pay_logo.svg.png";
const PAYPAL_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1920px-PayPal.svg.png";
const QR_PH_LOGO =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/QR_Ph_Logo.svg/960px-QR_Ph_Logo.svg.png?20250310160234";
const GCASH_LOGO = "/icons/gcash.svg";
const BILLEASE_LOGO = "/icons/billease.svg";
const BANK_LOGO = "/icons/bank.svg";

const EXTRA_METHOD_KEYS = ["moonpay", "google_pay", "apple_pay", "paypal", "qr_ph", "gcash", "billease", "bank"] as const;
type ExtraMethod = (typeof EXTRA_METHOD_KEYS)[number];
const PAYMONGO_METHODS = ["qr_ph", "gcash", "billease", "bank"] as const;
type PaymongoCheckoutMethod = (typeof PAYMONGO_METHODS)[number];

const BANK_OPTIONS = [
  { code: "bpi", label: "BPI" },
  { code: "ubp", label: "UnionBank" },
  { code: "bdo", label: "BDO" },
  { code: "landbank", label: "Land Bank" },
  { code: "metrobank", label: "Metrobank" },
] as const;

const EXTRA_METHOD_META: Record<ExtraMethod, { label: string; hint: string; logo: string }> = {
  moonpay: { label: "MoonPay", hint: "Buy crypto & pay", logo: MOONPAY_LOGO },
  google_pay: { label: "Google Pay", hint: "Fast checkout with Google", logo: GOOGLE_PAY_LOGO },
  apple_pay: { label: "Apple Pay", hint: "Pay with Apple devices", logo: APPLE_PAY_LOGO },
  paypal: { label: "PayPal", hint: "PayPal balance or linked card", logo: PAYPAL_LOGO },
  qr_ph: { label: "QR PH", hint: "Scan with any PH bank / e-wallet", logo: QR_PH_LOGO },
  gcash: { label: "GCash", hint: "Pay with GCash via PayMongo", logo: GCASH_LOGO },
  billease: { label: "Buy Now, Pay Later", hint: "BillEase installments", logo: BILLEASE_LOGO },
  bank: { label: "Online Banking", hint: "Pay from your PH bank account", logo: BANK_LOGO },
};

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
  allow_moonpay?: boolean;
  allow_google_pay?: boolean;
  allow_apple_pay?: boolean;
  allow_paypal?: boolean;
  allow_qr_ph?: boolean;
  allow_gcash?: boolean;
  allow_billease?: boolean;
  allow_bank?: boolean;
  payment_type: "product" | "digital" | "donation" | "tip";
  payment_purpose?: string | null;
  payment_purpose_label?: string | null;
  payment_category?: string | null;
  payment_category_id?: string | null;
  is_flexible?: boolean;
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
  const [searchParams] = useSearchParams();
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
  const [piBrowserOpen, setPiBrowserOpen] = useState(false);
  const [waitingPiCallback, setWaitingPiCallback] = useState(false);
  const piCallbackHandled = useRef(false);

  const [customAmount, setCustomAmount] = useState<string>("");
  const [payerPhone, setPayerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [paymongoIntentId, setPaymongoIntentId] = useState<string | null>(null);
  const [qrPhImageUrl, setQrPhImageUrl] = useState<string | null>(null);
  const [qrPhOpen, setQrPhOpen] = useState(false);
  const [paymongoPhpAmount, setPaymongoPhpAmount] = useState<number | null>(null);
  const [paymongoPolling, setPaymongoPolling] = useState(false);
  const [bankCode, setBankCode] = useState<string>("bpi");

  // Pi SDK is injected on every page (index.html). Only the real Pi Browser
  // can complete Pi payments — do NOT treat window.Pi as “inside Pi Browser”.
  const [inPiBrowser, setInPiBrowser] = useState(
    () => typeof window !== "undefined" && isPiBrowserUAOnly(),
  );
  useEffect(() => {
    setInPiBrowser(isPiBrowserUAOnly());
  }, []);

  const piReturn = searchParams.get("pi_return") === "1";

  /** Link shown in QR / copy — tags Pi Browser session for return messaging */
  const checkoutUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const u = new URL(window.location.href.split("#")[0]);
    u.searchParams.set("pi_return", "1");
    return u.toString();
  }, [token]);

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

      // Extra methods are stored in metadata at create-time (until dedicated columns exist)
      let extraAllows: Partial<QrPayData> = {};
      try {
        const { data: row } = await (supabase as any)
          .from("qr_payments")
          .select("metadata")
          .eq("token", token)
          .maybeSingle();
        const meta = (row?.metadata && typeof row.metadata === "object") ? row.metadata : {};
        extraAllows = {
          allow_moonpay: !!meta.allow_moonpay,
          allow_google_pay: !!meta.allow_google_pay,
          allow_apple_pay: !!meta.allow_apple_pay,
          allow_paypal: !!meta.allow_paypal,
          allow_qr_ph: !!meta.allow_qr_ph,
          allow_gcash: !!meta.allow_gcash,
          allow_billease: !!meta.allow_billease,
          allow_bank: !!meta.allow_bank,
        };
      } catch {
        /* optional */
      }

      setData({ ...(res as QrPayData), ...extraAllows });
      if (res?.suggested_amount) setCustomAmount(String(res.suggested_amount));
      setLoading(false);
    })();
  }, [token]);

  const isFlexible = !!data && (
    data.is_flexible === true ||
    data.payment_type === "donation" ||
    data.payment_type === "tip" ||
    !!data.allow_custom_amount
  );
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

  const goAfterPayment = async (ref: string, method: string, opts?: {
    amount?: number;
    currency?: string;
    payerName?: string | null;
    payerEmail?: string | null;
  }) => {
    await settleToPro(ref);
    const receipt = {
      transactionRef: ref, method, paidAt: new Date().toISOString(),
      amount: opts?.amount ?? chargeAmount,
      currency: opts?.currency ?? data!.currency,
      merchant: data!.merchant, title: data!.title, description: data!.description,
      items: data!.items,
      payer: {
        name: opts?.payerName ?? payerName,
        email: opts?.payerEmail ?? payerEmail,
      },
      after_payment_action: data!.after_payment_action,
      download_url: data!.download_url,
      redirect_url: data!.redirect_url,
      pro_settlement_to: data!.pro_settlement_to || null,
      pi_return: piReturn || undefined,
    };
    sessionStorage.setItem(`qrp_receipt_${ref}`, JSON.stringify(receipt));
    // Signal other same-origin tabs (original browser) that payment finished
    try {
      localStorage.setItem(`qrp_paid_${token}`, JSON.stringify({
        ref, method, at: Date.now(),
      }));
    } catch {}
    if (data!.after_payment_action === "redirect" && data!.redirect_url) {
      try { window.location.href = data!.redirect_url; return; } catch {}
    }
    const q = new URLSearchParams({ ref });
    if (piReturn) q.set("pi_return", "1");
    navigate(`/qr-pay/${token}/success?${q.toString()}`);
  };

  // Poll / listen while waiting for Pi payment to finish in another browser
  useEffect(() => {
    if (!piBrowserOpen || inPiBrowser || !token || !data) {
      setWaitingPiCallback(false);
      return;
    }
    setWaitingPiCallback(true);
    piCallbackHandled.current = false;

    const finishFromResult = async (res: any) => {
      if (piCallbackHandled.current || !res?.paid || !res?.transaction_ref) return;
      piCallbackHandled.current = true;
      setPiBrowserOpen(false);
      setWaitingPiCallback(false);
      toast.success("Pi payment received — returning here");
      await goAfterPayment(res.transaction_ref, res.method || "pi", {
        amount: res.amount != null ? Number(res.amount) : undefined,
        currency: res.currency || undefined,
        payerName: res.payer_name,
        payerEmail: res.payer_email,
      });
    };

    const poll = async () => {
      try {
        const { data: res, error } = await (supabase as any).rpc("qr_pay_check_result", {
          p_token: token,
        });
        if (!error && res) {
          await finishFromResult(res);
          return;
        }
        // Fallback if RPC not deployed yet: status via get_by_token
        const { data: pay } = await (supabase as any).rpc("qr_pay_get_by_token", { p_token: token });
        if (pay?.status === "paid" && pay?.id) {
          // Best-effort: try reading tx (may be RLS-blocked for guests)
          const { data: txs } = await (supabase as any)
            .from("qr_payment_transactions")
            .select("transaction_ref, method, amount, currency, paid_at, payer_name, payer_email")
            .eq("qr_payment_id", pay.id)
            .eq("status", "succeeded")
            .order("paid_at", { ascending: false })
            .limit(1);
          const tx = txs?.[0];
          if (tx?.transaction_ref) {
            await finishFromResult({
              paid: true,
              transaction_ref: tx.transaction_ref,
              method: tx.method || "pi",
              amount: tx.amount,
              currency: tx.currency,
              payer_name: tx.payer_name,
              payer_email: tx.payer_email,
            });
          }
        }
      } catch {}
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== `qrp_paid_${token}` || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue);
        if (payload?.ref) {
          void finishFromResult({
            paid: true,
            transaction_ref: payload.ref,
            method: payload.method || "pi",
          });
        }
      } catch {}
    };

    void poll();
    const id = window.setInterval(poll, 2500);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piBrowserOpen, inPiBrowser, token, data?.id]);


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

  const selectPi = () => {
    setMethod("pi");
    if (!inPiBrowser) {
      setPiBrowserOpen(true);
      return;
    }
    // Warm Pi Auth as soon as user picks Pi inside Pi Browser
    void (async () => {
      try {
        await waitForPiSdk(8000);
        initPiSdk();
        await authenticatePiForPayments(60000);
      } catch {
        // Pay button will retry auth — don't toast on silent warm-up
      }
    })();
  };

  const payPi = async () => {
    if (!validateAmount() || !validateDelivery()) return;

    const hasNativePi =
      typeof window !== "undefined" &&
      Boolean((window as any).Pi?.nativeFeaturesList || (window as any).Pi?.Ads);

    // Outside Pi Browser: show copy-link instructions (never hang on SDK)
    if (!inPiBrowser && !hasNativePi) {
      setPaying(false);
      setPiBrowserOpen(true);
      return;
    }
    // Public QR Pay: Pi does not require an OpenPay account (Pi Browser auth only)

    setPaying(true);
    try {
      toast.message("Sign in with Pi…");
      // 1) Wait for SDK  2) Init  3) Pi Auth with payments scope  4) Then createPayment
      const auth = await authenticatePiForPayments();
      const Pi = initPiSdk(await waitForPiSdk());
      if (typeof Pi.createPayment !== "function") {
        throw new Error("Pi payments unavailable. Update Pi Browser and try again.");
      }

      const piAmount = await resolvePiPaymentAmount(chargeAmount, data!.currency);
      toast.message(`Confirm ${piAmount.toFixed(4)} π in Pi…`);

      await new Promise<void>((resolve, reject) => {
        try {
          Pi.createPayment(
            {
              amount: piAmount,
              memo: `OpenPay QR · ${data!.title || data!.token}`.slice(0, 64),
              metadata: {
                qr_token: data!.token,
                kind: "qr_pay",
                currency: data!.currency,
                charge_amount: chargeAmount,
                pi_username: auth?.user?.username || null,
              },
            },
            {
              onReadyForServerApproval: async (paymentId: string) => {
                const { error } = await supabase.functions.invoke("pi-platform", {
                  body: { action: "approve", paymentId },
                });
                if (error) throw new Error(error.message || "Pi approval failed");
              },
              onReadyForServerCompletion: async (paymentId: string, txid: string) => {
                try {
                  const { error: completeErr } = await supabase.functions.invoke("pi-platform", {
                    body: { action: "complete", paymentId, txid },
                  });
                  if (completeErr) throw new Error(completeErr.message || "Pi complete failed");

                  const { data: res, error } = await (supabase as any).rpc("qr_pay_complete_pi", {
                    p_token: token,
                    p_pi_payment_id: paymentId,
                    p_pi_txid: txid,
                    p_payer_name: payerName || auth?.user?.username || null,
                    p_payer_email: payerEmail || null,
                    p_payer_username: auth?.user?.username || null,
                    p_amount: isFlexible ? chargeAmount : null,
                    ...deliveryPayload(),
                  });
                  if (error) { reject(new Error(error.message)); return; }
                  await goAfterPayment(res.transaction_ref, "pi");
                  resolve();
                } catch (e: any) {
                  reject(e);
                }
              },
              onCancel: () => reject(new Error("Payment cancelled")),
              onError: (e: any) => reject(new Error(e?.message || "Pi payment failed")),
            },
          );
        } catch (e: any) {
          reject(e);
        }
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

  const confirmPaymongo = async (intentId: string, method: PaymongoCheckoutMethod) => {
    const res = await invokePaymongoQrPay({
      action: "confirm",
      token,
      intent_id: intentId,
      method,
      amount: isFlexible ? chargeAmount : undefined,
      payer_name: payerName || null,
      payer_email: payerEmail || null,
      payer_phone: payerPhone || null,
      delivery_address: deliveryAddress || null,
      delivery_notes: deliveryNotes || null,
    });
    if (!res?.paid) return false;
    setPaymongoPolling(false);
    setQrPhImageUrl(null);
    setQrPhOpen(false);
    await goAfterPayment(String(res.transaction_ref), method);
    return true;
  };

  const payPaymongo = async (method: PaymongoCheckoutMethod) => {
    if (!validateAmount() || !validateDelivery()) return;
    if (method === "bank" && !bankCode) {
      toast.error("Select a bank first");
      return;
    }
    setPaying(true);
    try {
      const returnUrl = `${window.location.origin}/qr-pay/${token}?paymongo_return=1&pm_method=${method}`;
      const res = await invokePaymongoQrPay({
        action: "create",
        token,
        method,
        bank_code: method === "bank" ? bankCode : undefined,
        amount: isFlexible ? chargeAmount : undefined,
        return_url: returnUrl,
        payer_name: payerName || null,
        payer_email: payerEmail || null,
        payer_phone: payerPhone || null,
        delivery_address: deliveryAddress || null,
        delivery_notes: deliveryNotes || null,
      });

      const intentId = String(res?.intent_id || "");
      if (!intentId) throw new Error("No payment intent returned");
      setPaymongoIntentId(intentId);
      setPaymongoPhpAmount(Number(res?.php_amount) || null);

      if (method === "qr_ph") {
        const img = String(res?.qr_image_url || "");
        if (!img) throw new Error("QR code was not returned by PayMongo");
        setQrPhImageUrl(img);
        setPaymongoPolling(true);
        setQrPhOpen(true);
        toast.success(`Scan QR PH · ₱${Number(res.php_amount).toFixed(2)}`);
        return;
      }

      const redirect = String(res?.redirect_url || "");
      if (!redirect) throw new Error("Redirect URL missing from PayMongo");
      sessionStorage.setItem(`qrp_paymongo_${token}`, JSON.stringify({
        intent_id: intentId,
        method,
        bank_code: method === "bank" ? bankCode : null,
        amount: chargeAmount,
      }));
      const openLabel =
        method === "gcash" ? "Opening GCash…"
        : method === "billease" ? "Opening BillEase…"
        : "Opening your bank…";
      toast.success(openLabel);
      window.location.href = redirect;
    } catch (e: any) {
      toast.error(e?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const payExtra = (key: ExtraMethod) => {
    if (key === "qr_ph" && qrPhImageUrl) {
      setQrPhOpen(true);
      return;
    }
    if ((PAYMONGO_METHODS as readonly string[]).includes(key)) {
      void payPaymongo(key as PaymongoCheckoutMethod);
      return;
    }
    if (!validateAmount() || !validateDelivery()) return;
    const label = EXTRA_METHOD_META[key].label;
    toast.info(`${label} checkout will be available once the integration is connected.`);
  };

  // Poll QR PH until paid / expired
  useEffect(() => {
    if (!paymongoPolling || !paymongoIntentId || !token) return;
    let stopped = false;
    const tick = async () => {
      try {
        const paid = await confirmPaymongo(paymongoIntentId, "qr_ph");
        if (paid || stopped) return;
      } catch {
        /* keep polling */
      }
    };
    tick();
    const id = window.setInterval(tick, 4000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymongoPolling, paymongoIntentId, token]);

  // Resume after GCash return
  useEffect(() => {
    if (!token || searchParams.get("paymongo_return") !== "1") return;
    const method = (searchParams.get("pm_method") || "gcash") as PaymongoCheckoutMethod;
    let intentId = "";
    try {
      const raw = sessionStorage.getItem(`qrp_paymongo_${token}`);
      if (raw) intentId = String(JSON.parse(raw)?.intent_id || "");
    } catch { /* ignore */ }
    if (!intentId) return;

    let cancelled = false;
    (async () => {
      setPaying(true);
      setMethod(method);
      try {
        const paid = await confirmPaymongo(intentId, method);
        if (!paid && !cancelled) {
          toast.message("Waiting for payment confirmation…");
          // brief poll
          for (let i = 0; i < 8 && !cancelled; i++) {
            await new Promise(r => setTimeout(r, 2500));
            if (await confirmPaymongo(intentId, method)) return;
          }
          toast.error("Payment not confirmed yet. If you paid, refresh in a moment.");
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Could not confirm payment");
      } finally {
        if (!cancelled) setPaying(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin"/></div>;
  if (!data) return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-bold mb-2">Payment not found</h1><p className="text-muted-foreground">This QR code is invalid or no longer available.</p></div>;
  if (data.status !== "active") return <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><Badge variant="secondary" className="mb-3">{data.status}</Badge><h1 className="text-xl font-bold mb-2">This payment is no longer active</h1></div>;

  const tabs = [
    data.allow_wallet ? "wallet" : null,
    data.allow_pi ? "pi" : null,
    data.allow_virtual_card ? "card" : null,
    data.allow_moonpay ? "moonpay" : null,
    data.allow_google_pay ? "google_pay" : null,
    data.allow_apple_pay ? "apple_pay" : null,
    data.allow_paypal ? "paypal" : null,
    data.allow_qr_ph ? "qr_ph" : null,
    data.allow_gcash ? "gcash" : null,
    data.allow_billease ? "billease" : null,
    data.allow_bank ? "bank" : null,
    data.pro_settlement_to ? "pro" : null,
  ].filter(Boolean) as string[];
  const activeMethod = method && tabs.includes(method) ? method : (tabs[0] || "wallet");
  const isExtraMethod = (EXTRA_METHOD_KEYS as readonly string[]).includes(activeMethod);
  const isPaymongoMethod = (PAYMONGO_METHODS as readonly string[]).includes(activeMethod);
  const extraMeta = isExtraMethod ? EXTRA_METHOD_META[activeMethod as ExtraMethod] : null;

  const TypeIcon = data.payment_type === "donation" || data.payment_purpose === "gift" || data.payment_purpose === "charity"
    ? Heart
    : data.payment_type === "tip" || data.payment_purpose === "split_bill"
      ? Coffee
      : null;

  const payLabel = paying
    ? "Processing…"
    : activeMethod === "pi"
      ? (inPiBrowser ? `Pay ${chargeAmount.toFixed(2)} π` : "Continue in Pi Browser")
      : activeMethod === "pro"
        ? `Pay ${chargeAmount.toFixed(2)} with Pro ${proAsset}`
        : activeMethod === "qr_ph"
          ? (qrPhImageUrl ? "Waiting for QR PH payment…" : `Pay with QR PH`)
          : activeMethod === "gcash"
            ? `Continue with GCash`
            : activeMethod === "billease"
              ? `Continue with BillEase`
              : activeMethod === "bank"
                ? `Continue with ${BANK_OPTIONS.find(b => b.code === bankCode)?.label || "Bank"}`
                : extraMeta
                  ? `Pay ${data.currency} ${chargeAmount.toFixed(2)} with ${extraMeta.label}`
                  : `Pay ${data.currency} ${chargeAmount.toFixed(2)}`;
  const onPay =
    activeMethod === "pi" ? payPi
    : activeMethod === "card" ? payCard
    : activeMethod === "pro" ? payPro
    : isExtraMethod ? () => payExtra(activeMethod as ExtraMethod)
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
        {data.payment_type === "tip" || data.payment_purpose === "split_bill" || data.payment_purpose === "tip"
          ? "Tip amount"
          : data.payment_purpose_label
            ? `${data.payment_purpose_label} amount`
            : "Donation amount"}
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
        <PayOpt active={activeMethod === "pi"} onClick={selectPi}
          logo={<img src={PURE_PI_ICON_URL} alt="Pi Network" className="h-8 w-8 rounded-full object-cover" />}
          label="Pi Network"
          hint={inPiBrowser
            ? "Guest checkout · Pi Browser"
            : "Pi Browser required"} />
      )}
      {tabs.includes("card") && (
        <PayOpt active={activeMethod === "card"} onClick={() => setMethod("card")}
          logo={
            <span className="flex h-7 w-10 items-center justify-center rounded-[7px] bg-[var(--qrp-ink)]">
              <BrandLogo variant="white" animate={false} className="h-3.5 w-3.5" />
            </span>
          }
          label="Virtual Card"
          hint={savedCard ? `•••• ${String(savedCard.card_number).slice(-4)}` : "OpenPay card"} />
      )}
      {EXTRA_METHOD_KEYS.map((key) => (
        tabs.includes(key) ? (
          <PayOpt
            key={key}
            active={activeMethod === key}
            onClick={() => {
              setMethod(key);
              if (key !== "qr_ph") {
                setQrPhImageUrl(null);
                setQrPhOpen(false);
                setPaymongoPolling(false);
              }
            }}
            logo={
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-white p-1 ring-1 ring-black/[0.06]">
                <img src={EXTRA_METHOD_META[key].logo} alt="" className="h-full w-full object-contain" />
              </span>
            }
            label={EXTRA_METHOD_META[key].label}
            hint={EXTRA_METHOD_META[key].hint}
          />
        ) : null
      ))}
      {activeMethod === "bank" && (
        <div className="qrp-group-footer space-y-2">
          <p className="text-[12px] font-medium text-[var(--qrp-muted)]">Choose your bank</p>
          <div className="flex flex-wrap gap-2">
            {BANK_OPTIONS.map((b) => (
              <button
                key={b.code}
                type="button"
                onClick={() => setBankCode(b.code)}
                className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all active:scale-95 ${
                  bankCode === b.code
                    ? "bg-[var(--qrp-ink)] text-white"
                    : "bg-white text-[var(--qrp-ink)] ring-1 ring-black/10"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {activeMethod === "billease" && (
        <div className="qrp-group-footer">
          <p className="text-[12px] text-[var(--qrp-muted)]">
            You’ll complete eligibility and installments on BillEase. Min ₱100. If declined, pick another method.
          </p>
        </div>
      )}
      {tabs.includes("pro") && (
        <PayOpt active={activeMethod === "pro"} onClick={() => setMethod("pro")}
          logo={
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2c2c2e]">
              <BrandLogo variant="white" animate={false} className="h-5 w-5" />
            </span>
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
    : activeMethod === "pi" && !inPiBrowser
      ? "Copy the link and complete in Pi Browser."
    : activeMethod === "qr_ph"
      ? "Powered by PayMongo QR PH · code expires in ~30 minutes."
    : activeMethod === "gcash"
      ? "You'll authorize in the GCash app, then return here."
    : activeMethod === "billease"
      ? "Powered by BillEase · eligibility checked on redirect."
    : activeMethod === "bank"
      ? "You'll log in to your bank portal to authorize the transfer."
    : isExtraMethod && !isPaymongoMethod
      ? `${extraMeta!.label} integration coming soon — method is ready to enable.`
    : activeMethod === "wallet" && !session ? "You'll be asked to sign in." : "Encrypted · Instant receipt";

  const renderPayButton = () => (
    <Button
      className={payBtnClass}
      disabled={paying}
      onClick={onPay}
    >
      {paying || (activeMethod === "qr_ph" && paymongoPolling) ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isExtraMethod && extraMeta ? (
        <img src={extraMeta.logo} alt="" className="h-5 w-5 shrink-0 rounded object-contain bg-white/90 p-0.5" />
      ) : (
        <BrandLogo variant="white" animate={false} className="h-5 w-5 shrink-0" />
      )}
      {payLabel}
      {!paying && activeMethod === "pi" && (
        <img src={PURE_PI_ICON_URL} alt="" className="h-4 w-4 rounded-full object-cover opacity-90" />
      )}
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
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BrandLogo variant="white" animate={false} className="h-5 w-5 shrink-0" />
            )}
            {payLabel}
          </Button>
        </div>
      </div>

      <QrPayPiBrowserDialog
        open={piBrowserOpen}
        onOpenChange={(o) => {
          setPiBrowserOpen(o);
          if (!o) setWaitingPiCallback(false);
        }}
        checkoutUrl={checkoutUrl}
        waitingForPayment={waitingPiCallback}
        onUseOtherMethod={() => {
          setPiBrowserOpen(false);
          setWaitingPiCallback(false);
          const fallback = tabs.find((t) => t !== "pi") || null;
          if (fallback) setMethod(fallback);
        }}
      />

      {qrPhImageUrl && (
        <QrPayQrPhDialog
          open={qrPhOpen}
          onOpenChange={setQrPhOpen}
          qrImageUrl={qrPhImageUrl}
          phpAmount={paymongoPhpAmount}
          waitingForPayment={paymongoPolling}
          onUseOtherMethod={() => {
            setQrPhOpen(false);
            setQrPhImageUrl(null);
            setPaymongoPolling(false);
            const fallback = tabs.find((t) => t !== "qr_ph") || null;
            if (fallback) setMethod(fallback);
          }}
        />
      )}
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
