import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AuthMark from "@/components/AuthMark";
import { supabase } from "@/integrations/supabase/client";
import { setAppCookie } from "@/lib/userPreferences";
import AuthFooter from "@/components/AuthFooter";
import { Loader2, Mail, Download, Globe, BookOpen, Users, KeyRound, ChevronRight } from "lucide-react";
import { isPiBrowserUserAgent, isPiBrowserUAOnly } from "@/lib/appSecurity";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import { isPiOAuthEnabled } from "@/lib/piOAuth";

const PiAuthPage = () => {
  const [piUser, setPiUser] = useState<{ uid: string; username: string } | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && !!window.Pi);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Only hide email sign-in when actually running inside Pi Browser (UA-based).
  // The Pi SDK script can load in regular browsers too, so do NOT rely on sdkReady here.
  const inPiBrowser = isPiBrowserUAOnly();

  const envSandbox = String(import.meta.env.VITE_PI_SANDBOX || "").trim().toLowerCase();
  const sandbox =
    envSandbox.length > 0
      ? envSandbox === "true"
      : typeof window !== "undefined"
        ? window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1" ||
          window.location.hostname.endsWith(".local") ||
          window.location.hostname.endsWith(".test")
        : false;

  const callRpc = (fn: string, args?: Record<string, unknown>) =>
    (supabase.rpc as unknown as (name: string, params?: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(fn, args);

  const initPi = () => {
    if (!window.Pi) {
      toast.error("Pi authentication requires Pi Browser. Open this page in Pi Browser.");
      return false;
    }
    window.Pi.init({ version: "2.0", sandbox });
    return true;
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/dashboard", { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Pi) {
      setSdkReady(true);
      return;
    }
    const handleSdkReady = () => setSdkReady(!!window.Pi);
    window.addEventListener("pi-sdk-ready", handleSdkReady);
    return () => window.removeEventListener("pi-sdk-ready", handleSdkReady);
  }, []);

  useEffect(() => {
    const ref = (searchParams.get("ref") || "").trim().toLowerCase();
    if (ref) {
      setAppCookie("openpay_last_ref", ref);
    }
    const incomingCode = (
      searchParams.get("auth_code") ||
      searchParams.get("openpay_code") ||
      searchParams.get("code") ||
      ""
    )
      .trim()
      .toUpperCase();
    if (incomingCode) setAuthorizationCode(incomingCode);
  }, [searchParams]);

  const signInPiBackedAccount = async (piUid: string, piUsername: string, referralCode?: string, accessToken?: string) => {
    const piEmail = `pi_${piUid}@openpay.local`;
    const piPassword = `OpenPay-Pi-${piUid}-v1!`;
    // Prefer Pi username when creating OpenPay account; fallback to uid-derived handle if missing
    const cleanPiUsername = (piUsername || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const piSignupUsername =
      cleanPiUsername && cleanPiUsername.length >= 3
        ? cleanPiUsername
        : `pi_${piUid.replace(/-/g, "").slice(0, 16)}`;
    const resolvedPiUsername = piUsername || piSignupUsername;
    let created = false;

    const doSignIn = async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: piEmail,
        password: piPassword,
      });
      return { session: data.session, error };
    };

    const firstSignIn = await doSignIn();
    if (!firstSignIn.error && firstSignIn.session) return;

    const firstSignInMessage = firstSignIn.error?.message?.toLowerCase() || "";
    const accountMissing =
      firstSignInMessage.includes("invalid login credentials") ||
      firstSignInMessage.includes("email not confirmed") ||
      firstSignInMessage.includes("user not found");

    if (accountMissing) {
      if (accessToken) {
        try {
          const { error } = await supabase.functions.invoke("pi-platform", {
            body: { action: "auth_prepare_user", accessToken, referralCode },
          });
          if (error) throw new Error(await getFunctionErrorMessage(error, "Failed to prepare Pi account"));

          const preparedSignIn = await doSignIn();
          if (!preparedSignIn.error && preparedSignIn.session) {
            try {
              await callRpc("upsert_my_user_account");
            } catch {
              // ignore best-effort
            }
            return { created: false };
          }
        } catch {
          // Fall back to client sign-up below for older backend deployments.
        }
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: piEmail,
        password: piPassword,
        options: {
          data: {
            full_name: piUsername,
            username: piSignupUsername,
            referral_code: referralCode,
            pi_uid: piUid,
            pi_username: resolvedPiUsername,
            pi_connected_at: new Date().toISOString(),
          },
        },
      });

      if (signUpError && !signUpError.message.toLowerCase().includes("already registered")) {
        throw new Error(signUpError.message || "Failed to create Pi account");
      }
      if (!signUpError) created = true;

      const secondSignIn = await doSignIn();
      if (secondSignIn.error || !secondSignIn.session) {
        throw new Error(secondSignIn.error?.message || "Failed to sign in Pi account");
      }
      // Ensure profile/account records exist and reflect latest metadata
      try {
        await callRpc("upsert_my_user_account");
      } catch {
        // ignore best-effort
      }
      return { created };
    }

    throw new Error(firstSignIn.error?.message || "Failed to sign in Pi account");
  };

  const verifyPiAccessToken = async (accessToken: string) => {
    const { data, error } = await supabase.functions.invoke("pi-platform", {
      body: { action: "auth_verify", accessToken },
    });
    if (error) throw new Error(error.message || "Pi auth verification failed");
    const payload = data as { success?: boolean; data?: { uid?: string; username?: string }; error?: string } | null;
    if (!payload?.success || !payload.data?.uid) {
      throw new Error(payload?.error || "Pi auth verification failed");
    }
    return {
      uid: String(payload.data.uid),
      username: String(payload.data.username || ""),
    };
  };

  const verifyAuthorizationCode = async (code: string) => {
    if (!code) return true;
    const { data, error } = await callRpc("verify_my_openpay_authorization_code", {
      p_code: code,
    });
    if (error) throw new Error(error.message || "Authorization code verification failed");
    if (!data) throw new Error("Authorization code is invalid or expired");
    return true;
  };

  const showRewardedAdBeforeAuth = async () => {
    try {
      // Check 5-minute interval to prevent spam
      try {
        const lastAd = window.localStorage.getItem("openpay:pi-ads:last-rewarded");
        if (lastAd && Date.now() - Number(lastAd) < 5 * 60 * 1000) return;
      } catch {
        // ignore localStorage errors
      }

      if (!window.Pi?.Ads || typeof window.Pi.nativeFeaturesList !== "function") return;
      const features = await window.Pi.nativeFeaturesList();
      if (!features.includes("ad_network")) return;
      const ready = await window.Pi.Ads.isAdReady("rewarded").catch(() => ({ ready: false }));
      if (!ready?.ready) {
        await window.Pi.Ads.requestAd("rewarded").catch(() => null);
      }
      let shown = await window.Pi.Ads.showAd("rewarded").catch(() => null);
      if (shown?.result === "USER_UNAUTHENTICATED") {
        await window.Pi.authenticate(["username"]);
        shown = await window.Pi.Ads.showAd("rewarded").catch(() => null);
      }
      if (shown?.result === "AD_REWARDED") {
        toast.success("Thanks for watching! Authenticating...");
        try {
          window.localStorage.setItem("openpay:pi-ads:last-rewarded", String(Date.now()));
        } catch {
          // ignore localStorage errors
        }
      }
    } catch {
      // best-effort; never block auth
    }
  };

  const handlePiAuth = async () => {
    const expectedCode = authorizationCode.trim().toUpperCase();

    if (!initPi() || !window.Pi) return;
    setBusyAuth(true);
    try {
      const referralCode = (searchParams.get("ref") || "").trim().toLowerCase();
      const auth = await window.Pi.authenticate(["username"]);
      await showRewardedAdBeforeAuth();
      const verified = await verifyPiAccessToken(auth.accessToken);

      const username =
        verified.username ||
        auth.user.username ||
        `pi_${verified.uid.replace(/-/g, "").slice(0, 16)}`;

      await signInPiBackedAccount(verified.uid, username, referralCode || undefined, auth.accessToken);
      if (expectedCode) {
        try {
          await verifyAuthorizationCode(expectedCode);
        } catch (error) {
          await supabase.auth.signOut();
          throw error;
        }
      }

      // Ensure current authenticated user has latest Pi metadata.
      try {
        await callRpc("upsert_my_user_account");
      } catch {
        // ignore best-effort
      }

      setPiUser({ uid: verified.uid, username });
      toast.success(`Authenticated as @${username}`);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pi auth failed");
    } finally {
      setBusyAuth(false);
    }
  };

  const handlePiAuthClick = async () => {
    if (!window.Pi) {
      try {
        await navigator.clipboard?.writeText(window.location.href);
        toast.message("Pi authentication requires Pi Browser. Link copied.");
      } catch {
        toast.error("Pi authentication requires Pi Browser. Please open this page in Pi Browser.");
      }
      return;
    }
    await handlePiAuth();
  };

  const refParam = (searchParams.get("ref") || "").trim().toLowerCase();
  const emailHref = `/sign-in?mode=signin${refParam ? `&ref=${encodeURIComponent(refParam)}` : ""}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-paypal-blue via-[#0a3fa8] to-[#062468] px-5 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <AuthMark className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-2xl font-bold tracking-tight text-white">OpenPay</h1>
          <p className="mt-1 text-sm text-white/75">
            {inPiBrowser ? "Sign in with your Pi account" : "Sign in to your wallet"}
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-black/20 dark:bg-[#0f172a]">
          {refParam && (
            <div className="mb-4 rounded-xl bg-paypal-blue/10 px-3 py-2 text-xs font-medium text-paypal-blue">
              Referral: {refParam}
            </div>
          )}
          {inPiBrowser && !sdkReady && (
            <div className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
              Pi SDK unavailable. Please reopen in Pi Browser.
            </div>
          )}

          {/* Primary action */}
          <Button
            onClick={handlePiAuthClick}
            disabled={busyAuth || (inPiBrowser && !sdkReady)}
            className="mb-3 h-12 w-full rounded-2xl bg-paypal-blue text-base font-semibold text-white shadow-md shadow-paypal-blue/30 hover:bg-[#004dc5]"
          >
            {busyAuth ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating…</>
            ) : inPiBrowser && !sdkReady ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Pi SDK…</>
            ) : (
              <>Authenticate with Pi</>
            )}
          </Button>

          {!inPiBrowser && (
            <Button
              asChild
              variant="outline"
              className="h-12 w-full rounded-2xl border-border/60 text-base font-semibold"
            >
              <Link to={emailHref}>
                <Mail className="mr-2 h-4 w-4" /> Sign In with Email
              </Link>
            </Button>
          )}

          {isPiOAuthEnabled() && (
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-11 w-full rounded-2xl text-sm font-medium text-paypal-blue hover:bg-paypal-blue/5"
              onClick={() => navigate("/auth/pi/login")}
            >
              <KeyRound className="mr-2 h-4 w-4" /> Continue with Pi (OAuth)
            </Button>
          )}

          {/* Resources */}
          <div className="mt-6">
            <p className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Resources
            </p>
            <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-muted/30">
              <ResourceLink href="https://minepi.com/" icon={<Download className="h-4 w-4" />} label="Download Pi Browser" />
              <ResourceLink href="https://www.droplinkpi.space/@openpay" icon={<Users className="h-4 w-4" />} label="OpenPay Socials" />
              <ResourceLink href="https://www.openpy.space/" icon={<Globe className="h-4 w-4" />} label="OpenPay Website" />
              <ResourceLink href="https://www.openpy.space/blog" icon={<BookOpen className="h-4 w-4" />} label="OpenPay Blog" />
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
            {inPiBrowser
              ? "Full-screen experience, notifications, POS, and Merchant Portal."
              : "For the full Pi experience — notifications, POS, and merchant tools — open in Pi Browser."}
          </p>

          {piUser && (
            <p className="mt-3 text-center text-sm text-foreground">
              Connected as <span className="font-semibold">@{piUser.username}</span>
            </p>
          )}

          <div className="mt-5 border-t border-border/60 pt-4">
            <AuthFooter />
          </div>
        </div>
      </div>
    </div>
  );
};

const ResourceLink = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
  >
    <span className="flex items-center gap-3">
      <span className="text-paypal-blue">{icon}</span>
      {label}
    </span>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </a>
);

export default PiAuthPage;
