import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import AuthMark from "@/components/AuthMark";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";
import { setAppCookie } from "@/lib/userPreferences";
import AuthFooter from "@/components/AuthFooter";
import {
  Loader2, Mail, Download, Globe, BookOpen, Users, KeyRound, ChevronRight,
  Info, Newspaper, Library,
} from "lucide-react";
import { isPiBrowserUserAgent, isPiBrowserUAOnly } from "@/lib/appSecurity";
import { getFunctionErrorMessage } from "@/lib/supabaseFunctionError";
import { isPiOAuthEnabled } from "@/lib/piOAuth";
import { openExternalUrl } from "@/lib/externalLink";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import { OUSD_TOKEN } from "@/lib/ousdPrice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Same Pi mark used on QR Pay checkout */
const PURE_PI_ICON_URL = "https://i.ibb.co/BV8PHjB4/Pi-200x200.png";

const OPENPAY_PRO_LINKS: {
  id: string;
  label: string;
  hint: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    id: "home",
    label: "OpenPay Pro",
    hint: "Open the Pro app",
    href: "http://openpaypro4378.pinet.com",
    icon: <BrandLogo animate={false} className="h-5 w-5" />,
  },
  {
    id: "website",
    label: "Website",
    hint: "openpaypro.space",
    href: "http://openpaypro.space/website",
    icon: <Globe className="h-4 w-4" strokeWidth={2.25} />,
  },
  {
    id: "openusd",
    label: "OpenUSD",
    hint: "Learn about OpenUSD",
    href: "http://openpaypro.space/openusd",
    icon: (
      <img
        src={OUSD_TOKEN.logoUrl}
        alt=""
        className="h-5 w-5 rounded-full object-cover"
      />
    ),
  },
  {
    id: "about",
    label: "About",
    hint: "About OpenPay Pro",
    href: "http://openpaypro.space/about",
    icon: <Info className="h-4 w-4" strokeWidth={2.25} />,
  },
  {
    id: "blog",
    label: "Blog",
    hint: "News & updates",
    href: "http://openpaypro.space/blog",
    icon: <Newspaper className="h-4 w-4" strokeWidth={2.25} />,
  },
  {
    id: "wiki",
    label: "Wiki",
    hint: "Docs & guides",
    href: "http://openpaypro.space/wiki",
    icon: <Library className="h-4 w-4" strokeWidth={2.25} />,
  },
];

