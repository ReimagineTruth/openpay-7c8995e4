# OpenPay AI — Full Integration Spec (port to OpenPay Pro)

Everything needed to rebuild **OpenPay AI** (`/ai`) exactly: database, edge function, tool calling, MCP connections, frontend contract, and UI behavior.

Stack: React 18 + Vite + TypeScript + Tailwind + shadcn, Supabase (Postgres + Edge Functions), Lovable AI Gateway.

---

## 1. Architecture

```
/ai page (React)
  ├─ local intent parser (send to @user, feature routes, balance, confirm/cancel)
  ├─ supabase.functions.invoke("openpay-ai-chat")   ← main LLM turn
  ├─ supabase.functions.invoke("mcp-connections")   ← connect/list/remove remote MCP servers
  └─ tables: ai_chat_history, wallets, profiles, transactions

openpay-ai-chat (Deno edge function, service role)
  ├─ verifies user JWT → user.id
  ├─ builds user context (profile, wallet, recent tx, KYC, currency)
  ├─ local tools: get_profile, get_wallet_balance, list_transactions, send_money
  ├─ remote tools: every connected MCP server's tools, prefixed `<slug>__<tool>`
  └─ loops max 4 steps against https://ai.gateway.lovable.dev/v1/chat/completions
```

Key rule: **`send_money` never moves funds.** It validates recipient + balance and returns a `confirm_url`; the user approves in-app with MPIN.

---

## 2. Database

### 2.1 `ai_chat_history`

```sql
create table if not exists public.ai_chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  type text not null default 'text',           -- text | payment | insight | receipt
  metadata jsonb not null default '{}'::jsonb, -- { receipt: {...} }
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ai_chat_history to authenticated;
grant all on public.ai_chat_history to service_role;

alter table public.ai_chat_history enable row level security;

create policy "own chat history read"   on public.ai_chat_history
  for select to authenticated using (auth.uid() = user_id);
create policy "own chat history insert" on public.ai_chat_history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "own chat history delete" on public.ai_chat_history
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists ai_chat_history_user_created_idx
  on public.ai_chat_history (user_id, created_at desc);
```

### 2.2 `mcp_connections` (remote MCP servers per user)

```sql
create table if not exists public.mcp_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  state text not null default 'authenticating',  -- authenticating | ready | failed
  auth_url text,
  issuer text,
  client_id text,
  client_secret text,
  code_verifier text,
  oauth_state text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.mcp_connections to authenticated;
grant all on public.mcp_connections to service_role;

alter table public.mcp_connections enable row level security;

create policy "own mcp connections" on public.mcp_connections
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

> Tokens are only ever read by the edge function (service role). Never select `access_token`/`refresh_token`/`client_secret` from the browser — the client function returns a sanitized shape (`id, name, url, state, last_error, created_at`).

### 2.3 Tables the AI reads (must exist)

| Table | Columns used |
|---|---|
| `profiles` | `id, full_name, username, avatar_url, kyc_status, referral_code, created_at` |
| `wallets` | `user_id, balance, updated_at` |
| `transactions` | `id, sender_id, receiver_id, amount, note, status, created_at` |

---

## 3. Edge function: `openpay-ai-chat`

**Secrets required:** `LOVABLE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
`supabase/config.toml`:

```toml
[functions.openpay-ai-chat]
verify_jwt = true
```

### 3.1 Request / response contract

`POST /functions/v1/openpay-ai-chat`
Headers: `Authorization: Bearer <user access token>`, `Content-Type: application/json`

```jsonc
{
  "message": "what's my balance?",           // current turn (max 4000 chars)
  "messages": [                               // last ~8 turns, oldest first
    { "role": "user", "content": "hi" },
    { "role": "assistant", "content": "Hi there…" }
  ],
  "model": "google/gemini-2.5-flash"          // optional, default same
}
```

Response `200`:

