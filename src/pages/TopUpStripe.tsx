import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wallet, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StripeTopUpCheckout } from "@/components/StripeTopUpCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const STRIPE_LOGO_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/1920px-Stripe_Logo%2C_revised_2016.svg.png";

const PRESETS = [10, 25, 50, 100, 250, 500];

const TopUpStripe = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAmount = Number(
    searchParams.get("openUsdAmount") || searchParams.get("amount") || "0",
  );

  const initial = Number.isFinite(presetAmount) && presetAmount > 0 ? presetAmount : 25;
  const [amount, setAmount] = useState<number>(initial);
  const [input, setInput] = useState<string>(initial.toString());
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setInput(amount.toString());
  }, [amount]);

  const returnUrl = useMemo(
    () => `${window.location.origin}/topup/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    [],
  );

  const validAmount = amount >= 1 && amount <= 10000;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-md p-4 pb-24">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img src={STRIPE_LOGO_URL} alt="Stripe" className="h-6" />
          <span className="ml-auto text-xs text-muted-foreground">Visa · Mastercard · Apple Pay · Google Pay · Link</span>
        </div>

        <div className="rounded-2xl border bg-card p-5 mb-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4" /> Top up OUSD wallet · 1 USD = 1 OUSD
          </div>

          {!started ? (
            <>
              <label htmlFor="topup-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount (USD)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-semibold">$</span>
                <Input
                  id="topup-amount"
                  type="number"
                  min={1}
                  max={10000}
                  step="0.01"
                  inputMode="decimal"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) setAmount(n);
                  }}
                  className="text-2xl font-semibold h-12"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={amount === p ? "default" : "outline"}
                    onClick={() => setAmount(p)}
                  >
                    ${p}
                  </Button>
                ))}
              </div>

              <Button
                className="w-full mt-4 h-12 text-base"
                disabled={!validAmount}
                onClick={() => setStarted(true)}
              >
                Continue to payment · ${amount.toFixed(2)}
              </Button>
              {!validAmount && (
                <p className="text-xs text-destructive mt-2">Enter an amount between $1 and $10,000.</p>
              )}
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-3">
                <ShieldCheck className="h-3 w-3" /> Payments are processed securely by Stripe.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-muted-foreground">Topping up</div>
                  <div className="text-xl font-semibold">${amount.toFixed(2)} OUSD</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStarted(false)}>
                  Change
                </Button>
              </div>
              <StripeTopUpCheckout amountUsd={amount} returnUrl={returnUrl} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopUpStripe;
