/**
 * PayMongo webhook — confirm QR Pay when payment.paid fires.
 *
 * Configure in PayMongo Dashboard → Webhooks:
 *   URL: https://<project>.supabase.co/functions/v1/paymongo-webhook
 *   Events: payment.paid, payment.failed, payment_intent.succeeded
 *
 * Optional secret verification:
 *   PAYMONGO_WEBHOOK_SECRET=...
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getPaymongoKeys, json, paymongoFetch } from "../_shared/paymongo.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));
    const eventType = String(payload?.data?.attributes?.type || payload?.type || "");
    const resource = payload?.data?.attributes?.data || payload?.data || {};
    const resourceType = String(resource?.type || "");
    const attrs = resource?.attributes || {};

    // Accept payment.paid / payment_intent.succeeded style events
    const isPaid =
      /payment\.paid/i.test(eventType) ||
      (/succeeded/i.test(String(attrs.status || "")) && /payment_intent/i.test(resourceType));

    if (!isPaid) {
      return json({ ok: true, ignored: eventType || "unknown" });
    }

    let intentId =
      attrs.payment_intent_id ||
      (resourceType === "payment_intent" ? resource.id : null) ||
      null;

    // If webhook is payment resource, resolve intent id from payment
    if (!intentId && resourceType === "payment" && resource.id) {
      try {
        const { secret } = getPaymongoKeys();
        const payRes = await paymongoFetch(`/payments/${resource.id}`, { key: secret });
        intentId = payRes?.data?.attributes?.payment_intent_id || null;
      } catch (e) {
        console.warn("paymongo-webhook resolve intent:", e);
      }
    }

    if (!intentId) {
      // Fall back to metadata on the event resource
      intentId = attrs.metadata?.paymongo_intent_id || null;
    }

    const meta = attrs.metadata || {};
    let token = String(meta.qr_token || "").trim();
    let method = String(meta.qr_method || "").trim() || "qr_ph";
    let pending: Record<string, unknown> = {};

    if (!token && intentId) {
      const { data: rows } = await supabase
        .from("qr_payments")
        .select("token, metadata")
        .eq("status", "active")
        .contains("metadata", { paymongo_pending: { intent_id: intentId } })
        .limit(5);
      // PostgREST contains may not match nested well — scan active with pending
      if (!rows?.length) {
        const { data: active } = await supabase
          .from("qr_payments")
          .select("token, metadata")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(50);
        const hit = (active || []).find((r: any) => r?.metadata?.paymongo_pending?.intent_id === intentId);
        if (hit) {
          token = hit.token;
          pending = hit.metadata?.paymongo_pending || {};
          method = String(pending.method || method);
        }
      } else {
        token = rows[0].token;
        pending = rows[0].metadata?.paymongo_pending || {};
        method = String(pending.method || method);
      }
    }

    if (!token || !intentId) {
      console.warn("paymongo-webhook missing token/intent", { eventType, intentId, token });
      return json({ ok: true, skipped: "missing_token_or_intent" });
    }

    // Load pending payer info from payment metadata
    if (!Object.keys(pending).length) {
      const { data: pay } = await supabase
        .from("qr_payments")
        .select("metadata")
        .eq("token", token)
        .maybeSingle();
      pending = pay?.metadata?.paymongo_pending || {};
      if (pending.method) method = String(pending.method);
    }

    const paymentId = resourceType === "payment" ? resource.id : (attrs.payments?.[0]?.id || null);

    const normalizedMethod =
      method === "gcash" || method === "billease" || method === "bank" || method === "qr_ph"
        ? method
        : "qr_ph";

    const { data: completed, error } = await supabase.rpc("qr_pay_complete_paymongo", {
      p_token: token,
      p_method: normalizedMethod,
      p_paymongo_intent_id: String(intentId),
      p_paymongo_payment_id: paymentId ? String(paymentId) : null,
      p_payer_name: pending.payer_name || null,
      p_payer_email: pending.payer_email || null,
      p_amount: pending.amount != null ? Number(pending.amount) : null,
      p_payer_phone: pending.payer_phone || null,
      p_delivery_address: pending.delivery_address || null,
      p_delivery_notes: pending.delivery_notes || null,
      p_payer_user_id: pending.payer_user_id || null,
    });

    if (error) {
      console.error("paymongo-webhook complete:", error.message);
      return json({ ok: false, error: error.message }, 400);
    }

    return json({
      ok: true,
      transaction_ref: completed?.transaction_ref,
      already: !!completed?.already,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("paymongo-webhook:", message);
    return json({ error: message }, 400);
  }
});
