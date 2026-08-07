import { supabase } from "@/integrations/supabase/client";

type PaymongoBody = Record<string, unknown>;

/**
 * Call PayMongo QR Pay bridge.
 * Prefers local Vite middleware in development (Edge Function may be undeployed),
 * then falls back to Supabase Edge Function.
 */
export async function invokePaymongoQrPay(body: PaymongoBody): Promise<any> {
  const tryLocal = async () => {
    const res = await fetch("/api/paymongo-qr-pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      throw new Error(data?.error || `Local PayMongo bridge failed (${res.status})`);
    }
    return data;
  };

  // Dev: use local bridge first (function is often not deployed yet)
  if (import.meta.env.DEV) {
    try {
      return await tryLocal();
    } catch (localErr) {
      // Fall through to edge function
      console.warn("Local PayMongo bridge failed, trying Edge Function:", localErr);
    }
  }

  const { data, error } = await supabase.functions.invoke("paymongo-qr-pay", { body });
  if (error) {
    // Last resort: local bridge even outside DEV detection
    try {
      return await tryLocal();
    } catch {
      throw new Error(error.message || "Failed to reach PayMongo function");
    }
  }
  if (data?.error) throw new Error(String(data.error));
  return data;
}
