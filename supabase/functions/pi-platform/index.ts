import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const parseJson = (raw: string) => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
};

const buildPiCredentials = (uid: string) => ({
  email: `pi_${uid}@openpay.local`,
  password: `OpenPay-Pi-${uid}-v1!`,
});

const cleanUsername = (uid: string, username?: string | null) => {
  const clean = String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return clean.length >= 3 ? clean : `pi_${uid.replace(/-/g, "").slice(0, 16)}`;
};

const verifyPiAccessToken = async (accessToken: string) => {
  const piResponse = await fetch("https://api.minepi.com/v2/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = parseJson(await piResponse.text());
  if (!piResponse.ok) {
    console.error("Pi auth verification failed", piResponse.status, data);
    throw new Error(`Pi auth verification failed (${piResponse.status})`);
  }

  const uid = typeof data.uid === "string" ? data.uid : null;
  const username = typeof data.username === "string" ? data.username : "";
  if (!uid) throw new Error("Pi auth response missing uid");

  return { uid, username };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, paymentId, txid, accessToken, adId, referralCode } = await req.json();
    if (!action || typeof action !== "string") {
      return jsonResponse({ error: "Missing action" }, 400);
    }

    // auth_verify does NOT require a Supabase session — the user is logging in
    if (action === "auth_verify") {
      if (!accessToken || typeof accessToken !== "string") {
        return jsonResponse({ error: "Missing accessToken" }, 400);
      }

      try {
        const data = await verifyPiAccessToken(accessToken);
        return jsonResponse({ success: true, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pi auth verification failed";
        return jsonResponse({ error: message }, 400);
      }
    }

    // Verifies Pi auth and creates/confirms the matching OpenPay auth user.
    // This keeps Pi Auth working even when public email sign-ups require confirmation.
    if (action === "auth_prepare_user") {
      if (!accessToken || typeof accessToken !== "string") {
        return jsonResponse({ error: "Missing accessToken" }, 400);
      }

      const verified = await verifyPiAccessToken(accessToken);
      const { email, password } = buildPiCredentials(verified.uid);
      const username = cleanUsername(verified.uid, verified.username);
      const fullName = verified.username || username;
      const metadata = {
        full_name: fullName,
        username,
        referral_code: typeof referralCode === "string" ? referralCode : undefined,
        pi_uid: verified.uid,
        pi_username: fullName,
        pi_connected_at: new Date().toISOString(),
      };

      const created = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      let userId = created.data?.user?.id || null;
      if (created.error) {
        const message = String(created.error.message || "").toLowerCase();
        const alreadyExists = message.includes("already") || message.includes("registered") || message.includes("exists");
        if (!alreadyExists) {
          return jsonResponse({ error: created.error.message || "Failed to prepare Pi account" }, 400);
        }

        const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId = listed.data?.users?.find((u: { email?: string; id?: string }) => String(u.email || "").toLowerCase() === email.toLowerCase())?.id || null;
        if (userId) {
          await supabase.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: metadata,
          });
        }
      }

      if (userId) {
        await supabase.rpc("create_complete_user_profile", {
          p_user_id: userId,
          p_full_name: fullName,
          p_username: username,
          p_email: email,
          p_referral_code: typeof referralCode === "string" ? referralCode : null,
          p_pi_uid: verified.uid,
          p_pi_username: fullName,
        }).catch(() => null);
      }

      return jsonResponse({ success: true, data: { uid: verified.uid, username, email } });
    }

    // All other actions require a valid Supabase session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Missing auth token" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const authResult = await supabase.auth.getUser(token);
    const user = authResult?.data?.user;
    if (authResult?.error || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("PI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "PI_API_KEY is not configured" }, 500);

    if (action === "ad_verify") {
      if (!adId || typeof adId !== "string") {
        return jsonResponse({ error: "Missing adId" }, 400);
      }

      const piResponse = await fetch(`https://api.minepi.com/v2/ads_network/status/${adId}`, {
        method: "GET",
        headers: { Authorization: `Key ${apiKey}` },
      });

      const data = parseJson(await piResponse.text());
      if (!piResponse.ok) {
        return jsonResponse({ error: "Pi ad verification failed", status: piResponse.status, data }, 400);
      }

      const mediatorAckStatus =
        typeof data.mediator_ack_status === "string" ? data.mediator_ack_status : null;
      const rewarded = mediatorAckStatus === "granted";

      return jsonResponse({ success: true, rewarded, data });
    }

    if (!paymentId || typeof paymentId !== "string") {
      return jsonResponse({ error: "Missing paymentId" }, 400);
    }

    const endpointBase = `https://api.minepi.com/v2/payments/${paymentId}`;
    let endpoint = endpointBase;
    let method: "GET" | "POST" = "POST";
    let body: Record<string, unknown> | undefined;

    if (action === "approve" || action === "payment_approve") {
      endpoint = `${endpointBase}/approve`;
    } else if (action === "complete" || action === "payment_complete") {
      endpoint = `${endpointBase}/complete`;
      if (txid && typeof txid === "string") body = { txid };
    } else if (action === "cancel" || action === "payment_cancel") {
      endpoint = `${endpointBase}/cancel`;
    } else if (action === "get" || action === "payment_get") {
      endpoint = endpointBase;
      method = "GET";
    } else {
      return jsonResponse({ error: "Invalid action" }, 400);
    }

    const piResponse = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = parseJson(await piResponse.text());
    if (!piResponse.ok) {
      return jsonResponse({ error: "Pi payment API call failed", status: piResponse.status, data }, 400);
    }

    return jsonResponse({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 500);
  }
});
