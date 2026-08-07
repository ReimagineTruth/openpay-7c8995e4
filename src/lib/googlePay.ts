/**
 * Google Pay (Web) → PayMongo google_pay_card token.
 * Docs: https://docs.paymongo.com/docs/payment-acceptance-google-pay
 */
const GOOGLE_PAY_SCRIPT = "https://pay.google.com/gp/p/js/pay.js";

type GooglePaymentsClient = {
  isReadyToPay: (request: unknown) => Promise<{ result: boolean }>;
  loadPaymentData: (request: unknown) => Promise<{
    paymentMethodData?: {
      tokenizationData?: { token?: string };
    };
  }>;
};

declare global {
  interface Window {
    google?: {
      payments?: {
        api?: {
          PaymentsClient: new (opts: { environment: string }) => GooglePaymentsClient;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGooglePayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google Pay requires a browser"));
  if (window.google?.payments?.api) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_PAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Pay")));
      if (window.google?.payments?.api) resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = GOOGLE_PAY_SCRIPT;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Pay"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function getPaymongoPublicKey(): string {
  return String(
    import.meta.env.VITE_PAYMONGO_PUBLIC_KEY ||
      import.meta.env.VITE_PAYMONGO_PK ||
      "",
  ).trim();
}

function paymongoEnvironment(publicKey: string): "TEST" | "PRODUCTION" {
  return publicKey.startsWith("pk_live_") ? "PRODUCTION" : "TEST";
}

function baseCardPaymentMethod(publicKey: string) {
  return {
    type: "CARD",
    parameters: {
      allowedAuthMethods: ["PAN_ONLY"],
      allowedCardNetworks: ["MASTERCARD", "VISA"],
    },
    tokenizationSpecification: {
      type: "PAYMENT_GATEWAY",
      parameters: {
        gateway: "paymongo",
        gatewayMerchantId: publicKey,
      },
    },
  };
}

/**
 * Open the Google Pay sheet and return PayMongo's encrypted token string.
 */
export async function requestGooglePayToken(opts: {
  phpAmount: number;
  merchantName?: string;
  countryCode?: string;
}): Promise<string> {
  const publicKey = getPaymongoPublicKey();
  if (!publicKey) {
    throw new Error("Google Pay is not configured (VITE_PAYMONGO_PUBLIC_KEY)");
  }
  if (!Number.isFinite(opts.phpAmount) || opts.phpAmount <= 0) {
    throw new Error("Invalid Google Pay amount");
  }

  await loadGooglePayScript();
  const PaymentsClient = window.google?.payments?.api?.PaymentsClient;
  if (!PaymentsClient) throw new Error("Google Pay SDK unavailable");

  const environment = paymongoEnvironment(publicKey);
  const client = new PaymentsClient({ environment });

  const merchantId = String(import.meta.env.VITE_GOOGLE_PAY_MERCHANT_ID || "").trim();
  const merchantInfo: Record<string, string> = {
    merchantName: opts.merchantName || "OpenPay",
  };
  // Required for PRODUCTION once your Google Pay Console merchant ID is assigned
  if (merchantId) merchantInfo.merchantId = merchantId;

  const ready = await client.isReadyToPay({
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [baseCardPaymentMethod(publicKey)],
  });
  if (!ready?.result) {
    throw new Error("Google Pay is not available on this device or browser");
  }

  try {
    const paymentData = await client.loadPaymentData({
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [baseCardPaymentMethod(publicKey)],
      transactionInfo: {
        countryCode: opts.countryCode || "PH",
        currencyCode: "PHP",
        totalPriceStatus: "FINAL",
        totalPrice: opts.phpAmount.toFixed(2),
      },
      merchantInfo,
    });

    const token = paymentData?.paymentMethodData?.tokenizationData?.token;
    if (!token) throw new Error("Google Pay did not return a payment token");
    return token;
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: string })?.statusCode;
    if (statusCode === "CANCELED" || statusCode === "CANCELLED") {
      throw new Error("Google Pay cancelled");
    }
    throw err instanceof Error ? err : new Error("Google Pay failed");
  }
}
