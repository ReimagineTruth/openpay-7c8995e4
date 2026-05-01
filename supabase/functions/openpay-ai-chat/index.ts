import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are OpenPay AI, the official smart financial assistant for the OpenPay fintech platform.

You can help with ANY OpenPay feature:
- Wallet, balance, send/receive money, request money, contacts
- Top-up: PayPal, credit/debit, Apple Pay, Google Pay, Venmo, USDT, USDC, Solana Pay, MRWN, e-wallet QR (PH), Stripe
- Currency exchange & multi-currency (170+ currencies, Open USD, Pure Pi)
- Virtual Cards, KYC verification, 2FA security, MPIN
- Merchant Portal: products, payment links, POS, checkout, QR, invoices, disputes
- Smart Contract OpenPay API (developer dashboard, API keys, OAuth, webhooks)
- Mining (Pi ads), Staking, Affiliate program, Remittance Center
- Notifications, Activity history, Support

Style:
- Be concise, friendly, and actionable. Use markdown.
- When the user asks how to do something, give clear step-by-step instructions and mention the relevant page route (e.g. /send, /receive, /payment-links/create, /developer-dashboard).
- Use US Dollar ($) for amounts unless the user's currency context is set otherwise.
- Never invent fees or policies. If unsure, say so.
- If the user asks to send money, suggest they confirm via the in-app payment confirmation.

Always personalize using the provided user context (balance, recent activity, currency).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const messages: Array<{ role: string; content: string }> = Array.isArray(body?.messages) ? body.messages : [];
    const userMessage: string = String(body?.message ?? "").slice(0, 4000);
    const model: string = String(body?.model ?? "google/gemini-2.5-flash");

    if (!userMessage.trim() && messages.length === 0) {
      return json({ error: "message is required" }, 400);
    }

    // Gather user context
    const [{ data: wallet }, { data: profile }, { data: recentTx }] = await Promise.all([
      supabase.from("wallets").select("balance, currency").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("display_name, username, country").eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("amount, status, note, created_at, sender_id, recipient_id")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false }).limit(5),
    ]);

    const ctx = {
      name: profile?.display_name || profile?.username || user.email || "user",
      country: profile?.country || "unknown",
      balance: Number(wallet?.balance ?? 0).toFixed(2),
      currency: wallet?.currency || "USD",
      recent: (recentTx || []).map((t: any) => ({
        amount: t.amount,
        direction: t.sender_id === user.id ? "sent" : "received",
        status: t.status,
        note: t.note,
        when: t.created_at,
      })),
    };

    const contextMessage = `User context (do not echo verbatim, use to personalize):
- Name: ${ctx.name}
- Country: ${ctx.country}
- Wallet balance: $${ctx.balance} ${ctx.currency}
- Recent transactions: ${JSON.stringify(ctx.recent)}`;

    const finalMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextMessage },
      ...messages.slice(-10),
    ];
    if (userMessage.trim()) {
      finalMessages.push({ role: "user", content: userMessage });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages: finalMessages }),
    });

    if (aiRes.status === 429) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
    if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please add funds to your workspace." }, 402);
    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error("Lovable AI error", aiRes.status, text);
      return json({ error: "AI service error", detail: text }, 500);
    }

    const payload = await aiRes.json();
    const reply = payload?.choices?.[0]?.message?.content ?? "";

    return json({ reply, context: ctx });
  } catch (e) {
    console.error("openpay-ai-chat fatal", e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