```jsonc
{
  "reply": "Your balance is **$1,204.50**…",
  "context": {
    "name": "Mrwain",
    "username": "wainfoundation",
    "referral_code": "ABC123",
    "kyc_status": "verified",
    "balance": "1204.50",
    "currency": "USD",
    "recent": [{ "amount": 25, "direction": "sent", "status": "completed", "created_at": "…" }]
  },
  "tools_used": ["get_wallet_balance"]
}
```

Errors: `401 {"error":"Unauthorized"}`, `400 {"error":"message is required"}`,
`429 {"error":"Rate limit exceeded. Try again shortly."}`,
`402 {"error":"AI credits exhausted. Please add funds to your workspace."}`,
`500 {"error":"AI service error","detail":"…"}`.

### 3.2 Function skeleton (Deno)

```ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { discoverOAuth, mcpCallTool, mcpListTools, refreshToken } from "../_shared/mcp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "AI gateway not configured" }, 500);

  const supabase: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const user = userData.user;

  const body = await req.json().catch(() => ({}));
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const userMessage = String(body?.message ?? "").slice(0, 4000);
  const model = String(body?.model ?? "google/gemini-2.5-flash");
  if (!userMessage.trim() && messages.length === 0) return json({ error: "message is required" }, 400);

  // …context → tools → agent loop (sections below)…
});
```

### 3.3 User context block

```ts
const [{ data: wallet }, { data: profile }, { data: recentTx }] = await Promise.all([
  supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle(),
  supabase.from("profiles")
    .select("full_name, username, kyc_status, referral_code")
    .eq("id", user.id).maybeSingle(),
  supabase.from("transactions")
    .select("amount, note, status, created_at, sender_id, receiver_id")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order("created_at", { ascending: false }).limit(5),
]);

const ctx = {
  name: profile?.full_name || user.email?.split("@")[0] || "there",
  username: profile?.username ?? null,
  referral_code: profile?.referral_code ?? null,
  kyc_status: profile?.kyc_status ?? "not started",
  balance: Number(wallet?.balance ?? 0).toFixed(2),
  currency: "USD",
  recent: (recentTx ?? []).map((t: any) => ({
    amount: t.amount, status: t.status, note: t.note,
    created_at: t.created_at,
    direction: t.sender_id === user.id ? "sent" : "received",
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
```

### 3.4 Local tool definitions (OpenAI-style function calling)

```ts
const toolDefs = [
  { type: "function", function: {
      name: "get_profile",
      description: "Return the signed-in user's OpenPay profile (name, username, KYC status).",
      parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: {
      name: "get_wallet_balance",
      description: "Return the signed-in OpenPay user's current wallet balance.",
      parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: {
      name: "list_transactions",
      description: "List the signed-in user's most recent OpenPay transactions (sent or received).",
      parameters: { type: "object",
        properties: { limit: { type: "integer", description: "Max transactions to return (1-50)." } },
        additionalProperties: false } } },
  { type: "function", function: {
      name: "send_money",
      description: "Prepare a transfer from the signed-in user's OpenPay wallet to another user by @username. This does NOT move funds — it validates the recipient and balance and returns a confirmation link the user must approve in-app with their MPIN.",
      parameters: { type: "object",
        properties: {
          recipient_username: { type: "string", description: "Recipient's OpenPay @username (without @)." },
          amount: { type: "number", description: "Amount to send in OUSD." },
          note: { type: "string", description: "Optional note for the recipient." },
        },
        required: ["recipient_username", "amount"], additionalProperties: false } } },
];
```

### 3.5 Local tool executor

