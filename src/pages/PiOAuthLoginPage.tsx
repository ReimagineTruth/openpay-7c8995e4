import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import AuthMark from "@/components/AuthMark";
import {
  PI_OAUTH_CONFIG,
  beginPiOAuth,
  isPiOAuthEnabled,
} from "@/lib/piOAuth";

/**
 * NEW, isolated Pi OAuth login entry point.
 * Does not touch the existing /auth (Pi SDK) or /sign-in (email/password) pages.
 */
const PiOAuthLoginPage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const enabled = isPiOAuthEnabled();

  useEffect(() => {
    document.title = "Continue with Pi — OpenPay";
  }, []);

  const handleContinue = () => {
    setSubmitting(true);
    try {
      beginPiOAuth();
    } catch (err) {
      setSubmitting(false);
      // eslint-disable-next-line no-console
      console.error("Pi OAuth start failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a3fa8] to-[#062468] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <AuthMark className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-2xl font-bold tracking-tight text-white">OpenPay</h1>
          <p className="mt-1 text-sm text-white/75">Continue with Pi Network</p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/20 dark:bg-[#0f172a]">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-paypal-blue hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>

          <h2 className="text-xl font-bold text-foreground">Continue with Pi</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Sign in to OpenPay using your Pi Network account via Pi's official OAuth flow.
            Your existing email and Pi Browser sign-ins continue to work.
          </p>

          <div className="mt-5 rounded-2xl border border-border/60 bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-paypal-blue" />
              What you authorize
            </p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-paypal-blue" />
                <span>Share your Pi <strong className="text-foreground">username</strong> with OpenPay.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-paypal-blue" />
                <span>Redirects to <code className="rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-foreground break-all">{PI_OAUTH_CONFIG.redirectUri}</code> after approval.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-paypal-blue" />
                <span>OpenPay never receives your Pi password.</span>
              </li>
            </ul>
          </div>

          {!enabled ? (
            <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Pi OAuth sign-in is currently disabled.
            </p>
          ) : (
            <Button
              type="button"
              onClick={handleContinue}
              disabled={submitting}
              className="mt-5 h-12 w-full rounded-2xl bg-paypal-blue text-base font-semibold text-white shadow-md shadow-paypal-blue/30 hover:bg-[#004dc5]"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to Pi…</>
              ) : (
                "Continue with Pi"
              )}
            </Button>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Prefer the in-app flow?{" "}
            <button
              type="button"
              className="font-semibold text-paypal-blue hover:underline"
              onClick={() => navigate("/auth")}
            >
              Use Pi Browser sign-in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PiOAuthLoginPage;
