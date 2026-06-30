/**
 * Pi Network OAuth (implicit flow) — isolated module.
 *
 * This is a NEW feature, completely separate from the existing Pi SDK
 * `Pi.authenticate()` flow in `PiAuthPage.tsx` and from email/password auth.
 *
 * Reference: https://github.com/pi-apps/pi-platform-docs/blob/master/pi-sign-in.md
 *
 * Flow:
 *   1. Redirect the user to Pi's authorize endpoint with `response_type=token`.
 *   2. Pi redirects back to `redirect_uri#access_token=...&token_type=Bearer&expires_in=...`.
 *   3. We parse the URL fragment, call `/v2/me` to fetch { uid, username }.
 *   4. We persist the link in `public.pi_accounts` for the currently signed-in
 *      Lovable Cloud user. If no Lovable Cloud session exists yet, we stash the
 *      Pi profile in sessionStorage so the user can complete account linking
 *      after email/password sign-in or sign-up.
 *
 * Notes:
 *   - SPA cannot set HTTP-only cookies. The Lovable Cloud session JWT (already
 *     used by the rest of the app) remains the source of truth for the user.
 *     The Pi OAuth access token is short-lived and never written to storage.
 *   - The feature can be disabled at any time via `VITE_ENABLE_PI_OAUTH=false`
 *     without affecting any other auth method.
 */

export const PI_OAUTH_CONFIG = {
  enabled: (import.meta.env.VITE_ENABLE_PI_OAUTH ?? "true") !== "false",
  clientId:
    import.meta.env.VITE_PI_OAUTH_CLIENT_ID ??
    "sLjpGeQVXc-fSGwaOC5Y84ItLtPqKf829ZHMaF2iUD",
  redirectUri:
    import.meta.env.VITE_PI_OAUTH_REDIRECT_URI ??
    "https://openpy.space/auth/pi/callback",
  authorizeUrl:
    import.meta.env.VITE_PI_OAUTH_AUTHORIZE_URL ??
    "https://accounts.pinet.com/oauth/authorize",
  meUrl:
    import.meta.env.VITE_PI_OAUTH_ME_URL ??
    "https://api.minepi.com/v2/me",
  scopes: ["username"] as const,
};

const STATE_KEY = "pi_oauth_state";
const PENDING_LINK_KEY = "pi_oauth_pending_profile";

export type PiOAuthProfile = {
  uid: string;
  username: string;
  accessToken: string;
  expiresAt: number; // epoch ms
};

export function isPiOAuthEnabled(): boolean {
  return PI_OAUTH_CONFIG.enabled;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build the Pi authorize URL and redirect the browser to it. */
export function beginPiOAuth(): void {
  if (!isPiOAuthEnabled()) {
    throw new Error("Pi OAuth is disabled (VITE_ENABLE_PI_OAUTH=false)");
  }
  const state = randomState();
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "token",
    client_id: PI_OAUTH_CONFIG.clientId,
    redirect_uri: PI_OAUTH_CONFIG.redirectUri,
    scope: PI_OAUTH_CONFIG.scopes.join(" "),
    state,
  });

  window.location.assign(`${PI_OAUTH_CONFIG.authorizeUrl}?${params.toString()}`);
}

/** Parse `#access_token=...&state=...&expires_in=...` from a URL hash. */
export function parsePiCallbackHash(hash: string): {
  accessToken: string;
  state: string;
  expiresIn: number;
  error?: string;
  errorDescription?: string;
} {
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(cleaned);
  return {
    accessToken: params.get("access_token") ?? "",
    state: params.get("state") ?? "",
    expiresIn: Number(params.get("expires_in") ?? "0"),
    error: params.get("error") ?? undefined,
    errorDescription: params.get("error_description") ?? undefined,
  };
}

/** Verify the state we stored before redirect matches what came back. */
export function verifyPiOAuthState(returnedState: string): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return Boolean(expected) && expected === returnedState;
}

/** Fetch the Pi profile (uid, username) using the access token. */
export async function fetchPiUser(accessToken: string): Promise<{
  uid: string;
  username: string;
}> {
  const res = await fetch(PI_OAUTH_CONFIG.meUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Pi /me request failed: ${res.status}`);
  }
  const body = await res.json();
  // Pi returns either { uid, username } or { user: { uid, username } }
  // depending on the endpoint version. Handle both.
  const user = body?.user ?? body;
  if (!user?.uid || !user?.username) {
    throw new Error("Pi profile missing uid/username");
  }
  return { uid: String(user.uid), username: String(user.username) };
}

export function stashPendingPiProfile(profile: PiOAuthProfile): void {
  sessionStorage.setItem(PENDING_LINK_KEY, JSON.stringify(profile));
}

export function readPendingPiProfile(): PiOAuthProfile | null {
  const raw = sessionStorage.getItem(PENDING_LINK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PiOAuthProfile;
  } catch {
    return null;
  }
}

export function clearPendingPiProfile(): void {
  sessionStorage.removeItem(PENDING_LINK_KEY);
}