```ts
const runTool = async (name: string, args: any) => {
  try {
    if (name === "get_profile") {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, username, avatar_url, kyc_status, referral_code, created_at")
        .eq("id", user.id).maybeSingle();
      return { profile: data ?? null };
    }
    if (name === "get_wallet_balance") {
      const { data } = await supabase.from("wallets")
        .select("balance, updated_at").eq("user_id", user.id).maybeSingle();
      return { balance: Number(data?.balance ?? 0), updated_at: data?.updated_at ?? null };
    }
    if (name === "list_transactions") {
      const limit = Math.min(Math.max(Number(args?.limit ?? 10) || 10, 1), 50);
      const { data } = await supabase.from("transactions")
        .select("id, sender_id, receiver_id, amount, note, status, created_at")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at", { ascending: false }).limit(limit);
      return { transactions: (data ?? []).map((t: any) => ({
        id: t.id, amount: t.amount, status: t.status, note: t.note,
        created_at: t.created_at, direction: t.sender_id === user.id ? "sent" : "received" })) };
    }
    if (name === "send_money") {
      const username = String(args?.recipient_username ?? "").replace(/^@/, "").trim();
      const amount = Number(args?.amount);
      if (!username || !(amount > 0))
        return { ok: false, error: "recipient_username and a positive amount are required" };
      const { data: recipient } = await supabase.from("profiles")
        .select("id, full_name, username").eq("username", username).maybeSingle();
      if (!recipient) return { ok: false, error: `No OpenPay user found with @${username}` };
      if (recipient.id === user.id) return { ok: false, error: "You cannot send money to yourself." };
      const { data: w } = await supabase.from("wallets")
        .select("balance").eq("user_id", user.id).maybeSingle();
      const balance = Number(w?.balance ?? 0);
      if (balance < amount) return { ok: false, error: `Insufficient balance. You have $${balance.toFixed(2)}.` };
      return {
        ok: true,
        requires_confirmation: true,
        recipient: { username: recipient.username, name: recipient.full_name },
        amount,
        note: args?.note ?? "",
        confirm_url: `/send?to=${encodeURIComponent(username)}&amount=${amount}`,
        message: "Transfer prepared. The user must approve it in the app with their MPIN — funds have NOT moved yet.",
      };
    }
    return { error: `Unknown tool ${name}` };
  } catch (e) {
    return { error: String((e as any)?.message ?? e) };
  }
};
```

### 3.6 Remote MCP tools (OpenPay Pro ↔ OpenPay, any MCP server)

Load every `state = 'ready'` connection for the user, refresh expiring tokens, list tools, and register them as `<slug>__<toolName>` (slug = connection name lowercased, non-alphanumerics → `_`, capped to 60 chars).

```ts
type RemoteTool = { connId: string; url: string; token: string | null; remoteName: string };
const remoteTools = new Map<string, RemoteTool>();
let remoteToolsNote = "";

const { data: conns } = await supabase.from("mcp_connections")
  .select("id, name, url, access_token, refresh_token, client_id, client_secret, issuer, expires_at")
  .eq("user_id", user.id).eq("state", "ready");

for (const conn of conns ?? []) {
  let accessToken: string | null = conn.access_token ?? null;
  const expired = conn.expires_at ? new Date(conn.expires_at).getTime() < Date.now() + 30_000 : false;
  if (expired && conn.refresh_token && conn.issuer && conn.client_id) {
    const { metadata } = await discoverOAuth(conn.url);
    if (metadata?.token_endpoint) {
      const r = await refreshToken({
        tokenEndpoint: metadata.token_endpoint,
        refreshToken: conn.refresh_token,
        clientId: conn.client_id,
        clientSecret: conn.client_secret,
      });
      accessToken = r.access_token;
      await supabase.from("mcp_connections").update({
        access_token: r.access_token,
        refresh_token: r.refresh_token ?? conn.refresh_token,
        expires_at: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null,
      }).eq("id", conn.id);
    }
  }

  const slug = String(conn.name || "mcp").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "mcp";
  try {
    const tools = await mcpListTools(conn.url, accessToken);
    for (const tool of tools) {
      const localName = `${slug}__${tool.name}`.slice(0, 60);
      remoteTools.set(localName, { connId: conn.id, url: conn.url, token: accessToken, remoteName: tool.name });
      toolDefs.push({ type: "function", function: {
        name: localName,
        description: `[${conn.name}] ${tool.description ?? tool.name}`,
        parameters: tool.inputSchema ?? { type: "object", properties: {} },
      }} as any);
    }
    if (tools.length)
      remoteToolsNote += `\nConnected MCP server "${conn.name}": ${tools.map(t => `${slug}__${t.name}`).join(", ")}.`;
  } catch (e) {
    if ((e as Error).message === "unauthorized") {
      await supabase.from("mcp_connections")
        .update({ state: "failed", last_error: "Authorization expired — reconnect required." })
        .eq("id", conn.id);
    }
  }
}

const runAnyTool = async (name: string, args: any) => {
  const remote = remoteTools.get(name);
  if (!remote) return await runTool(name, args);
  try {
    const result: any = await mcpCallTool(remote.url, remote.token, remote.remoteName, args ?? {});
    if (result?.structuredContent) return result.structuredContent;
    const text = (result?.content ?? []).filter((c: any) => c?.type === "text").map((c: any) => c.text).join("\n");
    return { ok: !result?.isError, result: text || result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};
```

