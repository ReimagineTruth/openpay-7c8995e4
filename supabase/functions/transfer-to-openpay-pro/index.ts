import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_PARTNER_USERNAME = "wainfoundation";
const DEFAULT_INBOUND_URL = "https://openpaypromainnet.lovable.app/api/public/openpay/inbound";

const normalizeProTarget = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (/^uid_[a-f0-9-]+$/i.test(cleaned)) return cleaned;
  return cleaned.replace(/^@+/, "").toLowerCase();
};

const buildProXferNote = (toRaw: string, ref: string) => {
  const to = normalizeProTarget(toRaw);
  const target = to.startsWith("uid_") ? to : `@${to}`;
  return `pro_xfer:${target}:${ref}`;
};

const parseProXferNote = (note: string) => {
  const match = String(note || "")
    .trim()
    .match(/^pro_xfer:(@?[A-Za-z0-9_]+|uid_[a-f0-9-]+):([A-Za-z0-9_-]+)/i);
  if (!match) return null;
  return { to: match[1], ref: match[2] };
};

const makeRef = () => `r_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const jsonResponse = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server configuration error");

    const inboundUrl = (Deno.env.get("OPENPAY_PRO_INBOUND_URL") || DEFAULT_INBOUND_URL).trim();
    const partnerApiKey = (Deno.env.get("OPENPAY_PRO_PARTNER_API_KEY") || Deno.env.get("OPENPAY_PRO_API_KEY") || "").trim();
    const partnerUsername = (
      Deno.env.get("OPENPAY_PRO_PARTNER_USERNAME") || DEFAULT_PARTNER_USERNAME
    )
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();

    if (!partnerApiKey) {
      throw new Error("OpenPay Pro inbound is not configured (missing partner API key).");
    }

    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
    const token = authHeader.replace("Bearer ", "");
    const authResult = await supabase.auth.getUser(token);
    const user = authResult?.data?.user;
    if (authResult?.error || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const notifyOnly = Boolean(body?.notify_only);
    const amount = Number(body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

    let note = String(body?.note || "").trim();
    let toPro = normalizeProTarget(String(body?.to || body?.to_pro_username || ""));
    let openpayTxId = String(body?.openpay_tx_id || "").trim();

    if (note) {
      const parsed = parseProXferNote(note);
      if (parsed) {
        toPro = normalizeProTarget(parsed.to);
        if (!note.startsWith("pro_xfer:")) note = buildProXferNote(parsed.to, parsed.ref);
      }
    }

    if (!toPro) throw new Error("Pro username is required");
    if (!/^([a-z0-9_]{3,32}|uid_[a-f0-9-]{8,})$/i.test(toPro)) {
      throw new Error("Invalid OpenPay Pro username.");
    }

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("username, full_name")
      .eq("id", user.id)
      .maybeSingle();
    const fromUsername = String(senderProfile?.username || "").trim() || null;

    const notifyPro = async (txId: string, routingNote: string, destination: string) => {
      const proTo = destination.startsWith("uid_") ? destination : `@${destination.replace(/^@+/, "")}`;
      const response = await fetch(inboundUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${partnerApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: proTo,
          amount: Number(amount.toFixed(2)),
          openpay_tx_id: txId,
          note: routingNote,
          from_username: fromUsername,
        }),
      });

      const rawText = await response.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = { raw: rawText };
      }

      if (!response.ok) {
        const message =
          (typeof payload.error === "string" && payload.error) ||
          (typeof payload.message === "string" && payload.message) ||
          `OpenPay Pro inbound failed (${response.status})`;
        const err = new Error(message) as Error & { status?: number; payload?: unknown };
        err.status = response.status;
        err.payload = payload;
        throw err;
      }

      return payload;
    };

    // Notify-only path (hosted /pay link already debited OpenPay)
    if (notifyOnly) {
      if (!openpayTxId) throw new Error("openpay_tx_id is required for notify_only");
      if (!note) {
        const ref = String(body?.ref || makeRef());
        note = buildProXferNote(toPro, ref);
      }
      const proResult = await notifyPro(openpayTxId, note, toPro);
      return jsonResponse({
        success: true,
        notify_only: true,
        transaction_id: openpayTxId,
        note,
        pro: proResult,
      });
    }

    // Full transfer path (in-app Transfer to OpenPay Pro)
    const memo = String(body?.memo || "").trim().slice(0, 120);
    const ref = String(body?.ref || makeRef()).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || makeRef();
    note = buildProXferNote(toPro, ref);

    const { data: partnerProfile, error: partnerError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .ilike("username", partnerUsername)
      .maybeSingle();

    if (partnerError) throw partnerError;
    if (!partnerProfile?.id) throw new Error("OpenPay Pro partner account is not available.");
    if (partnerProfile.id === user.id) throw new Error("Cannot transfer to your own partner tag.");

    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const balance = Number(wallet?.balance || 0);
    if (balance < amount) throw new Error("Insufficient balance");

    // Prefer authenticated transfer RPC as the signed-in user (via user-scoped client)
    const userClient: any = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let transactionId = "";
    const rich = await userClient.rpc("transfer_funds_authenticated", {
      p_receiver_id: partnerProfile.id,
      p_amount: amount,
      p_note: note,
      p_currency_code: "OUSD",
      p_sender_amount: amount,
      p_sender_currency_code: "OUSD",
      p_receiver_amount: amount,
      p_receiver_currency_code: "OUSD",
    });

    if (rich.error) {
      const legacy = await userClient.rpc("transfer_funds_authenticated", {
        p_receiver_id: partnerProfile.id,
        p_amount: amount,
        p_note: note,
      });
      if (legacy.error) {
        // Final fallback: service-role transfer_funds
        const serviceTransfer = await supabase.rpc("transfer_funds", {
          p_sender_id: user.id,
          p_receiver_id: partnerProfile.id,
          p_amount: amount,
          p_note: note,
        });
        if (serviceTransfer.error) {
          throw new Error(serviceTransfer.error.message || rich.error.message || "Transfer failed");
        }
        transactionId = String(serviceTransfer.data || "");
      } else {
        transactionId = String(legacy.data || "");
      }
    } else {
      transactionId = String(rich.data || "");
    }

    if (!transactionId) throw new Error("Transfer succeeded but no transaction id was returned");

    let proResult: Record<string, unknown> = {};
    try {
      proResult = await notifyPro(transactionId, note, toPro);
    } catch (notifyError) {
      const message =
        notifyError instanceof Error ? notifyError.message : "OpenPay Pro credit failed";
      // Funds already moved on OpenPay — return partial success with clear error for UI
      return jsonResponse(
        {
          success: true,
          partial: true,
          transaction_id: transactionId,
          note,
          memo: memo || null,
          partner_username: partnerProfile.username,
          partner_name: partnerProfile.full_name,
          error: message,
          warning: "OpenPay debit succeeded, but OpenPay Pro credit failed. Support can retry with the same openpay_tx_id.",
        },
        200,
      );
    }

    return jsonResponse({
      success: true,
      transaction_id: transactionId,
      note,
      memo: memo || null,
      partner_username: partnerProfile.username,
      partner_name: partnerProfile.full_name,
      partner_avatar_url: partnerProfile.avatar_url,
      to_pro: toPro.startsWith("uid_") ? toPro : `@${toPro}`,
      pro: proResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const lowered = message.toLowerCase();
    const status =
      lowered.includes("insufficient") ? 400 :
      lowered.includes("unauthorized") || lowered.includes("auth") ? 401 :
      lowered.includes("unknown") || lowered.includes("not found") ? 404 :
      400;
    return jsonResponse({ error: message }, status);
  }
});
