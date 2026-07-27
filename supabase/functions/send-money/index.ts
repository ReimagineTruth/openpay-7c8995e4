import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_INBOUND_URLS = [
  "https://openpaypro.space/api/public/openpay/inbound",
  "https://openpaypromainnet.lovable.app/api/public/openpay/inbound",
];

const resolveInboundUrls = () => {
  const configured = (Deno.env.get("OPENPAY_PRO_INBOUND_URL") || "").trim();
  const list = configured ? [configured, ...DEFAULT_INBOUND_URLS] : [...DEFAULT_INBOUND_URLS];
  return [...new Set(list.filter(Boolean))];
};

const notifyOpenPayProInbound = async (opts: {
  partnerApiKey: string;
  to: string;
  amount: number;
  openpayTxId: string;
  note: string;
  fromUsername: string | null;
}) => {
  const urls = resolveInboundUrls();
  let lastError = "OpenPay Pro inbound failed";
  let lastPayload: Record<string, unknown> = {};

  for (const inboundUrl of urls) {
    try {
      const notifyRes = await fetch(inboundUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.partnerApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: opts.to,
          amount: Number(opts.amount.toFixed(2)),
          openpay_tx_id: opts.openpayTxId,
          note: opts.note,
          from_username: opts.fromUsername,
        }),
      });

      const rawText = await notifyRes.text();
      let payload: Record<string, unknown> = {};
      try {
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = { raw: rawText };
      }
      lastPayload = payload;

      if (notifyRes.ok) {
        return { ok: true as const, payload, inboundUrl };
      }

      lastError =
        (typeof payload.error === "string" && payload.error) ||
        (typeof payload.message === "string" && payload.message) ||
        `OpenPay Pro inbound failed (${notifyRes.status})`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "OpenPay Pro inbound network error";
    }
  }

  return { ok: false as const, error: lastError, payload: lastPayload };
};

const PRO_XFER_RE =
  /^pro_xfer:(0x[a-fA-F0-9]{40}|@?[A-Za-z0-9_]+|uid_[a-f0-9-]+):([A-Za-z0-9_-]+)/i;

const isProRoutingNote = (note: string) => {
  const n = String(note || "").trim().toLowerCase();
  return n.startsWith("pro_xfer:") || n.startsWith("pro_topup_");
};

const parseProXferNote = (note: string) => {
  const match = String(note || "").trim().match(PRO_XFER_RE);
  if (!match) return null;
  return { to: match[1], ref: match[2] };
};