### 3.7 Agent loop (max 4 steps)

```ts
const finalMessages: any[] = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "system", content: contextMessage },
  { role: "system", content:
      "You have live OpenPay tools (get_profile, get_wallet_balance, list_transactions, send_money) — the same tools this app exposes over MCP. Call them instead of guessing balances, profile details, or transaction history. send_money never moves funds: it only prepares a transfer, so always show the confirm link and tell the user to approve it in-app with their MPIN." + remoteToolsNote },
  ...messages.slice(-12),
];
if (userMessage.trim()) finalMessages.push({ role: "user", content: userMessage });

let reply = "";
const usedTools: string[] = [];

for (let step = 0; step < 4; step++) {
  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: finalMessages, temperature: 0.4, tools: toolDefs }),
  });
  if (aiRes.status === 429) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);
  if (aiRes.status === 402) return json({ error: "AI credits exhausted. Please add funds to your workspace." }, 402);
  if (!aiRes.ok) return json({ error: "AI service error", detail: await aiRes.text() }, 500);

  const payload = await aiRes.json();
  const choice = payload?.choices?.[0]?.message;
  const toolCalls = choice?.tool_calls;

  if (Array.isArray(toolCalls) && toolCalls.length) {
    finalMessages.push(choice);
    for (const call of toolCalls) {
      const name = call?.function?.name;
      let args: any = {};
      try { args = JSON.parse(call?.function?.arguments || "{}"); } catch { args = {}; }
      usedTools.push(name);
      finalMessages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await runAnyTool(name, args)) });
    }
    continue;
  }
  reply = choice?.content ?? "";
  break;
}

return json({ reply, context: ctx, tools_used: usedTools });
```

---

## 4. System prompt (copy verbatim, swap the route table for Pro routes)

