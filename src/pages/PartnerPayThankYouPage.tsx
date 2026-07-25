import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import AuthMark from "@/components/AuthMark";

const COUNTDOWN_SECONDS = 3;

const appendQueryParams = (baseUrl: string, params: Record<string, string | undefined | null>) => {
  try {
    const url = new URL(baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value != null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const PartnerPayThankYouPage = () => {
  const [searchParams] = useSearchParams();
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  const amount = searchParams.get("amount") || "";
  const currency = (searchParams.get("currency") || "OUSD").toUpperCase();
  const to = searchParams.get("to") || "";
  const name = searchParams.get("name") || "";
  const note = searchParams.get("note") || "";
  const tx = searchParams.get("tx") || "";
  const successUrl = (searchParams.get("success_url") || "").trim();

  const returnUrl = useMemo(() => {
    if (!successUrl) return "";
    return appendQueryParams(successUrl, {
      openpay_return: "1",
      openpay_ref: note || undefined,
      openpay_tx: tx || undefined,
    });
  }, [note, successUrl, tx]);

  const goBackToTopUp = () => {
    if (returnUrl) {
      window.location.href = returnUrl;
    }
  };

  useEffect(() => {
    if (!returnUrl) return;

    const tick = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(tick);
          window.location.href = returnUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [returnUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a53d8] to-[#062a78] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/10 backdrop-blur-xl">
          <div className="flex flex-col items-center text-center">
            <AuthMark className="mb-4 h-14 w-14" />
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-9 w-9 text-emerald-300" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Thank you</h1>
            <p className="mt-2 text-base font-semibold text-white/85">Payment successful</p>
          </div>

          <div className="mt-6 space-y-3 rounded-2xl border border-white/15 bg-black/10 p-4 text-sm">
            {amount ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/65">Amount</span>
                <span className="font-bold">
                  {Number(amount).toFixed(2)} {currency}
                </span>
              </div>
            ) : null}
            {(name || to) && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/65">Paid to</span>
                <span className="truncate font-bold">{name || `@${to}`}</span>
              </div>
            )}
            {to ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-white/65">Username</span>
                <span className="font-bold">@{to}</span>
              </div>
            ) : null}
            {note ? (
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-white/65">Reference</span>
                <span className="break-all text-right font-mono text-xs font-semibold">{note}</span>
              </div>
            ) : null}
            {tx ? (
              <div className="flex items-start justify-between gap-3">
                <span className="shrink-0 text-white/65">Transaction</span>
                <span className="break-all text-right font-mono text-xs font-semibold">{tx}</span>
              </div>
            ) : null}
          </div>

          {returnUrl ? (
            <>
              <p className="mt-5 text-center text-sm text-white/75">
                Returning to OpenPay Pro in {secondsLeft}s…
              </p>
              <Button
                type="button"
                onClick={goBackToTopUp}
                className="mt-4 h-12 w-full rounded-2xl bg-white font-bold text-paypal-blue hover:bg-white/95"
              >
                Back to Top Up now
              </Button>
            </>
          ) : (
            <p className="mt-5 text-center text-sm text-white/75">
              Your OpenPay Pro top-up payment was completed.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartnerPayThankYouPage;
