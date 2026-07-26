/** OpenPay Auth Sign In — helpers for third-party OAuth 2.0 Authorization Code flow. */

export const OPENPAY_AUTH_SCOPES = ["profile", "balance", "email"] as const;
export type OpenPayAuthScope = (typeof OPENPAY_AUTH_SCOPES)[number];

export const OPENPAY_AUTH_SITE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
  "https://openpy.space";

export const OPENPAY_AUTH_API_BASE = `${
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "https://araojncyittkahvvpdrn.supabase.co"
}/functions/v1/partner-transfer-api`;

export const OPENPAY_AUTH_DOCS_PATH = "/openpay-auth";

export function getOpenPayAuthSite(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return OPENPAY_AUTH_SITE;
}

export type BuildAuthorizeUrlArgs = {
  clientId: string;
  redirectUri: string;
  scope?: string | string[];
  state?: string;
  /** Defaults to current origin `/connect` or production site. */
  authorizeBase?: string;
};

/** Build the OpenPay Auth authorize URL (also available as /oauth/authorize). */
export function buildOpenPayAuthorizeUrl(args: BuildAuthorizeUrlArgs): string {
  const site = args.authorizeBase || `${getOpenPayAuthSite()}/connect`;
  const scope = Array.isArray(args.scope)
    ? args.scope.join(" ")
    : args.scope || "profile";
  const url = new URL(site.startsWith("http") ? site : `${getOpenPayAuthSite()}${site}`);
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  if (args.state) url.searchParams.set("state", args.state);
  return url.toString();
}

export function createOpenPayAuthState(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i += 1) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const OPENPAY_AUTH_SCOPE_META: Record<
  string,
  { label: string; description: string }
> = {
  profile: {
    label: "Profile",
    description: "Name, @username, avatar, and OpenPay account number",
  },
  balance: {
    label: "Balance",
    description: "Read-only OUSD wallet balance",
  },
  email: {
    label: "Email",
    description: "Account email address (if available)",
  },
};
