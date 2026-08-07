import { supabase } from "@/integrations/supabase/client";

export type QrPayPlatformSettings = {
  maintenance_mode: boolean;
  maintenance_message: string;
  allow_pi: boolean;
  allow_wallet: boolean;
  allow_virtual_card: boolean;
  allow_moonpay: boolean;
  allow_google_pay: boolean;
  allow_apple_pay: boolean;
  allow_paypal: boolean;
  allow_qr_ph: boolean;
  allow_gcash: boolean;
  allow_maya: boolean;
  allow_grab_pay: boolean;
  allow_shopee_pay: boolean;
  allow_billease: boolean;
  allow_bank: boolean;
  allow_guest: boolean;
  allow_pro: boolean;
  updated_at?: string;
};

const DEFAULTS: QrPayPlatformSettings = {
  maintenance_mode: false,
  maintenance_message: "QR Pay is temporarily under maintenance. Please try again later.",
  allow_pi: true,
  allow_wallet: true,
  allow_virtual_card: true,
  allow_moonpay: true,
  allow_google_pay: true,
  allow_apple_pay: true,
  allow_paypal: true,
  allow_qr_ph: true,
  allow_gcash: true,
  allow_maya: true,
  allow_grab_pay: true,
  allow_shopee_pay: true,
  allow_billease: true,
  allow_bank: true,
  allow_guest: true,
  allow_pro: true,
};

let cached: { at: number; data: QrPayPlatformSettings } | null = null;
const CACHE_MS = 15_000;

export async function fetchQrPayPlatformSettings(force = false): Promise<QrPayPlatformSettings> {
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  try {
    const { data, error } = await (supabase as any).rpc("qr_pay_get_platform_settings");
    if (error || !data) {
      cached = { at: Date.now(), data: DEFAULTS };
      return DEFAULTS;
    }
    const merged = { ...DEFAULTS, ...data };
    cached = { at: Date.now(), data: merged };
    return merged;
  } catch {
    cached = { at: Date.now(), data: DEFAULTS };
    return DEFAULTS;
  }
}

/** Platform AND per-link must both allow the method. */
export function isQrPayMethodPlatformEnabled(
  settings: QrPayPlatformSettings | null | undefined,
  method: string,
): boolean {
  if (!settings) return true;
  if (settings.maintenance_mode) return false;
  const m = String(method || "").toLowerCase();
  if (m === "pi") return settings.allow_pi;
  if (m === "wallet") return settings.allow_wallet;
  if (m === "card" || m === "virtual_card") return settings.allow_virtual_card;
  if (m === "moonpay") return settings.allow_moonpay;
  if (m === "google_pay") return settings.allow_google_pay;
  if (m === "apple_pay") return settings.allow_apple_pay;
  if (m === "paypal") return settings.allow_paypal;
  if (m === "qr_ph" || m === "qrph") return settings.allow_qr_ph;
  if (m === "gcash") return settings.allow_gcash;
  if (m === "maya" || m === "paymaya") return settings.allow_maya;
  if (m === "grab_pay" || m === "grabpay") return settings.allow_grab_pay;
  if (m === "shopee_pay" || m === "shopeepay") return settings.allow_shopee_pay;
  if (m === "billease") return settings.allow_billease;
  if (m === "bank") return settings.allow_bank;
  if (m === "guest") return settings.allow_guest;
  if (m === "pro") return settings.allow_pro;
  return true;
}

export { DEFAULTS as QR_PAY_PLATFORM_DEFAULTS };
