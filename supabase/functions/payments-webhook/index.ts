import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const userId = session.metadata?.userId;
  const purpose = session.metadata?.purpose;
  if (!userId || purpose !== "ousd_topup") {
    console.log("Ignoring session without ousd_topup metadata", session.id);
    return;
  }
  // Use the actual amount paid (cents → USD) rather than trusting metadata.
  const amountPaid = (session.amount_total ?? 0) / 100;
  if (amountPaid <= 0) {
    console.error("Session has no amount_total", session.id);
    return;
  }

  const { error } = await getSupabase().rpc("credit_stripe_topup", {
    p_session_id: session.id,
    p_user_id: userId,
    p_amount: amountPaid,
    p_environment: env,
  });
  if (error) {
    console.error("credit_stripe_topup failed", error);
    throw error;
  }
  console.log(`Credited ${amountPaid} OUSD to user ${userId} (session ${session.id})`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook bad env param:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