const PiAuthPage = () => {
  const [piUser, setPiUser] = useState<{ uid: string; username: string } | null>(null);
  const [busyAuth, setBusyAuth] = useState(false);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && !!window.Pi);
  const [proOpen, setProOpen] = useState(false);
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

  const signInPiBackedAccount = async (
    piUid: string,
    _piUsername: string,
    referralCode?: string,
    accessToken?: string,
  ) => {
    if (!accessToken) {
      throw new Error("Missing Pi access token");
    }

    // All credential handling happens server-side in the `pi-platform` edge
    // function. The client only receives a short-lived Supabase session and
    // hydrates it — the Pi UID → password formula is never exposed to the
    // browser bundle.
    const { data, error } = await supabase.functions.invoke("pi-platform", {
      body: { action: "auth_signin", accessToken, referralCode },
    });
    if (error) throw new Error(await getFunctionErrorMessage(error, "Failed to sign in Pi account"));

    const payload = data as
      | {
          success?: boolean;
          error?: string;
          data?: {
            uid?: string;
            username?: string;
            session?: { access_token?: string; refresh_token?: string };
          };
        }
      | null;

    const session = payload?.data?.session;
    if (!payload?.success || !session?.access_token || !session?.refresh_token) {
      throw new Error(payload?.error || "Failed to sign in Pi account");
    }

    const { error: setSessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (setSessionError) {
      throw new Error(setSessionError.message || "Failed to establish Pi session");
    }

    try {
      await callRpc("upsert_my_user_account");
    } catch {
      // best-effort
    }
    // piUid is validated server-side; return marker to keep call signature stable.
    void piUid;
    return { created: false };
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

  // NOTE: Pi Ad Network is intentionally NOT invoked anywhere in the
  // authentication flow. Per Pi ecosystem UX best practices, sign-in must
  // never be interrupted by advertisements. Ads only run post-login
  // (e.g. rewarded ads in the Mining flow).


  const handlePiAuth = async () => {
    const expectedCode = authorizationCode.trim().toUpperCase();

    if (!initPi() || !window.Pi) return;
    setBusyAuth(true);
    try {
      const referralCode = (searchParams.get("ref") || "").trim().toLowerCase();
      const auth = await window.Pi.authenticate(["username"]);
      // No ads during Pi authentication — seamless sign-in per Pi UX rules.

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
          <p className="mt-2 text-[11px] font-medium tracking-[-0.01em] text-white/55">
            {APP_VERSION_LABEL}
          </p>
        </div>

        {/* Main card */}
        <div className="rounded-[28px] bg-white p-6 shadow-[0_28px_80px_-24px_rgba(0,0,0,0.35)] dark:bg-[#1c1c1e]">
          {refParam && (
            <div className="mb-4 rounded-xl bg-[#007AFF]/10 px-3 py-2 text-[13px] font-medium text-[#007AFF]">
              Referral: {refParam}
            </div>
          )}
          {inPiBrowser && !sdkReady && (
            <div className="mb-4 rounded-xl bg-[#FF3B30]/10 px-3 py-2 text-[13px] font-medium text-[#FF3B30]">
              Pi SDK unavailable. Please reopen in Pi Browser.
            </div>
          )}

          {/* Primary action */}
          <Button
            onClick={handlePiAuthClick}
            disabled={busyAuth || (inPiBrowser && !sdkReady)}
            className="mb-3 h-12 w-full rounded-2xl bg-[#007AFF] text-[17px] font-semibold tracking-[-0.01em] text-white shadow-[0_1px_2px_rgba(0,122,255,0.28)] hover:bg-[#0066d6]"
          >
            {busyAuth ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Authenticating…</>
            ) : inPiBrowser && !sdkReady ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Pi SDK…</>
            ) : (
              <>
                <span className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
                  <img
                    src={PURE_PI_ICON_URL}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover"
                  />
                </span>
                Authenticate with Pi
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="mb-3 h-12 w-full rounded-2xl text-[17px] font-semibold tracking-[-0.01em]"
            onClick={() => setProOpen(true)}
          >
            <BrandLogo animate={false} className="mr-2 h-5 w-5 text-[#007AFF]" />
            OpenPay Pro
          </Button>

          {!inPiBrowser && (
            <Button
              asChild
              variant="outline"
              className="mb-3 h-12 w-full rounded-2xl border-0 bg-transparent text-[17px] font-semibold tracking-[-0.01em] text-[#1d1d1f] ring-1 ring-black/[0.08] hover:bg-[#f2f2f7] hover:text-[#1d1d1f]"
            >
              <Link to={emailHref}>
                <Mail className="mr-2 h-4 w-4" /> Sign In with Email
              </Link>
            </Button>
          )}

          {false && isPiOAuthEnabled() && (
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
              <button
                type="button"
                onClick={() => setProOpen(true)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
              >
                <span className="flex items-center gap-3">
                  <BrandLogo animate={false} className="h-4 w-4" />
                  OpenPay Pro
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
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

      <Dialog open={proOpen} onOpenChange={setProOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-[calc(100vw-2rem)] max-w-[380px] gap-0 overflow-hidden rounded-[28px] border-0 bg-white p-0 op-font shadow-[0_28px_80px_-24px_rgba(0,0,0,0.45)]"
        >
          <div className="px-6 pb-2 pt-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#1d1d1f]">
              <BrandLogo variant="white" animate={false} className="h-6 w-6" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-center text-[22px] font-bold tracking-[-0.03em] text-[#1d1d1f]">
                OpenPay Pro
              </DialogTitle>
              <DialogDescription className="text-center text-[14px] text-[#6e6e73]">
                Choose where to go
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-4 pb-3">
            <div className="overflow-hidden rounded-[16px] bg-[#f2f2f7]">
              {OPENPAY_PRO_LINKS.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    openExternalUrl(item.href);
                    setProOpen(false);
                  }}
                  className="relative flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-black/[0.06] hover:bg-black/[0.03]"
                >
                  {i > 0 && (
                    <span className="absolute inset-x-3.5 top-0 h-px bg-black/[0.06]" aria-hidden />
                  )}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#1d1d1f] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[#1d1d1f]">
                      {item.label}
                    </span>
                    <span className="block truncate text-[12px] text-[#8e8e93]">{item.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#c7c7cc]" />
                </button>
              ))}
            </div>
          </div>

          <div className="px-6 pb-7 pt-1 text-center">
            <button
              type="button"
              onClick={() => setProOpen(false)}
              className="text-[16px] font-medium text-[#007AFF]"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