```md
You are OpenPay AI — the official product expert and financial assistant for the OpenPay fintech platform (OpenUSD / OUSD wallet powered by Pi Network).

Your job: understand what the user needs, answer clearly, guide them to the right OpenPay feature, and keep a natural back-and-forth conversation going. Match their intent (send money, earn, sell, verify, integrate, etc.) — do not dump every feature unless asked.

## Conversation style (critical)
- Talk like a helpful teammate, not a one-shot FAQ bot. Every reply should invite the next message.
- End almost every response with **one short clarifying or follow-up question**.
- Prefer questions the user can answer in a few words (yes/no, pick A/B, @username, amount).
- If intent is unclear, ask before dumping features. If clear, still ask one next-step question after helping.
- Do not end with only "Let me know if you need anything" — be specific.
- Keep replies concise so the question is easy to see.

## How to answer
- Be concise, friendly, actionable. Use markdown (headings, bold, short bullets).
- Lead with the answer, then steps, then the page route to open (e.g. /send, /topup, /kyc).
- Personalize using user context (name, @username, balance, currency, KYC, recent activity) — never invent balances or fees.
- Amounts in $ / OpenUSD unless the user's currency context says otherwise.
- If they want to send money in chat: `send to @username amount`, confirm in-app. Never claim a payment completed unless the app confirmed it.
- If unsure about a policy/fee/timeline, say so and point to Help Center (/help-center) or Support (/support).
- Prefer one best next step. Offer 1–2 alternatives only when useful.

## Intent → feature map
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
| Sell as a business | Merchant Portal | /merchant-onboarding |
| Product catalog | Merchant Products | /merchant-products |
| In-person sales | Merchant POS | /merchant-pos |
| Shareable checkout link | Payment Links | /payment-links/create |
| QR storefront pages | QR Pay | /qr-pay |
| Website pay buttons | Buttons | /buttons |
| Remittance | Remittance Center | /remittance-center |
| Buy/sell NFTs | NFT Marketplace | /web3/nft |
| Mint NFT | Create NFT | /web3/nft/create |
| Guided product tour | Feature Quest | /feature-quest |
| Developer / API keys | Partner API | /partner-api |
| API docs | API Docs | /openpay-api-docs |
| Help / FAQ | Help Center | /help-center |
| Live support | Support | /support |
| Public ledger | OpenLedger | /ledger |
| All services list | Menu | /menu |
| This assistant | OpenPay AI | /ai |

## Feature knowledge
### Wallet & dashboard
- Balance lives on /dashboard. Savings: /dashboard?section=savings. Analytics: /dashboard?section=analytics. There is no separate /wallet page.
### Send / receive / request
- Express Send (/send): pay by @username, contact, or QR; confirm with MPIN/biometrics.
- Transfer Pro (/send/pro): send OUSD to OpenPay Pro destinations (@username or 0x wallet).
- Receive (/receive): personal QR + pay link; public pay page /pay/:username.
- Chat shortcut: `send to @username 50` then confirm.
### Top-up providers (all start from /topup)
PayPal, debit/credit, Apple Pay, Google Pay, Venmo, Stripe, USDT, USDC, Solana Pay, MRWN, OUSD, e-wallet QR (PH), Pi Payment. Pending funds: /topup-history.
### Swap & withdraw
- /swap-withdrawal for OUSD (1 OUSD = $1 fixed peg) and other assets. KYC may be required for higher limits. Never share seed phrases.
### KYC
- /kyc submits ID + selfie + proof of address; /kyc-status tracks it. Review ~24–48h.
### Earn
- Mining (/mining): 24h cycle, claim rewards. Staking (/staking): lock OUSD 7/30/90/365 days. Affiliate (/affiliate): invite link /auth?ref=CODE.
### Merchant
- /merchant-onboarding, /merchant-products, /merchant-pos, /payment-links/create, /qr-pay, /buttons.
### Developers
- /partner-api, /developer-dashboard, /openpay-api-docs, /openpay-auth, /smart-contract-api.
### Security
- Never ask for password, MPIN, seed phrase, or full card numbers. Sensitive changes go to /settings, /two-factor, /forgot-mpin, /forgot-password.

## Response templates
"How do I …": 1) one-line answer 2) 3–6 numbered steps 3) **Open:** `/route` 4) optional tip.
Troubleshooting: 1) likely causes 2) what to check 3) where to go next (Activity, Top-up History, KYC Status, Support).

Always end product answers with a clear next action AND one specific follow-up question.
```

---

## 5. Frontend contract

### 5.1 Message model

```ts
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;                 // ISO
  type?: "text" | "payment" | "insight" | "receipt";
  receipt?: AiReceiptData;
};
```

### 5.2 Calling the AI

