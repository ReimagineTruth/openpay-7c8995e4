import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Wallet, QrCode, ShieldCheck, Smartphone, Calendar, DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import AuthMark from "@/components/AuthMark";

const db = supabase as any;

type AppPaymentLink = {
  id: string;
  link_name: string;
  link_description: string;
  app_payment_plans: {
    id: string;
    plan_name: string;
    plan_description: string;
    plan_type: string;
    amount: number;
    currency: string;
    trial_days: number;
    setup_fee: number;
  };
  app_registry: {
    app_name: string;
    app_logo_url: string;
  };
  custom_data: Record<string, any>;
};

const AppPaymentCheckoutPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") || "";
  const embed = searchParams.get("embed") === "1";
  const [loading, setLoading] = useState(false);
  const [paymentLink, setPaymentLink] = useState<AppPaymentLink | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "card">("wallet");
  const [processing, setProcessing] = useState(false);

  // Notify parent window when embedded
  const postParent = (msg: any) => {
    if (embed && typeof window !== "undefined" && window.parent !== window) {
      try { window.parent.postMessage({ source: "openpay-checkout", ...msg }, "*"); } catch {}
    }
  };

  // Wallet payment states
  const [accountNumber, setAccountNumber] = useState("");
  const [pin, setPin] = useState("");

  // Virtual card states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiryMonth, setCardExpiryMonth] = useState("");
  const [cardExpiryYear, setCardExpiryYear] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    const loadPaymentLink = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
        
        const response = await fetch(`${supabaseUrl}/functions/v1/app-payments/get-payment-link?token=${token}`, {
          headers: {
            'Authorization': `Bearer ${supabaseAnonKey}`
          }
        });
        const result = await response.json();
        
        if (result.success && result.data) {
          setPaymentLink(result.data);
        } else {
          toast.error("Payment link not found or inactive");
        }
      } catch (error) {
        toast.error("Failed to load payment details");
      }
      setLoading(false);
    };
    loadPaymentLink();
  }, [token]);

  const handlePayment = async () => {
    if (!paymentLink) {
      toast.error("Invalid payment link");
      return;
    }

    // Validation based on payment method
    if (paymentMethod === "wallet") {
      if (!accountNumber.trim() || !pin.trim()) {
        toast.error("Account number and PIN are required");
        return;
      }
    } else {
      const parsedMonth = Number(cardExpiryMonth.trim());
      const parsedYear = Number(cardExpiryYear.trim());

      if (!cardNumber.trim() || !cardExpiryMonth.trim() || !cardExpiryYear.trim() || !cardCvc.trim()) {
        toast.error("All card fields are required");
        return;
      }
      if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        toast.error("Invalid expiry month");
        return;
      }
      if (!Number.isFinite(parsedYear) || parsedYear < 2026) {
        toast.error("Invalid expiry year");
        return;
      }
    }

    setProcessing(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
        
        const response = await fetch(`${supabaseUrl}/functions/v1/app-payments/process-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify({
          link_token: token,
          payer_account: accountNumber.trim(),
          payer_pin: pin.trim() || null,
          payment_method: paymentMethod,
          customer_name: customerName.trim() || null,
          customer_email: customerEmail.trim() || null,
          customer_phone: customerPhone.trim() || null
        })
      });

      const result = await response.json();

      if (result.success && result.data?.status === "success") {
        toast.success("Payment completed successfully");
        postParent({ type: "payment_success", transaction_id: result.data.transaction_id });
        if (embed) {
          // In embed mode, stay on-page and show success state
          navigate(`/app-payment/success?tx=${result.data.transaction_id}&app=${paymentLink.app_registry.app_name}&embed=1`);
        } else {
          navigate(`/app-payment/success?tx=${result.data.transaction_id}&app=${paymentLink.app_registry.app_name}`);
        }
      } else {
        const msg = result.data?.message || result.error || "Payment failed";
        toast.error(msg);
        postParent({ type: "payment_error", error: msg });
      }
    } catch (error: any) {
      toast.error("Payment processing failed");
      postParent({ type: "payment_error", error: error?.message || "Payment processing failed" });
    } finally {
      setProcessing(false);
    }
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'one_time':
        return <DollarSign className="h-5 w-5" />;
      case 'recurring_monthly':
        return <Calendar className="h-5 w-5" />;
      case 'recurring_yearly':
        return <Calendar className="h-5 w-5" />;
      default:
        return <Smartphone className="h-5 w-5" />;
    }
  };

  const getPlanLabel = (planType: string) => {
    switch (planType) {
      case 'one_time':
        return 'One-time Payment';
      case 'recurring_monthly':
        return 'Monthly Subscription';
      case 'recurring_yearly':
        return 'Yearly Subscription';
      default:
        return 'Payment Plan';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading payment details...</p>
          <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Powered by Pi Network</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  if (!paymentLink) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Payment link not found</p>
          <p className="mt-1 text-xs font-medium tracking-normal text-white/65">Please check the link and try again</p>
        </div>
      </div>
    );
  }

  const plan = paymentLink.app_payment_plans;
  const app = paymentLink.app_registry;
  const totalAmount = plan.amount + plan.setup_fee;

  return (
    <div className="min-h-screen bg-background">
      {!embed && (
        <div className="flex h-14 items-center border-b border-border bg-card px-4">
          <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="mx-3 h-7 w-px bg-border" />
          <p className="flex items-center gap-2 text-xl font-medium text-foreground">
            <Smartphone className="h-5 w-5" />
            App Payment
          </p>
        </div>
      )}

      <div className="grid min-h-[calc(100vh-56px)] grid-cols-1 lg:grid-cols-[1fr_900px]">
        <div className="border-r border-border bg-muted/30 px-6 py-10">
          <div className="mx-auto w-full max-w-xl">
            {app.app_logo_url ? (
              <img src={app.app_logo_url} alt={app.app_name} className="mb-4 h-48 w-full rounded-2xl border border-border object-cover" />
            ) : (
              <div className="mb-4 h-48 w-full rounded-2xl border border-border bg-gradient-to-br from-paypal-blue/20 to-paypal-blue/10 flex items-center justify-center">
                <Smartphone className="h-16 w-16 text-paypal-blue" />
              </div>
            )}
            
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-paypal-blue/20 text-[10px] font-bold text-paypal-blue">
                {(app.app_name || "A").slice(0, 1).toUpperCase()}
              </div>
              <p className="text-3xl font-semibold text-foreground">{app.app_name}</p>
            </div>
            
            <div className="mb-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3 mb-2">
                {getPlanIcon(plan.plan_type)}
                <div>
                  <p className="text-lg font-semibold text-foreground">{plan.plan_name}</p>
                  <p className="text-sm text-muted-foreground">{getPlanLabel(plan.plan_type)}</p>
                </div>
              </div>
              
              {plan.plan_description && (
                <p className="text-sm text-muted-foreground mb-3">{plan.plan_description}</p>
              )}
              
              {paymentLink.link_description && (
                <p className="text-sm text-foreground bg-secondary/50 rounded-lg p-2">{paymentLink.link_description}</p>
              )}
              
              {plan.trial_days > 0 && (
                <div className="mt-3 flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">{plan.trial_days} days free trial</span>
                </div>
              )}
            </div>
            
            <p className="text-6xl font-semibold leading-none text-foreground">
              {plan.currency} {totalAmount.toFixed(2)}
            </p>
            
            {plan.setup_fee > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Includes {plan.currency} {plan.setup_fee.toFixed(2)} setup fee
              </p>
            )}
          </div>
        </div>

        <div className="bg-card px-6 py-10">
          <div className="mx-auto w-full max-w-lg">
            <h2 className="text-4xl font-semibold text-foreground">Complete Payment</h2>

            <div className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wallet")}
                  className={`flex h-16 items-center gap-2 rounded-md border px-3 text-left ${
                    paymentMethod === "wallet" ? "border-paypal-blue text-paypal-blue" : "border-border text-muted-foreground"
                  }`}
                >
                  <Wallet className="h-5 w-5" />
                  <span className="text-lg font-medium">OpenPay Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex h-16 items-center gap-2 rounded-md border px-3 text-left ${
                    paymentMethod === "card" ? "border-paypal-blue text-paypal-blue" : "border-border text-muted-foreground"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span className="text-lg font-medium">Virtual Card</span>
                </button>
              </div>

              {paymentMethod === "wallet" ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-1 text-xl text-foreground">Account Number</p>
                    <Input
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="OP123456789"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xl text-foreground">PIN</p>
                    <Input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Enter your PIN"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">Enter your OpenPay account details to complete this payment.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="mb-1 text-xl text-foreground">Virtual card number</p>
                    <Input
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="1234 1234 1234 1234"
                      className="h-12 rounded-md text-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1 text-xl text-foreground">Expiry date</p>
                      <Input
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value)}
                        placeholder="MM / YY"
                        className="h-12 rounded-md text-lg"
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xl text-foreground">Security code</p>
                      <Input
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="CVC"
                        className="h-12 rounded-md text-lg"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Use your OpenPay virtual card to complete this payment.</p>
                </div>
              )}

              <div className="mt-4 space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-semibold text-foreground">Customer details (optional)</p>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  className="h-11 rounded-md"
                />
                <Input
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="Email"
                  className="h-11 rounded-md"
                />
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone"
                  className="h-11 rounded-md"
                />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-center justify-between text-lg">
                  <span className="text-foreground">Plan Price</span>
                  <span className="font-semibold text-foreground">
                    {plan.currency} {plan.amount.toFixed(2)}
                  </span>
                </div>
                {plan.setup_fee > 0 && (
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Setup Fee (one-time)</span>
                    <span className="font-semibold text-foreground">
                      {plan.currency} {plan.setup_fee.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">OpenPay fee (2%)</span>
                  <span className="font-semibold text-foreground">
                    {plan.currency} {(totalAmount * 0.02).toFixed(2)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-lg font-bold">
                  <span className="text-foreground">Total</span>
                  <span className="font-bold text-foreground">
                    {plan.currency} {totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <Button
                onClick={handlePayment}
                disabled={processing}
                className="mt-4 h-12 w-full rounded-full text-base bg-paypal-blue text-white hover:bg-[#004dc5]"
              >
                {processing ? (
                  <span className="inline-flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Processing...
                  </span>
                ) : (
                  <span className="inline-flex items-center">
                    <BrandLogo className="mr-2 h-4 w-4" />
                    Pay with OpenPay
                  </span>
                )}
              </Button>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                <p className="inline-flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-4 w-4" /> Secure App Payment
                </p>
                <p className="mt-2">Your payment is processed securely through OpenPay.</p>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">Powered by OpenPay</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppPaymentCheckoutPage;