const formatProDestinationForApi = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return "";
  if (/^0x[a-fA-F0-9]{40}$/.test(cleaned)) return cleaned.toLowerCase();
  if (/^uid_[a-f0-9-]+$/i.test(cleaned)) return cleaned;
  const username = cleaned.replace(/^@+/, "").toLowerCase();
  return username ? `@${username}` : "";
};

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
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Missing auth token");
    const token = authHeader.replace("Bearer ", "");
    const authResult = await supabase.auth.getUser(token);
    const user = authResult?.data?.user;
    if (authResult?.error || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const {
      receiver_id,
      receiver_email,
      amount,
      note,
      currency_code,
      sender_amount,
      sender_currency_code,
      receiver_amount,
      receiver_currency_code,
    } = body;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Invalid amount");

    let receiverId = receiver_id;

    if (receiver_email && receiver_email !== "__by_id__") {
      const receiverAuth = await supabase.auth.admin.listUsers();
      const users = receiverAuth?.data?.users || receiverAuth?.users || [];
      const receiver = users.find((u: any) => u.email === receiver_email);
      if (!receiver) throw new Error("Recipient not found");
      receiverId = receiver.id;
    }

    if (!receiverId) throw new Error("No recipient specified");
    if (receiverId === user.id) throw new Error("Cannot send to yourself");

    const baseNote = (note || "").toString();
    // Keep pro_xfer / pro_topup notes untouched so OpenPay Pro can parse them.
    let enrichedNote = baseNote;
    if (!isProRoutingNote(baseNote)) {
      const fxParts: string[] = [];
      if (typeof sender_amount === "number" && typeof sender_currency_code === "string") {
        fxParts.push(`Paid ${Number(sender_amount).toFixed(2)} ${sender_currency_code}`);
      }
      if (typeof receiver_amount === "number" && typeof receiver_currency_code === "string") {
        fxParts.push(`→ ${Number(receiver_amount).toFixed(2)} ${receiver_currency_code}`);
      }
      enrichedNote = fxParts.length
        ? `${baseNote}${baseNote ? " · " : ""}${fxParts.join(" ")}`
        : baseNote;
    }

    let transactionId: unknown = null;
    let transferError: unknown = null;

    // Try the rich 9-arg overload first (if present), then fall back to the
    // canonical 4-arg signature that always exists.
    const primary = await supabase.rpc("transfer_funds", {
      p_sender_id: user.id,
      p_receiver_id: receiverId,
      p_amount: parsedAmount,
      p_note: enrichedNote,
      p_currency_code: typeof currency_code === "string" ? currency_code : "OUSD",
      p_sender_amount: typeof sender_amount === "number" ? sender_amount : null,
      p_sender_currency_code: typeof sender_currency_code === "string" ? sender_currency_code : null,
      p_receiver_amount: typeof receiver_amount === "number" ? receiver_amount : null,
      p_receiver_currency_code: typeof receiver_currency_code === "string" ? receiver_currency_code : null,
    });
    transactionId = primary.data;
    transferError = primary.error;

    if (transferError) {
      const msg = (transferError as any)?.message || "";
      const shouldFallback = /function .*transfer_funds|does not exist|schema cache|PGRST|no function matches/i.test(msg);
      if (shouldFallback) {
        const legacy = await supabase.rpc("transfer_funds", {
          p_sender_id: user.id,
          p_receiver_id: receiverId,
          p_amount: parsedAmount,
          p_note: enrichedNote,
        });
        transactionId = legacy.data;
        transferError = legacy.error;
      }
    }

    if (transferError) {
      const msg =
        (transferError as any)?.message ||
        (transferError as any)?.details ||
        "Transfer failed";
      throw new Error(msg);
    }

    const txId = String(transactionId || "");
    const responseBody: Record<string, unknown> = {
      success: true,
      transaction_id: transactionId,
      note: enrichedNote,
    };

    // After debit, notify OpenPay Pro for pro_xfer routing notes (API key stays server-side).
    // OAuth Connect (opa_) only reads balance — Pro credit requires this inbound call with opk_.
    const parsedPro = parseProXferNote(enrichedNote);
    if (parsedPro && txId) {
      const partnerApiKey = (
        Deno.env.get("OPENPAY_PRO_PARTNER_API_KEY") ||
        Deno.env.get("OPENPAY_PRO_API_KEY") ||
        ""
      ).trim();

      if (!partnerApiKey) {
        responseBody.partial = true;
        responseBody.pro_notified = false;
        responseBody.warning =
          "OpenPay debit succeeded, but OpenPay Pro inbound is not configured (missing OPENPAY_PRO_PARTNER_API_KEY secret).";
      } else {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        const fromUsername = String(senderProfile?.username || "").trim() || null;
        const proTo = formatProDestinationForApi(parsedPro.to);

        const notified = await notifyOpenPayProInbound({
          partnerApiKey,
          to: proTo,
          amount: parsedAmount,
          openpayTxId: txId,
          note: enrichedNote,
          fromUsername,
        });

        if (!notified.ok) {
          responseBody.partial = true;
          responseBody.pro_notified = false;
          responseBody.warning =
            "OpenPay debit succeeded, but OpenPay Pro credit failed. Support can retry with the same openpay_tx_id.";
          responseBody.error = notified.error;
          responseBody.pro = notified.payload;
        } else {
          responseBody.pro_notified = true;
          responseBody.to_pro = proTo;
          responseBody.pro = notified.payload;
          responseBody.pro_inbound_url = notified.inboundUrl;
        }
      }
    }

    return jsonResponse(responseBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, 400);
  }
});