```ts
const callOpenPayAI = async (prompt: string): Promise<string> => {
  const history = messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
  const { data, error } = await supabase.functions.invoke("openpay-ai-chat", {
    body: { message: prompt, messages: history, model: "google/gemini-2.5-flash" },
  });
  if (error) return "I'm having trouble reaching the AI service right now. Please try again in a moment.";
  if (data?.error) {
    const e = String(data.error).toLowerCase();
    if (e.includes("rate")) return "⏳ The AI is busy. Please try again in a few seconds.";
    if (e.includes("credit")) return "⚠️ AI credits are exhausted. Please top up your workspace credits.";
    return `AI error: ${data.error}`;
  }
  return data?.reply || "I couldn't generate a response. Please try again.";
};
```

### 5.3 Persistence

```ts
// load: last 50 rows desc → reverse
supabase.from("ai_chat_history").select("*").eq("user_id", uid)
  .order("created_at", { ascending: false }).limit(50);

// save each message
supabase.from("ai_chat_history").insert({
  user_id: uid, role: m.role, content: m.content,
  type: m.type === "receipt" ? "payment" : (m.type || "text"),
  metadata: m.receipt ? { receipt: m.receipt } : {},
  created_at: m.timestamp,
});
```

### 5.4 Local intent parser (runs **before** the LLM call)

Send intent regexes (all case-insensitive):

```ts
/(?:send|transfer|pay)\s+(?:to\s+)?@?([a-zA-Z0-9_]+)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:php|₱|\$|dollars?|usd)?$/i  // user then amount
/(?:send|transfer|pay)\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:php|₱|\$|dollars?|usd)?\s+(?:to\s+)?@?([a-zA-Z0-9_]+)\s*$/i // amount then user
/(?:send|transfer|pay)\s+(?:to\s+)?@([a-zA-Z0-9_]+)\s*$/i                                                        // user only → ask amount
```

Flow:
1. Recipient + amount → resolve recipient, check balance, open confirmation dialog (`showPaymentConfirm`).
2. Recipient only → store `pendingSendRecipient`, reply asking for the amount; a bare number in the next turn completes it.
3. `confirm` executes the transfer (Partner Transfer API / `send-money`), `cancel` clears pending state.
4. Feature keywords (`mining`, `kyc`, `partner api`, …) → offer "open the page" vs "explain here".
5. `balance` → fresh `wallets` read + optional 7/30-day forecast.
6. Anything else → `callOpenPayAI`.

After a successful transfer, push a `type: "receipt"` message rendered by `AiTransferReceipt` with amount, recipient, real UUID transaction id, new balance, and an OpenLedger link (`/ledger?tx=…`). Never fabricate `TXN…` ids.

### 5.5 UI spec (`/ai`)

- Claude-style two-pane layout; sidebar collapsible with a slide transition and an `X` close button on mobile.
- Sidebar: **New chat**, RECENT list, QUICK ASKS (Check my balance, Send money, Top up wallet, Complete KYC, Start mining, Merchant setup, Stake OUSD, Invite & earn), then Dark mode toggle, Financial insights (badge count), **MCP Actions**, Settings, Back to menu, and a footer profile row (avatar, name, `@username`, live balance → `/profile`).
- Header: brand mark + "OpenPay AI / Financial assistant", right side Dark toggle, Insights, `+ New`.
- Empty state: logo, "Hi, there", subtitle, 2-column suggestion cards (title + description).
- Composer: floating rounded bar, attach/menu button, `Message OpenPay AI…`, send icon.
- Footer disclaimer: *"OpenPay AI can make mistakes. Double-check responses. Payments always need confirmation."*
- Render assistant markdown (`react-markdown`), typing indicator while awaiting the reply, auto-scroll, and optional TTS per message.
- All colors from design tokens so light/dark both work.

---

## 6. MCP: connect OpenPay Pro (and any MCP server)

### 6.1 `mcp-connections` edge function actions

`POST /functions/v1/mcp-connections` with user JWT:

