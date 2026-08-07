/**
 * PayMongo QR Pay — QR PH, GCash, BillEase BNPL, Online Banking.
 *
 * Docs:
 *   https://docs.paymongo.com/docs/payment-acceptance-qr-ph-api
 *   https://docs.paymongo.com/docs/payment-acceptance-e-wallets
 *   https://docs.paymongo.com/docs/payment-acceptance-bnpl
 *   https://docs.paymongo.com/docs/payment-acceptance-direct-online-banking
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getPaymongoKeys,
  json,
  paymongoFetch,
  resolvePaymongoMethod,
  toPhpCentavos,
  type PaymongoMethod,
} from "../_shared/paymongo.ts";

const ALLOWED: PaymongoMethod[] = ["qr_ph", "gcash", "billease", "bank"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "create").toLowerCase();
    const { secret } = getPaymongoKeys();

    let payerUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: auth } = await supabase.auth.getUser(token);
      payerUserId = auth?.user?.id || null;
    }

    if (action === "status" || action === "confirm") {
      const intentId = String(body?.intent_id || "").trim();
      const token = String(body?.token || "").trim();
      if (!intentId || !token) return json({ error: "token and intent_id required" }, 400);

      const intentRes = await paymongoFetch(`/payment_intents/${intentId}`, { key: secret });
      const attrs = intentRes?.data?.attributes || {};
      const status = String(attrs.status || "");
      const method = String(body?.method || attrs.metadata?.qr_method || "qr_ph") as PaymongoMethod;

      if (status !== "succeeded") {
        return json({ status, intent_id: intentId, paid: false });
      }

      const paymentId = attrs.payments?.[0]?.id || attrs.payments?.[0] || null;

      const { data: completed, error: completeErr } = await supabase.rpc("qr_pay_complete_paymongo", {
        p_token: token,
        p_method: method,
        p_paymongo_intent_id: intentId,
        p_paymongo_payment_id: paymentId ? String(paymentId) : null,
        p_payer_name: body?.payer_name || null,
        p_payer_email: body?.payer_email || null,
        p_amount: body?.amount != null ? Number(body.amount) : null,
        p_payer_phone: body?.payer_phone || null,
        p_delivery_address: body?.delivery_address || null,
        p_delivery_notes: body?.delivery_notes || null,
        p_payer_user_id: payerUserId,
      });

      if (completeErr) {
        if (/already|duplicate|unique/i.test(completeErr.message || "")) {
          return json({ status: "succeeded", paid: true, already: true });
        }
        throw new Error(completeErr.message || "Failed to complete QR payment");
      }

      return json({
        status: "succeeded",
        paid: true,
        transaction_ref: completed?.transaction_ref,
        amount: completed?.amount,
        method: completed?.method || method,
      });
    }

    // ── create ──────────────────────────────────────────────
    const token = String(body?.token || "").trim();
    const method = String(body?.method || "").trim() as PaymongoMethod;
    const bankCode = body?.bank_code ? String(body.bank_code).trim().toLowerCase() : null;
    if (!token) return json({ error: "token required" }, 400);
    if (!ALLOWED.includes(method)) {
      return json({ error: "method must be qr_ph, gcash, billease, or bank" }, 400);
    }

    const resolved = resolvePaymongoMethod(method, bankCode);

    const { data: pay, error: payErr } = await supabase
      .from("qr_payments")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (payErr || !pay) return json({ error: "Payment not found" }, 404);
    if (pay.status !== "active") return json({ error: "Payment is not active" }, 400);

    const meta = (pay.metadata && typeof pay.metadata === "object") ? pay.metadata : {};
    if (!meta[resolved.allowMetaKey]) {
      return json({ error: `${method} is not enabled for this checkout` }, 400);
    }

    if (payerUserId && pay.merchant_user_id === payerUserId) {
      return json({ error: "cannot_pay_self" }, 400);
    }

    const chargeAmount = (() => {
      const custom = body?.amount != null ? Number(body.amount) : NaN;
      if (pay.allow_custom_amount || ["donation", "tip"].includes(String(pay.payment_type))) {
        if (!Number.isFinite(custom) || custom <= 0) throw new Error("Enter a valid amount");
        if (pay.min_amount && custom < Number(pay.min_amount)) {
          throw new Error(`Minimum ${pay.currency} ${Number(pay.min_amount).toFixed(2)}`);
        }
        return custom;
      }
      return Number(pay.total);
    })();

    const { php, centavos, rate } = toPhpCentavos(chargeAmount, pay.currency, resolved.minPhp);
    if (php < resolved.minPhp) {
      return json({
        error: `Minimum for this method is ₱${resolved.minPhp.toFixed(2)} (got ₱${php.toFixed(2)})`,
      }, 400);
    }

    const returnUrl = String(body?.return_url || "").trim();
    if (resolved.needsReturnUrl && !returnUrl.startsWith("http")) {
      return json({ error: "return_url required for this payment method" }, 400);
    }

    const intentRes = await paymongoFetch("/payment_intents", {
      key: secret,
      method: "POST",
      body: {
        data: {
          attributes: {
            amount: centavos,
            currency: "PHP",
            payment_method_allowed: resolved.allowed,
            description: `OpenPay QR · ${pay.title || pay.token}`.slice(0, 255),
            statement_descriptor: "OpenPay",
            metadata: {
              qr_token: pay.token,
              qr_payment_id: pay.id,
              qr_method: method,
              bank_code: bankCode || "",
              openpay_amount: String(chargeAmount),
              openpay_currency: String(pay.currency),
              php_amount: String(php),
              php_rate: String(rate),
            },
          },
        },
      },
    });

    const intentId = intentRes?.data?.id as string;
    const clientKey = intentRes?.data?.attributes?.client_key as string;
    if (!intentId) throw new Error("PayMongo did not return a payment intent");

    const billing: Record<string, string> = {};
    if (body?.payer_name) billing.name = String(body.payer_name);
    if (body?.payer_email) billing.email = String(body.payer_email);
    if (body?.payer_phone) billing.phone = String(body.payer_phone);

    const pmAttrs: Record<string, unknown> = {
      type: resolved.pmType,
      ...(Object.keys(billing).length ? { billing } : {}),
    };
    if (resolved.details) pmAttrs.details = resolved.details;

    const pmRes = await paymongoFetch("/payment_methods", {
      key: secret,
      method: "POST",
      body: { data: { attributes: pmAttrs } },
    });
    const paymentMethodId = pmRes?.data?.id as string;
    if (!paymentMethodId) throw new Error("PayMongo did not return a payment method");

    const attachAttrs: Record<string, unknown> = {
      payment_method: paymentMethodId,
      client_key: clientKey,
    };
    if (resolved.needsReturnUrl) attachAttrs.return_url = returnUrl;

    const attachRes = await paymongoFetch(`/payment_intents/${intentId}/attach`, {
      key: secret,
      method: "POST",
      body: { data: { attributes: attachAttrs } },
    });

    const attachAttrsOut = attachRes?.data?.attributes || {};
    const next = attachAttrsOut.next_action || {};
    const qrImageUrl = next?.code?.image_url || null;
    const redirectUrl = next?.redirect?.url || null;

    await supabase
      .from("qr_payments")
      .update({
        metadata: {
          ...meta,
          paymongo_pending: {
            intent_id: intentId,
            method,
            bank_code: bankCode,
            amount: chargeAmount,
            php_amount: php,
            created_at: new Date().toISOString(),
            payer_name: body?.payer_name || null,
            payer_email: body?.payer_email || null,
            payer_phone: body?.payer_phone || null,
            delivery_address: body?.delivery_address || null,
            delivery_notes: body?.delivery_notes || null,
            payer_user_id: payerUserId,
          },
        },
      })
      .eq("id", pay.id);

    return json({
      intent_id: intentId,
      client_key: clientKey,
      status: attachAttrsOut.status || "awaiting_next_action",
      method,
      bank_code: bankCode,
      amount: chargeAmount,
      currency: pay.currency,
      php_amount: php,
      php_rate: rate,
      qr_image_url: qrImageUrl,
      redirect_url: redirectUrl,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("paymongo-qr-pay:", message);
    return json({ error: message }, 400);
  }
});
