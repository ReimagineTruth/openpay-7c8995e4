// Pi OAuth auto sign-in.
// Given a Pi implicit-flow access token, verify it via Pi's /v2/me endpoint,
// look up an existing linked OpenPay account in `pi_accounts.pi_uid`, and if
// one is found, mint a magic-link token so the client can establish a
// Supabase session for that user without a password.
//
// Response shapes:
//   { linked: true,  token_hash, email, profile: { uid, username } }
//   { linked: false, profile: { uid, username } }
//
// The client verifies `token_hash` with `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const accessToken: string | undefined = body?.pi_access_token;
    if (!accessToken || typeof accessToken !== "string") {
      return json({ error: "Missing pi_access_token" }, 400);
    }

    const meUrl = Deno.env.get("PI_OAUTH_ME_URL") || "https://api.minepi.com/v2/me";
    const meRes = await fetch(meUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      const t = await meRes.text();
      console.warn("Pi /me rejected token", meRes.status, t);
      return json({ error: "Pi rejected access token", upstream_status: meRes.status }, 401);
    }
    const me = await meRes.json();
    const uid: string | undefined = me?.uid;
    const username: string | undefined = me?.username;
    if (!uid || !username) return json({ error: "Malformed Pi /me response" }, 502);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Look up existing linked account by Pi UID.
    const { data: linkRow, error: linkErr } = await admin
      .from("pi_accounts")
      .select("user_id")
      .eq("pi_uid", uid)
      .maybeSingle();
    if (linkErr) {
      console.error("pi_accounts lookup error", linkErr);
      return json({ error: "Account lookup failed" }, 500);
    }

    let userId: string | undefined = linkRow?.user_id;

    // Fallback: the Pi Browser sign-in path (pi-platform auth_signin) creates
    // Supabase users with the deterministic email `pi_<uid>@openpay.local` but
    // does not always write a pi_accounts link row. If the OAuth user has an
    // existing OpenPay account created that way, adopt it and backfill the
    // link so future sign-ins are fast.
    if (!userId) {
      const derivedEmail = `pi_${uid}@openpay.local`;
      try {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = list?.users?.find(
          (u: { email?: string | null }) =>
            String(u.email || "").toLowerCase() === derivedEmail.toLowerCase(),
        );
        if (match?.id) {
          userId = match.id;
          await admin
            .from("pi_accounts")
            .upsert(
              {
                user_id: match.id,
                pi_uid: uid,
                pi_username: username,
                linked_via: "oauth_adopted",
                last_authenticated_at: new Date().toISOString(),
              } as never,
              { onConflict: "user_id" },
            );
        }
      } catch (adoptErr) {
        console.warn("pi_accounts adoption lookup failed", adoptErr);
      }
    }

    if (!userId) {
      return json({ linked: false, profile: { uid, username } }, 200);
    }

    // Fetch the linked user's email from auth.users.
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);

    if (userErr || !userRes?.user?.email) {
      console.error("getUserById failed", userErr);
      return json({ error: "Linked account is missing an email" }, 500);
    }
    const email = userRes.user.email;

    // Refresh last_authenticated_at on the link row (best-effort).
    await admin
      .from("pi_accounts")
      .update({
        pi_username: username,
        last_authenticated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    // Mint a magic-link token the client can exchange for a session.
    const { data: linkData, error: genErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (genErr || !linkData?.properties?.hashed_token) {
      console.error("generateLink failed", genErr);
      return json({ error: "Failed to create sign-in token" }, 500);
    }

    return json(
      {
        linked: true,
        token_hash: linkData.properties.hashed_token,
        email,
        profile: { uid, username },
      },
      200,
    );
  } catch (e) {
    console.error("pi-oauth-signin error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