| action | body | result |
|---|---|---|
| `list` | `{}` | `{ connections: [{ id, name, url, state, last_error, created_at }] }` |
| `connect` | `{ name, url }` | discovers OAuth metadata → DCR → PKCE → `{ id, auth_url }` or `{ id, state: "ready" }` if no auth |
| `callback` | `{ id, code, state }` | exchanges code, stores tokens, `state = "ready"` |
| `remove` | `{ id }` | deletes the row |
| `test` | `{ id }` | `mcpListTools` → `{ tools: [...] }` |

### 6.2 OAuth 2.1 flow used

1. `GET {mcpUrl}/.well-known/oauth-protected-resource` → resource metadata → issuer.
2. `GET {issuer}/.well-known/oauth-authorization-server` → `authorization_endpoint`, `token_endpoint`, `registration_endpoint`.
3. **Dynamic Client Registration** (`POST registration_endpoint`) with `redirect_uris: ["<app>/mcp/oauth/callback"]`.
4. **PKCE**: `code_verifier` (43–128 chars) + `S256` challenge, random `oauth_state`; store both on the row.
5. Redirect user to `authorization_endpoint?...`; callback page `/mcp/oauth/callback` posts `{ id, code, state }` back to `mcp-connections`.
6. Token exchange → `access_token`, `refresh_token`, `expires_at`; refresh transparently in `openpay-ai-chat`.

### 6.3 MCP JSON-RPC calls (`_shared/mcp-client.ts`)

Every request **must** send:

```
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <access_token>   // when present
```

Missing `Accept` → HTTP 406 from spec-compliant servers. Handle both JSON and SSE responses.

```jsonc
// tools/list
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
// tools/call
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "list_wallets", "arguments": {} } }
```

A `401` must be surfaced as `unauthorized` so the connection flips to `failed` and the UI shows "Reconnect".

### 6.4 OpenPay's own MCP server (so Pro can consume OpenPay)

Manifest at `/functions/v1/mcp`, OAuth issuer `https://<project-ref>.supabase.co/auth/v1`, audience `authenticated`. Tools: `get_profile`, `get_wallet_balance`, `list_transactions`, `send_money` — identical schemas to §3.4.

### 6.5 Post-connect tutorial UI

Once `state = "ready"`, show a "How to use it in AI" block with copyable prompts, e.g.:

- "List my OpenPay Pro wallets"
- "Show my last 10 Pro ledger entries"
- "Compare my OpenPay balance with my Pro balance"

Tool names appear to the model as `openpay_pro__list_wallets`, `openpay_pro__list_ledger_entries`, `openpay_pro__list_transactions`.

---

## 7. Port checklist for OpenPay Pro

1. Run the SQL in §2 (`ai_chat_history`, `mcp_connections` + grants + RLS).
2. Copy `supabase/functions/_shared/mcp-client.ts`.
3. Create `openpay-ai-chat` (§3) — swap table/column names to Pro's schema (`wallets`, `profiles`, `transactions`/`ledger_entries`).
4. Create `mcp-connections` (§6.1) and the `/mcp/oauth/callback` page.
5. Paste the system prompt (§4), replacing the route table with Pro routes.
6. Build the `/ai` page per §5 (message model, invoke contract, persistence, intent parser, UI).
7. Set secret `LOVABLE_API_KEY`; `verify_jwt = true` for both functions.
8. Verify: balance question hits `get_wallet_balance`; `send to @user 5` shows a confirmation dialog and never auto-sends; connecting OpenPay's MCP URL exposes `openpay__*` tools inside Pro's AI.

### Model choice

Default `google/gemini-2.5-flash` (chat completions + tools, `temperature: 0.4`). For stronger reasoning use `google/gemini-3.1-pro-preview`; for OpenAI models (`openai/gpt-5.x`) switch to the gateway Responses API (`/v1/responses`) and drop `max_tokens`/`temperature`.
