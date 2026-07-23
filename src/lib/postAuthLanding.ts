/** Default home after auth / app open. */
export const POST_AUTH_HOME = "/dashboard";

const AUTH_LANDING_PATHS = new Set([
  "/",
  "/auth",
  "/sign-in",
  "/signin",
  "/signup",
  "/auth/callback",
  "/auth/phantom/callback",
  "/auth/pi/login",
  "/auth/pi/callback",
  "/admin-mrwain",
  "/forgot-password",
  "/forgot-mpin",
  "/reset-password",
  "/two-factor",
  "/two-factor-verify",
]);

/**
 * Paths that may open directly (deep links / public flows).
 * Everything else is treated as an in-app feature and should not resume on cold start.
 */
export const isAllowedDirectOpenPath = (pathname: string): boolean => {
  const path = (pathname || "/").split("?")[0] || "/";

  if (path === POST_AUTH_HOME) return true;
  if (path === "/setup-profile" || path === "/onboarding") return true;
  if (path === "/confirm-pin") return true;
  if (AUTH_LANDING_PATHS.has(path)) return true;

  const prefixes = [
    "/pay/",
    "/public-payment",
    "/app-payment",
    "/app-pay-approve/",
    "/buttons/",
    "/payment-link",
    "/payment-links",
    "/qr-pay/",
    "/pos/",
    "/u/",
    "/@",
    "/ledger",
    "/openledger",
    "/terms",
    "/privacy",
    "/about-openpay",
    "/legal",
    "/help-center",
    "/help-wiki",
    "/download",
    "/openpay-desktop",
    "/pitch-deck",
    "/openpay-official",
  ];

  return prefixes.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix));
};

export const isAuthLandingPath = (pathname: string): boolean => {
  const path = (pathname || "/").split("?")[0] || "/";
  return AUTH_LANDING_PATHS.has(path);
};

const BOOT_KEY = "openpay:session-boot:v1";
const HIDDEN_AT_KEY = "openpay:app-hidden-at:v1";
const RESUME_IDLE_MS = 15 * 60 * 1000; // reopen after 15m background → dashboard

/** Returns true once per browser tab session (first app open / reload). */
export const claimAppBootRedirect = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(BOOT_KEY) === "1") return false;
    window.sessionStorage.setItem(BOOT_KEY, "1");
    return true;
  } catch {
    return true;
  }
};

/** Call when app becomes visible again; returns true if idle long enough to home to dashboard. */
export const shouldHomeOnResume = (): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    if (document.visibilityState !== "visible") {
      window.sessionStorage.setItem(HIDDEN_AT_KEY, String(Date.now()));
      return false;
    }
    const raw = window.sessionStorage.getItem(HIDDEN_AT_KEY);
    window.sessionStorage.removeItem(HIDDEN_AT_KEY);
    if (!raw) return false;
    const hiddenAt = Number(raw);
    if (!Number.isFinite(hiddenAt) || hiddenAt <= 0) return false;
    return Date.now() - hiddenAt >= RESUME_IDLE_MS;
  } catch {
    return false;
  }
};
