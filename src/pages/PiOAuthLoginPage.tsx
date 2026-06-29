import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
    <div className="min-h-screen bg-background px-4 pt-6 pb-10">
      <button
        onClick={() => navigate(-1)}
        aria-label="Back"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mx-auto max-w-md rounded-3xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold text-foreground">Continue with Pi</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to OpenPay using your Pi Network account via Pi's official
          OAuth Sign-In flow. This is an additional sign-in method — your
          existing email and Pi Browser sign-ins continue to work unchanged.
        </p>

        <div className="mt-5 rounded-2xl border border-border p-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-paypal-blue" />
            What you authorize
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Share your Pi <strong>username</strong> with OpenPay.</li>
            <li>
              Redirects to <code>{PI_OAUTH_CONFIG.redirectUri}</code> after
              approval.
            </li>
            <li>OpenPay never receives your Pi password.</li>
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
            className="mt-5 h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
          >
            {submitting ? "Redirecting to Pi…" : "Continue with Pi"}
          </Button>
        )}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Prefer the in-app flow?{" "}
          <button
            type="button"
            className="underline"
            onClick={() => navigate("/auth")}
          >
            Use Pi Browser sign-in
          </button>
        </p>
      </div>
    </div>
  );
};

export default PiOAuthLoginPage;
