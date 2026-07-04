import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Delete, Fingerprint, KeyRound, Lock, ShieldCheck, LogOut, HelpCircle, KeySquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrandLogo from "@/components/BrandLogo";
import {
  clearAppSecurityUnlock,
  hasAnyAppSecurityMethod,
  isAppSecurityUnlocked,
  loadAppSecuritySettings,
  saveAppSecuritySettings,
  markAppSecurityUnlocked,
  hashSecret,
  verifyBiometricCredential,
} from "@/lib/appSecurity";
import { loadUserPreferences } from "@/lib/userPreferences";

const PUBLIC_PATHS = new Set([
  "/",
  "/auth",
  "/sign-in",
  "/signin",
  "/signup",
  "/ledger",
  "/openledger",
  "/admin-mrwain",
  "/terms",
  "/privacy",
  "/about-openpay",
  "/legal",
  "/help-center",
  "/send",
  "/confirm-pin",
  "/topup",
  "/receive",
  "/request-payment",
  "/two-factor-verify"
]);

const AppSecurityGate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accountLabel, setAccountLabel] = useState("Secure Account");
  const [settings, setSettings] = useState(() => ({} as ReturnType<typeof loadAppSecuritySettings>));
  const [method, setMethod] = useState<"pin" | "password">("pin");
  const pinInputRef = useRef<HTMLInputElement | null>(null);
  const lastPointerActionAtRef = useRef<number>(0);

  const hasPin = Boolean(settings.pinHash);
  const hasPassword = Boolean(settings.passwordHash);
  const hasBiometric = Boolean(settings.biometricEnabled && settings.biometricCredentialId);
  const primaryButtonClass = "h-11 w-full rounded-2xl bg-paypal-blue text-white font-semibold hover:bg-[#004dc5] disabled:bg-paypal-blue/45";
  const darkButtonClass = "h-11 w-full rounded-2xl bg-paypal-dark text-white font-semibold hover:bg-paypal-dark/90 disabled:bg-paypal-dark/45 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100";
  const softButtonClass = "h-11 w-full rounded-2xl border border-paypal-light-blue/70 bg-white text-paypal-dark font-semibold hover:bg-[#f2f7ff] dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-secondary";

  const shouldSkipPath = useMemo(() => {
    if (location.pathname.startsWith("/admin")) return true;
    // Public customer-facing payment & checkout flows must never be MPIN-gated
    if (location.pathname.startsWith("/pay/")) return true;
    if (location.pathname.startsWith("/public-payment")) return true;
    if (location.pathname.startsWith("/app-payment")) return true;
    if (location.pathname.startsWith("/buttons/")) return true;
    if (location.pathname.startsWith("/payment-link")) return true;
    // Always skip when running in an embedded iframe (drop-in checkout)
    if (typeof window !== "undefined" && window.parent !== window) return true;
    return PUBLIC_PATHS.has(location.pathname);
  }, [location.pathname]);
  const timeGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  useEffect(() => {
    const check = async () => {
      setError("");
      if (shouldSkipPath) {
        setLocked(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLocked(false);
        return;
      }

      const currentUserId = user.id;
      setUserId(currentUserId);
      const fallbackLabel = user.phone || user.email || "Secure Account";
      setAccountLabel(fallbackLabel);
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", currentUserId)
          .maybeSingle();
        if (profile?.username) {
          setAccountLabel(`@${profile.username}`);
        }
      } catch {
        // keep fallback label
      }
      let loaded = loadAppSecuritySettings(currentUserId);
      if (!hasAnyAppSecurityMethod(loaded)) {
        try {
          const prefs = await loadUserPreferences(currentUserId);
          if (hasAnyAppSecurityMethod(prefs.security_settings)) {
            loaded = prefs.security_settings;
            saveAppSecuritySettings(currentUserId, loaded);
          }
        } catch {
          // Keep local-only behavior if preference table is unavailable.
        }
      }
      setSettings(loaded);

      if (!hasAnyAppSecurityMethod(loaded)) {
        setLocked(false);
        return;
      }

      if (isAppSecurityUnlocked(currentUserId)) {
        setLocked(false);
        return;
      }

      setLocked(true);
    };

    check();
  }, [shouldSkipPath, location.pathname]);

  const unlockSuccess = () => {
    if (!userId) return;
    markAppSecurityUnlocked(userId);
    setLocked(false);
    setPin("");
    setPassword("");
    setError("");
  };

  const focusPinInput = () => {
    try {
      pinInputRef.current?.focus();
    } catch {
      // ignore focus failures
    }
  };

  const markPointerAction = () => {
    lastPointerActionAtRef.current = Date.now();
  };

  const shouldIgnoreClick = () => Date.now() - lastPointerActionAtRef.current < 600;

  const handlePinDigitPress = (digit: string) => {
    if (busy) return;
    if (!/^\d$/.test(digit)) return;
    setPin((prev) => (prev + digit).replace(/\D/g, "").slice(0, 8));
  };

  const handlePinBackspace = () => {
    if (busy) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleUnlockWithPin = async () => {
    if (!settings.pinHash) return;
    setError("");
    if (pin.replace(/\D/g, "").length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    setBusy(true);
    const hashed = await hashSecret(pin);
    setBusy(false);
    if (hashed !== settings.pinHash) {
      setError("Invalid PIN.");
      return;
    }
    unlockSuccess();
  };

  const handleUnlockWithPassword = async () => {
    if (!settings.passwordHash) return;
    setBusy(true);
    const hashed = await hashSecret(password);
    setBusy(false);
    if (hashed !== settings.passwordHash) {
      setError("Invalid security password.");
      return;
    }
    unlockSuccess();
  };

  const handleUnlockWithBiometric = async () => {
    if (!settings.biometricCredentialId) return;
    setBusy(true);
    setError("");
    try {
      await verifyBiometricCredential(settings.biometricCredentialId);
      unlockSuccess();
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : "Biometric unlock failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (userId) clearAppSecurityUnlock(userId);
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!locked) return null;

  return (
    <div
      className="openpay-lock-scroll fixed inset-0 z-[10000] overflow-y-auto bg-gradient-to-b from-paypal-blue to-[#072a7a] text-white pointer-events-auto dark:from-slate-950 dark:to-slate-900"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        .openpay-lock-scroll::-webkit-scrollbar { display: none; }
      `}</style>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-6 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight">OpenPay</span>
          </div>
          <button
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur transition hover:bg-white/15"
          >
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>

        {/* Greeting */}
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 shadow-inner shadow-black/25 backdrop-blur">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <p className="mt-4 text-2xl font-bold tracking-tight">{timeGreeting}</p>
          <div className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/15 px-3.5 py-1 text-sm font-semibold text-white/95 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="truncate max-w-[16rem]">{accountLabel}</span>
          </div>
        </div>

        {/* Card */}
        <div className="mt-7 rounded-3xl border border-white/60 bg-white/95 p-5 text-paypal-dark shadow-2xl shadow-black/25 backdrop-blur-xl dark:border-border dark:bg-card dark:text-foreground dark:shadow-black/50">
          {/* Method tabs */}
          {hasPin && hasPassword && (
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-paypal-light-blue/30 p-1 dark:bg-secondary">
              <button
                type="button"
                onClick={() => setMethod("pin")}
                className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition ${
                  method === "pin"
                    ? "bg-white text-paypal-blue shadow dark:bg-background dark:text-foreground"
                    : "text-paypal-dark/60 dark:text-muted-foreground"
                }`}
              >
                <KeySquare className="h-3.5 w-3.5" /> MPIN
              </button>
              <button
                type="button"
                onClick={() => setMethod("password")}
                className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold transition ${
                  method === "password"
                    ? "bg-white text-paypal-blue shadow dark:bg-background dark:text-foreground"
                    : "text-paypal-dark/60 dark:text-muted-foreground"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Password
              </button>
            </div>
          )}

          {hasPin && (!hasPassword || method === "pin") && (
            <div>
              <div className="text-center">
                <p className="text-base font-bold tracking-tight">Enter your MPIN</p>
                <p className="mt-0.5 text-[11px] text-paypal-dark/55 dark:text-muted-foreground">4–8 digit secure PIN</p>
              </div>

              {/* Hidden input for keyboard */}
              <Input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                autoFocus
                maxLength={8}
                autoComplete="off"
                ref={pinInputRef}
                onKeyDown={(event) => { if (event.key === "Enter") void handleUnlockWithPin(); }}
                className="sr-only"
                aria-label="MPIN"
              />

              {/* Dots */}
              <div className="mt-4 flex justify-center gap-2.5">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((dot) => (
                  <span
                    key={dot}
                    className={`h-3 w-3 rounded-full transition-all ${
                      pin.length > dot
                        ? "scale-100 bg-paypal-blue shadow-[0_0_0_3px_rgba(0,112,243,0.15)]"
                        : "scale-90 border border-paypal-light-blue bg-transparent dark:border-border"
                    }`}
                  />
                ))}
              </div>

              {/* Keypad */}
              <div className="mt-5 grid grid-cols-3 gap-2.5 text-paypal-dark dark:text-foreground">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { if (shouldIgnoreClick()) return; handlePinDigitPress(String(n)); focusPinInput(); }}
                    onPointerDown={(event) => { event.preventDefault(); markPointerAction(); handlePinDigitPress(String(n)); focusPinInput(); }}
                    className="flex h-14 items-center justify-center rounded-2xl bg-[#f4f7ff] text-2xl font-semibold shadow-sm ring-1 ring-inset ring-paypal-light-blue/40 transition hover:bg-white hover:shadow-md active:scale-95 dark:bg-secondary dark:ring-border"
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { if (shouldIgnoreClick()) return; handlePinBackspace(); focusPinInput(); }}
                  onPointerDown={(event) => { event.preventDefault(); markPointerAction(); handlePinBackspace(); focusPinInput(); }}
                  className="flex h-14 items-center justify-center rounded-2xl bg-transparent text-paypal-dark/70 transition hover:bg-[#f4f7ff] active:scale-95 dark:hover:bg-secondary"
                  aria-label="Backspace"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => { if (shouldIgnoreClick()) return; handlePinDigitPress("0"); focusPinInput(); }}
                  onPointerDown={(event) => { event.preventDefault(); markPointerAction(); handlePinDigitPress("0"); focusPinInput(); }}
                  className="flex h-14 items-center justify-center rounded-2xl bg-[#f4f7ff] text-2xl font-semibold shadow-sm ring-1 ring-inset ring-paypal-light-blue/40 transition hover:bg-white hover:shadow-md active:scale-95 dark:bg-secondary dark:ring-border"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => { if (shouldIgnoreClick()) return; void handleUnlockWithPin(); focusPinInput(); }}
                  onPointerDown={(event) => { event.preventDefault(); markPointerAction(); void handleUnlockWithPin(); focusPinInput(); }}
                  disabled={busy || pin.replace(/\D/g, "").length < 4}
                  className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-br from-paypal-blue to-[#0059d1] text-white shadow-lg shadow-paypal-blue/30 transition hover:shadow-xl active:scale-95 disabled:from-paypal-blue/45 disabled:to-paypal-blue/45 disabled:shadow-none"
                  aria-label="Unlock"
                >
                  <Check className="h-6 w-6" />
                </button>
              </div>

              {hasBiometric && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { if (shouldIgnoreClick()) return; void handleUnlockWithBiometric(); }}
                  onPointerDown={(event) => { event.preventDefault(); markPointerAction(); void handleUnlockWithBiometric(); }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-paypal-light-blue/50 bg-white py-3 text-sm font-semibold text-paypal-blue transition hover:bg-[#f4f7ff] active:scale-[0.99] dark:border-border dark:bg-secondary dark:text-foreground"
                >
                  <Fingerprint className="h-4 w-4" /> Use Face ID / Fingerprint
                </button>
              )}
            </div>
          )}

          {hasPassword && (!hasPin || method === "password") && (
            <div>
              <div className="text-center">
                <p className="text-base font-bold tracking-tight">Security Password</p>
                <p className="mt-0.5 text-[11px] text-paypal-dark/55 dark:text-muted-foreground">Unlock with your account password</p>
              </div>
              <div className="mt-4 relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-paypal-dark/40" />
                <Input
                  type="password"
                  placeholder="Enter security password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") void handleUnlockWithPassword(); }}
                  className="h-12 rounded-2xl border-paypal-light-blue/70 bg-[#f8fbff] pl-10 text-sm dark:border-border dark:bg-secondary dark:text-foreground"
                />
              </div>
              <Button
                disabled={busy || !password.trim()}
                onClick={() => { if (shouldIgnoreClick()) return; void handleUnlockWithPassword(); }}
                onPointerDown={(event) => { event.preventDefault(); markPointerAction(); void handleUnlockWithPassword(); }}
                className={`mt-3 ${primaryButtonClass}`}
              >
                {busy ? "Unlocking..." : "Unlock with Password"}
              </Button>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Trust bar */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-white/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          Never share your MPIN, password, or OTP with anyone.
        </div>

        {/* Footer actions */}
        <div className="mt-auto flex items-center justify-center gap-2 pt-6 text-xs font-semibold">
          <button
            onClick={() => navigate("/help-center")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-white/95 backdrop-blur transition hover:bg-white/15"
          >
            <HelpCircle className="h-3.5 w-3.5" /> Help Center
          </button>
          <button
            onClick={() => navigate("/help-center?topic=forgot-mpin")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-white/95 backdrop-blur transition hover:bg-white/15"
          >
            <KeyRound className="h-3.5 w-3.5" /> Forgot MPIN?
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppSecurityGate;
