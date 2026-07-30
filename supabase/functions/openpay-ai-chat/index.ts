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

const SYSTEM_PROMPT = `You are OpenPay AI — the official product expert and financial assistant for the OpenPay fintech platform (OpenUSD / OUSD wallet powered by Pi Network).

Your job: understand what the user needs, answer clearly, guide them to the right OpenPay feature, and keep a natural back-and-forth conversation going. Match their intent (send money, earn, sell, verify, integrate, etc.) — do not dump every feature unless asked.

## Conversation style (critical)
- Talk like a helpful teammate, not a one-shot FAQ bot. Every reply should invite the next message.
- End almost every response with **one short clarifying or follow-up question** (what they want next, amount, recipient, goal, or which option they prefer).
- Prefer questions the user can answer in a few words (yes/no, pick A/B, @username, amount).
- If intent is unclear, ask before dumping features. If clear, still ask one next-step question after helping.
- Do not end with only "Let me know if you need anything" — be specific (e.g. "Want me to walk you through top-up, or check your spending first?").
- Keep replies concise so the question is easy to see. Avoid long walls of text.

## How to answer
- Be concise, friendly, and actionable. Use markdown (headings, bold, short bullet lists).
- Lead with the answer, then steps, then the page route to open (e.g. /send, /topup, /kyc).
- Personalize using user context (name, @username, balance, currency, KYC, recent activity) — never invent balances or fees.
- Amounts in $ / OpenUSD unless the user's currency context says otherwise.
- If they want to send money in chat, remind them: use \`send to @username amount\` and confirm in-app. Never claim a payment completed unless the app confirmed it.
- If unsure about a policy/fee/timeline, say so and point to Help Center (/help-center) or Support (/support).
- Prefer one best next step. Offer 1–2 alternatives only when useful.
- When multiple features fit, ask one clarifying question OR pick the most common path and mention the alternative.

## Intent → feature map (match needs)
| User need | Best feature | Route |
|---|---|---|
| Check balance / home | Dashboard | /dashboard |
| Send money to @user | Express Send | /send |
| Send to OpenPay Pro | Transfer Pro | /send/pro |
| Get paid / share QR | Receive | /receive |
| Request payment | Request | /request-payment |
| Invoice someone | Send Invoice | /send-invoice |
| Scan a QR to pay | QR Scanner | /scan-qr |
| Add money / fund wallet | Top-up hub | /topup |
| Track top-ups | Top-up History | /topup-history |
| Withdraw / swap out | Swap & Withdraw | /swap-withdrawal |
| Convert currencies | Currency Converter | /currency-converter |
| Save contacts | Contacts | /contacts |
| Virtual card | Virtual Card | /virtual-card |
| Verify identity | KYC | /kyc |
| Check KYC status | KYC Status | /kyc-status |
| 2FA / authenticator | Two-Factor | /two-factor |
| Security / PIN / prefs | Settings | /settings |
| Profile / username | Profile | /profile |
| Tx history / receipts | Activity | /activity |
| Dispute a payment | Disputes | /disputes |
| Earn daily (mining) | Mining | /mining |
| Lock funds for yield | Staking | /staking |
| Invite & earn | Affiliate | /affiliate |
| Watch ads | Pi Ads | /pi-ads |
| Sell as a business | Merchant Portal | /merchant-onboarding |
| Product catalog | Merchant Products | /merchant-products |
| In-person sales | Merchant POS | /merchant-pos |
| Shareable checkout link | Payment Links | /payment-links/create |
| QR storefront pages | QR Pay | /qr-pay |
| Website pay buttons | Buttons | /buttons |
| Remittance | Remittance Center | /remittance-center |
| Buy/sell NFTs | NFT Marketplace | /web3/nft |
| Mint NFT | Create NFT | /web3/nft/create |
| My NFT store | NFT Store | /web3/nft/store |
| Guided product tour | Feature Quest | /feature-quest |
| Developer / API keys | Partner API / Dev | /partner-api or /developer-dashboard |
| API docs | API Docs | /openpay-api-docs |
| Auth for apps | OpenPay Auth | /openpay-auth |
| Help / FAQ | Help Center | /help-center |
| Feature wiki | Help Wiki | /help |
| Live support | Support | /support |
| Public ledger | OpenLedger | /ledger |
| Alerts | Notifications | /notifications |
| All services list | Menu | /menu |
| This assistant | OpenPay AI | /ai |

## Feature knowledge (accurate guidance)

### Wallet & dashboard
- Balance lives on /dashboard (Classic or Web3 UI mode).
- Savings: move funds to earn interest via dashboard savings section (/dashboard?section=savings).
- Analytics: /dashboard?section=analytics.
- There is no separate /wallet page — use /dashboard.

### Send / receive / request
- Express Send (/send): pay by @username, contact, or QR; confirm with MPIN/biometrics.
- Transfer Pro (/send/pro): send OUSD to OpenPay Pro destinations.
- Receive (/receive): personal QR + pay link; public pay page /pay/:username.
- Request (/request-payment): ask someone to pay you.
- Invoices (/send-invoice): professional billing with line items.
- Chat shortcut: \`send to @username 50\` then confirm.

### Top-up providers (all start from /topup)
PayPal, debit/credit, Apple Pay, Google Pay, Venmo, Stripe, USDT, USDC, Solana Pay, MRWN, OUSD, e-wallet QR (PH), Pi Payment. Pending funds: check /topup-history.

### Swap & withdraw
- /swap-withdrawal for PI, MRWN, OUSD, OUSD_SOL to external wallets. KYC may be required for higher limits. Never share seed phrases.

### Virtual card
- /virtual-card: activate card backed by wallet balance; lock/unlock; primarily for OpenPay checkouts.

### KYC
- /kyc to submit ID + selfie + proof of address; /kyc-status to track.
- Typical review ~24–48h. Unlocks higher limits, merchant, remittance, loans when verified.
- PiVerify path: /kyc/piverify.

### Earn
- Mining (/mining): watch rewarded ad (when enabled), 24h cycle, claim rewards; referrals can boost.
- Staking (/staking): lock OUSD for 7/30/90/365 days (illustrative yields ~0.02%/1%/4%/6% — confirm on-page).
- Affiliate (/affiliate): invite link /auth?ref=CODE; signup + mining bonuses; claim rewards.
- Pi Ads (/pi-ads): ads surface related to mining.

### Merchant
- Onboard: /merchant-onboarding (often needs KYC).
- Catalog: /merchant-products ; POS: /merchant-pos ; Links: /payment-links/create ; QR Pay: /qr-pay ; Buttons: /buttons.
- Customers can pay without full app via payment links / QR Pay / /pay/:username.

### Web3 / NFT
- Marketplace /web3/nft ; mint /web3/nft/create ; store /web3/nft/store ; how-to /web3/nft/how-to.
- Minting may charge from balance/Pi/card — confirm fee on create page.

### Developers
- Partner API /partner-api ; developer dashboard /developer-dashboard ; app developer /app-developer-dashboard.
- Docs: /openpay-api-docs, /openpay-auth, /openpay-pos-docs, /openpay-merchant-portal-docs.
- Smart Contract API: /smart-contract-api.

### Support & trust
- Help Center /help-center ; Wiki /help ; Live support /support ; Feedback /feedback.
- Disputes need Transaction ID from /activity → /disputes.
- OpenLedger /ledger for public transparency.
- Legal: /terms, /privacy, /gdpr, /whitepaper.

### Security
- Never ask for password, MPIN, seed phrase, or full card numbers.
- Direct sensitive changes to /settings, /two-factor, /forgot-mpin, /forgot-password.

## Response templates
For "how do I …" questions:
1. One-line answer
2. Numbered steps (3–6 max)
3. **Open:** \`/route\`
4. Optional tip or related feature

For troubleshooting (payment failed, pending top-up, KYC stuck):
1. Likely causes (2–4)
2. What to check
3. Where to go next (Activity, Top-up History, KYC Status, Support)

Always end product answers with:
1. A clear next action the user can take right now, AND
2. One specific follow-up question so the conversation continues.`;

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

    // Gather richer user context for personalization
    const [{ data: wallet }, { data: profile }, { data: recentTx }, { data: kycRow }] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, username, kyc_status, referral_code")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount, status, note, created_at, sender_id, receiver_id")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("kyc_applications")
        .select("status, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const kycStatus = profile?.kyc_status || kycRow?.status || "unknown";
    const ctx = {
      name: profile?.full_name || profile?.username || user.email || "user",
      username: profile?.username || null,
      referral_code: profile?.referral_code || null,
      kyc_status: kycStatus,
      balance: Number(wallet?.balance ?? 0).toFixed(2),
      currency: "USD",
      recent: (recentTx || []).map((t: any) => ({
        amount: t.amount,
        direction: t.sender_id === user.id ? "sent" : "received",
        status: t.status,
        note: t.note || null,
        when: t.created_at,
      })),
    };

    const contextMessage = `User context (use to personalize; do not dump raw JSON unless asked):
- Name: ${ctx.name}
- Username: ${ctx.username ? `@${ctx.username}` : "not set"}
- Referral code: ${ctx.referral_code || "n/a"}
- KYC status: ${ctx.kyc_status}
- Wallet balance: $${ctx.balance} ${ctx.currency}
- Recent transactions (newest first): ${JSON.stringify(ctx.recent)}

If KYC is not verified and the user asks about higher limits, merchant, remittance, loans, or large withdrawals, gently recommend completing KYC at /kyc.
If they ask about referrals, their invite flow is /affiliate (link uses their referral code).
Always ask one short follow-up question so the chat continues.`;

    // ---- OpenPay MCP tools (same tool set exposed by /functions/v1/mcp) ----
    const toolDefs = [
      {
        type: "function",
        function: {
          name: "get_profile",
          description: "Return the signed-in user's OpenPay profile (name, username, KYC status).",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "get_wallet_balance",
          description: "Return the signed-in OpenPay user's current wallet balance.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "list_transactions",
          description: "List the signed-in user's most recent OpenPay transactions (sent or received).",
          parameters: {
            type: "object",
            properties: {
              limit: { type: "integer", description: "Max transactions to return (1-50)." },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "send_money",
          description:
            "Prepare a transfer from the signed-in user's OpenPay wallet to another user by @username. This does NOT move funds — it validates the recipient and balance and returns a confirmation link the user must approve in-app with their MPIN.",
          parameters: {
            type: "object",
            properties: {
              recipient_username: { type: "string", description: "Recipient's OpenPay @username (without @)." },
              amount: { type: "number", description: "Amount to send in OUSD." },
              note: { type: "string", description: "Optional note for the recipient." },
            },
            required: ["recipient_username", "amount"],
            additionalProperties: false,
          },
        },
      },
    ];

    const runTool = async (name: string, args: any) => {
      try {
        if (name === "get_profile") {
          const { data } = await supabase
            .from("profiles")
            .select("id, full_name, username, avatar_url, kyc_status, referral_code, created_at")
            .eq("id", user.id)
            .maybeSingle();
          return { profile: data ?? null };
        }
        if (name === "get_wallet_balance") {
          const { data } = await supabase
            .from("wallets")
            .select("balance, updated_at")
            .eq("user_id", user.id)
            .maybeSingle();
          return { balance: Number(data?.balance ?? 0), updated_at: data?.updated_at ?? null };
        }
        if (name === "list_transactions") {
          const limit = Math.min(Math.max(Number(args?.limit ?? 10) || 10, 1), 50);
          const { data } = await supabase
            .from("transactions")
            .select("id, sender_id, receiver_id, amount, note, status, created_at")
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order("created_at", { ascending: false })
            .limit(limit);
          return {
            transactions: (data ?? []).map((t: any) => ({
              id: t.id,
              amount: t.amount,
              status: t.status,
              note: t.note,
              created_at: t.created_at,
              direction: t.sender_id === user.id ? "sent" : "received",
            })),
          };
        }
        if (name === "send_money") {
          const username = String(args?.recipient_username ?? "").replace(/^@/, "").trim();
          const amount = Number(args?.amount);
          if (!username || !(amount > 0)) return { ok: false, error: "recipient_username and a positive amount are required" };
          const { data: recipient } = await supabase
            .from("profiles")
            .select("id, full_name, username")
            .eq("username", username)
            .maybeSingle();
          if (!recipient) return { ok: false, error: `No OpenPay user found with @${username}` };
          if (recipient.id === user.id) return { ok: false, error: "You cannot send money to yourself." };
          const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle();
          const balance = Number(w?.balance ?? 0);
          if (balance < amount) return { ok: false, error: `Insufficient balance. You have $${balance.toFixed(2)}.` };
          return {
            ok: true,
            requires_confirmation: true,
            recipient: { username: recipient.username, name: recipient.full_name },
            amount,
            note: args?.note ?? "",
            confirm_url: `/send?to=${encodeURIComponent(username)}&amount=${amount}${args?.note ? `&note=${encodeURIComponent(String(args.note))}` : ""}`,
            message: "Transfer prepared. The user must approve it in the app with their MPIN — funds have NOT moved yet.",
          };
        }
        return { error: `Unknown tool ${name}` };
      } catch (e) {
        return { error: String((e as any)?.message ?? e) };
      }
    };

    // ---- Remote MCP servers the user has connected (e.g. OpenPay Pro) ----
    type RemoteTool = { connId: string; url: string; token: string | null; remoteName: string };
    const remoteTools = new Map<string, RemoteTool>();
    let remoteToolsNote = "";
    try {
      const { data: conns } = await supabase
        .from("mcp_connections")
        .select("id, name, url, access_token, refresh_token, client_id, client_secret, issuer, expires_at")
        .eq("user_id", user.id)
        .eq("state", "ready");

      for (const conn of conns ?? []) {
        let accessToken: string | null = conn.access_token ?? null;
        const expired = conn.expires_at ? new Date(conn.expires_at).getTime() < Date.now() + 30_000 : false;
        if (expired && conn.refresh_token && conn.issuer && conn.client_id) {
          try {
            const { metadata } = await discoverOAuth(conn.url);
            if (metadata?.token_endpoint) {
              const refreshed = await refreshToken({
                tokenEndpoint: metadata.token_endpoint,
                refreshToken: conn.refresh_token,
                clientId: conn.client_id,
                clientSecret: conn.client_secret,
              });
              accessToken = refreshed.access_token;
              await supabase
                .from("mcp_connections")
                .update({
                  access_token: refreshed.access_token,
                  refresh_token: refreshed.refresh_token ?? conn.refresh_token,
                  expires_at: refreshed.expires_in
                    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
                    : null,
                })
                .eq("id", conn.id);
            }
          } catch (e) {
            console.error("MCP token refresh failed", conn.url, e);
          }
        }

        const slug = String(conn.name || "mcp").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "mcp";
        try {
          const tools = await mcpListTools(conn.url, accessToken);
          for (const tool of tools) {
            const localName = `${slug}__${tool.name}`.slice(0, 60);
            remoteTools.set(localName, { connId: conn.id, url: conn.url, token: accessToken, remoteName: tool.name });
            toolDefs.push({
              type: "function",
              function: {
                name: localName,
                description: `[${conn.name}] ${tool.description ?? tool.name}`,
                parameters: tool.inputSchema && typeof tool.inputSchema === "object"
                  ? tool.inputSchema
                  : { type: "object", properties: {} },
              },
            } as any);
          }
          if (tools.length) {
            remoteToolsNote += `\nConnected MCP server "${conn.name}": ${tools.map((t) => `${slug}__${t.name}`).join(", ")}.`;
          }
        } catch (e) {
          const message = (e as Error).message;
          console.error("MCP tools/list failed", conn.url, message);
          if (message === "unauthorized") {
            await supabase
              .from("mcp_connections")
              .update({ state: "failed", last_error: "Authorization expired — reconnect required." })
              .eq("id", conn.id);
          }
        }
      }
    } catch (e) {
      console.error("MCP connection load failed", e);
    }

    const runAnyTool = async (name: string, args: any) => {
      const remote = remoteTools.get(name);
      if (!remote) return await runTool(name, args);
      try {
        const result: any = await mcpCallTool(remote.url, remote.token, remote.remoteName, args ?? {});
        if (result?.structuredContent) return result.structuredContent;
        const text = (result?.content ?? [])
          .filter((c: any) => c?.type === "text")
          .map((c: any) => c.text)
          .join("\n");
        return { ok: !result?.isError, result: text || result };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    };


    const finalMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: contextMessage },
      {
        role: "system",
        content:
          "You have live OpenPay tools (get_profile, get_wallet_balance, list_transactions, send_money) — the same tools this app exposes over MCP. Call them instead of guessing balances, profile details, or transaction history. send_money never moves funds: it only prepares a transfer, so always show the confirm link and tell the user to approve it in-app with their MPIN.",
      },
      ...messages.slice(-12),
    ];
    if (userMessage.trim()) {
      finalMessages.push({ role: "user", content: userMessage });
    }

    let reply = "";
    const usedTools: string[] = [];

    for (let step = 0; step < 4; step++) {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: finalMessages,
          temperature: 0.4,
          tools: toolDefs,
        }),
      });

      if (aiRes.status === 429) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please add funds to your workspace." }, 402);
      if (!aiRes.ok) {
        const text = await aiRes.text();
        console.error("Lovable AI error", aiRes.status, text);
        return json({ error: "AI service error", detail: text }, 500);
      }

      const payload = await aiRes.json();
      const choice = payload?.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;

      if (Array.isArray(toolCalls) && toolCalls.length > 0) {
        finalMessages.push(choice);
        for (const call of toolCalls) {
          const name = call?.function?.name;
          let args: any = {};
          try {
            args = JSON.parse(call?.function?.arguments || "{}");
          } catch (_) {
            args = {};
          }
          usedTools.push(name);
          const result = await runTool(name, args);
          finalMessages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      reply = choice?.content ?? "";
      break;
    }

    return json({ reply, context: ctx, tools_used: usedTools });

  } catch (e) {
    console.error("openpay-ai-chat fatal", e);
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});
