import { supabase } from "@/integrations/supabase/client";
import { fetchPiUsdPrice } from "@/lib/piPrice";
import { ousdToPi } from "@/lib/ousdPrice";

declare global {
  interface Window {
    Pi?: any;
    __PI_SDK_LOADING__?: boolean;
  }
}

export type PiAuthResult = {
  accessToken?: string;
  user?: { uid?: string; username?: string };
};

function resolveSandbox(): boolean {
  const envSandbox = String(import.meta.env.VITE_PI_SANDBOX || "").trim().toLowerCase();
  if (envSandbox === "true") return true;
  if (envSandbox === "false") return false;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname || "";
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host.endsWith(".test")
  );
}

/** Wait until the Pi SDK script has attached `window.Pi`. */
export function waitForPiSdk(timeoutMs = 12000): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Pi SDK unavailable"));
  }
  if (window.Pi && typeof window.Pi.authenticate === "function") {
    return Promise.resolve(window.Pi);
  }

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const onReady = () => {
      if (window.Pi && typeof window.Pi.authenticate === "function") {
        cleanup();
        resolve(window.Pi);
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error("Pi SDK failed to load. Open this page in Pi Browser."));
    };
    const tick = window.setInterval(() => {
      if (window.Pi && typeof window.Pi.authenticate === "function") {
        cleanup();
        resolve(window.Pi);
        return;
      }
      if (Date.now() - started > timeoutMs) {
        cleanup();
        reject(new Error("Pi SDK timed out. Reopen in Pi Browser and try again."));
      }
    }, 200);

    const cleanup = () => {
      window.clearInterval(tick);
      window.removeEventListener("pi-sdk-ready", onReady);
      window.removeEventListener("pi-sdk-error", onError);
    };

    window.addEventListener("pi-sdk-ready", onReady);
    window.addEventListener("pi-sdk-error", onError);
  });
}

export function initPiSdk(Pi: any = typeof window !== "undefined" ? window.Pi : null) {
  if (!Pi || typeof Pi.init !== "function") {
    throw new Error("Pi SDK not available. Open this page in Pi Browser.");
  }
  Pi.init({ version: "2.0", sandbox: resolveSandbox() });
  return Pi;
}

async function completeIncompletePiPayment(incomplete: any) {
  try {
    if (incomplete?.identifier && incomplete?.transaction?.txid) {
      await supabase.functions.invoke("pi-platform", {
        body: {
          action: "complete",
          paymentId: incomplete.identifier,
          txid: incomplete.transaction.txid,
        },
      });
    }
  } catch {
    // Best-effort — don't block a fresh payment if incomplete cleanup fails
  }
}

/**
 * Must run before createPayment. Opens the Pi Auth consent sheet
 * with the payments scope inside Pi Browser.
 */
export async function authenticatePiForPayments(timeoutMs = 90000): Promise<PiAuthResult> {
  const Pi = initPiSdk(await waitForPiSdk());

  const authPromise = Pi.authenticate(
    ["username", "payments"],
    async (incomplete: any) => {
      await completeIncompletePiPayment(incomplete);
    },
  ) as Promise<PiAuthResult>;

  const timed = new Promise<never>((_, reject) => {
    window.setTimeout(
      () => reject(new Error("Pi sign-in timed out. Approve Pi Auth and try again.")),
      timeoutMs,
    );
  });

  const auth = await Promise.race([authPromise, timed]);
  if (!auth?.user?.uid && !auth?.accessToken) {
    throw new Error("Pi sign-in required before payment");
  }
  return auth;
}

/** Convert checkout amount into Pi units for Pi.createPayment. */
export async function resolvePiPaymentAmount(amount: number, currency: string): Promise<number> {
  const code = (currency || "").toUpperCase();
  if (!(amount > 0)) throw new Error("Enter a valid amount");

  if (code === "PI" || code === "π") {
    return Math.round(amount * 1e6) / 1e6;
  }

  // OUSD is $1 pegged; other codes treated as USD-like for Pi conversion
  const piUsd = await fetchPiUsdPrice();
  const piAmount = ousdToPi(amount, piUsd.price);
  if (!(piAmount > 0)) {
    throw new Error("Pi price unavailable. Try again in a moment.");
  }
  return piAmount;
}
