/** Full markdown prompt for pasting into Lovable (or any AI) to integrate OpenPay. */

export type LovablePromptOpts = {
  site?: string;
  apiBase: string;
  clientId?: string;
};

export function buildOpenPayLovablePrompt(opts: LovablePromptOpts): string {
  const site = opts.site || "https://openpy.space";
  const api = opts.apiBase;
  const clientId = opts.clientId || "YOUR_CLIENT_ID";

  return `# OpenPay Partner API — Lovable Integration Prompt

> **How to use:** Paste this entire prompt into Lovable chat. Replace \`opk_live_YOUR_API_KEY\` with your real key from ${site}/partner-api (shown once at app creation). Client ID below is prefilled when available.

---

## Prompt for Lovable AI

Integrate **OpenPay** into this app using the public Partner Transfer API.

### Official links (always use these — never lovable.app preview URLs)

| What | URL |
|------|-----|
| Site | \`${site}\` |
| Partner portal (keys) | \`${site}/partner-api\` |
| Auth docs | \`${site}/openpay-auth\` |
| API base | \`${api}\` |
| Auth logo | \`${site}/openpay-auth-logo.png\` |
| Consent / authorize | \`${site}/connect\` |

### Credentials (fill these in)

\`\`\`
OPENPAY_CLIENT_ID=${clientId}
OPENPAY_CLIENT_SECRET=opk_live_YOUR_API_KEY
OPENPAY_REDIRECT_URI=https://YOUR_APP_DOMAIN/auth/openpay/callback
\`\`\`

Rules:

- \`opk_live_…\` is **server-only** (never expose in frontend / Vite env for browser).
- Register the **exact** redirect URI on ${site}/partner-api → Apps & keys.
- Currency is **OUSD**. Account lookup accepts \`@username\`, email, or \`OP…\` account number.

---

## What to build (implement all three)

1. **Sign in with OpenPay** (OAuth Authorization Code)
2. **Partner transfers** (server: send OUSD from the partner app owner wallet)
3. **PayButton checkout** (create charge → redirect user to OpenPay hosted checkout)

---

## 1) Sign in with OpenPay

### Flow

1. User clicks **Sign in with OpenPay**
2. Browser goes to OpenPay consent
3. OpenPay redirects back: \`?code=opc_…&state=…\`
4. **Backend** exchanges \`code\` for \`access_token\` (\`opa_live_…\`)
5. Backend calls \`GET /user/me\` and creates/links a local session

### Authorize URL

\`\`\`
${site}/connect
  ?client_id=${clientId}
  &redirect_uri=https://YOUR_APP_DOMAIN/auth/openpay/callback
  &scope=profile
  &state=RANDOM_CSRF_TOKEN
  &response_type=code
\`\`\`

Aliases (same params):

- \`${site}/oauth/authorize\`
- \`${site}/oauth2/authorize\`

### Scopes (space-separated)

| Scope | Gives |
|-------|--------|
| \`profile\` | \`user_id\`, \`account_number\`, \`full_name\`, \`username\`, \`avatar_url\` |
| \`email\` | \`email\` |
| \`balance\` | \`balance\`, \`currency\` |

Recommended for login: \`profile\`. Add \`email\` / \`balance\` only if needed.

### Drop-in button (frontend)

\`\`\`html
<a
  href="${site}/connect?client_id=${clientId}&redirect_uri=https://YOUR_APP_DOMAIN/auth/openpay/callback&scope=profile&state=RANDOM_STATE&response_type=code"
  style="display:inline-flex;align-items:center;gap:10px;background:#1652f0;color:#fff;padding:12px 20px;border-radius:12px;font-weight:600;text-decoration:none;"
>
  <img src="${site}/openpay-auth-logo.png" width="20" height="20" alt="" />
  Sign in with OpenPay
</a>
\`\`\`

### React button component

\`\`\`tsx
export function OpenPayAuthButton({
  clientId,
  redirectUri,
  scope = "profile",
}: {
  clientId: string;
  redirectUri: string;
  scope?: string;
}) {
  const state =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());

  if (typeof window !== "undefined") {
    sessionStorage.setItem("openpay_oauth_state", state);
  }

  const url = new URL("${site}/connect");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  return (
    <a
      href={url.toString()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        background: "#1652f0",
        color: "#fff",
        padding: "12px 20px",
        borderRadius: 12,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      <img
        src="${site}/openpay-auth-logo.png"
        width={20}
        height={20}
        alt=""
      />
      Sign in with OpenPay
    </a>
  );
}
\`\`\`

### Token exchange (backend only)

\`POST ${api}/oauth/token\`

\`\`\`json
{
  "grant_type": "authorization_code",
  "code": "opc_...",
  "redirect_uri": "https://YOUR_APP_DOMAIN/auth/openpay/callback",
  "client_id": "${clientId}",
  "client_secret": "opk_live_YOUR_API_KEY"
}
\`\`\`

Success response:

\`\`\`json
{
  "access_token": "opa_live_...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "scope": "profile",
  "user_id": "uuid"
}
\`\`\`

### User profile

\`GET …/user/me\`
Header: \`Authorization: Bearer opa_live_…\`

\`\`\`json
{
  "user_id": "uuid",
  "account_number": "OP…",
  "full_name": "Alice",
  "username": "alice",
  "avatar_url": "https://…",
  "email": "alice@example.com",
  "balance": 12.5,
  "currency": "OUSD",
  "scope": "profile balance email"
}
\`\`\`

Optional: \`GET …/user/balance\` (requires \`balance\` scope).

### Node / Express callback example

\`\`\`js
const API = "${api}";

app.get("/auth/openpay/callback", async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(String(error));
  // verify state === sessionStorage / cookie you set

  const tokenRes = await fetch(\`\${API}/oauth/token\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OPENPAY_REDIRECT_URI,
      client_id: process.env.OPENPAY_CLIENT_ID,
      client_secret: process.env.OPENPAY_CLIENT_SECRET,
    }),
  });
  const token = await tokenRes.json();
  if (!tokenRes.ok) return res.status(400).json(token);

  const meRes = await fetch(\`\${API}/user/me\`, {
    headers: { Authorization: \`Bearer \${token.access_token}\` },
  });
  const me = await meRes.json();

  // Create or link local user by me.user_id / me.username
  // Set your session cookie, then redirect into the app
  res.redirect("/");
});
\`\`\`

### Lovable / Vite note

If this project has **no custom backend**, add a **Supabase Edge Function** (or other server route) named e.g. \`openpay-oauth-callback\` that:

1. Accepts \`code\` + \`redirect_uri\`
2. Exchanges for token using \`OPENPAY_CLIENT_SECRET\` from secrets
3. Returns \`{ access_token, me }\` to the client **or** sets a session

Never put \`opk_live_…\` in \`VITE_*\` env vars.

---

## 2) Partner transfers (app wallet → OpenPay user)

Auth header on all partner endpoints:

\`\`\`
Authorization: Bearer opk_live_YOUR_API_KEY
\`\`\`

API base:

\`\`\`
${api}
\`\`\`

### Useful GETs

\`\`\`bash
curl -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  ${api}/me

curl -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  ${api}/balance

curl -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  ${api}/accounts/@satoshi
\`\`\`

### Send transfer

\`\`\`bash
curl -X POST "${api}/transfers" \\
  -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique-request-id-123" \\
  -d '{
    "to": "@username",
    "amount": 5.00,
    "note": "Payout from MyApp"
  }'
\`\`\`

\`to\` can be \`@username\`, email, or \`OP…\` account number.
Funds debit the **partner app owner** OpenPay wallet.

### Server helper (TypeScript)

\`\`\`ts
const OPENPAY_API = "${api}";

export async function openpayTransfer(opts: {
  apiKey: string;
  to: string;
  amount: number;
  note?: string;
  idempotencyKey?: string;
}) {
  const res = await fetch(\`\${OPENPAY_API}/transfers\`, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${opts.apiKey}\`,
      "Content-Type": "application/json",
      ...(opts.idempotencyKey
        ? { "Idempotency-Key": opts.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      to: opts.to,
      amount: opts.amount,
      note: opts.note ?? "",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Transfer failed");
  return data;
}
\`\`\`

---

## 3) PayButton checkout (hosted payment page)

Create a charge on your **server**, then send the user to \`checkout_url\`.

### Create charge

\`\`\`bash
curl -X POST "${api}/charges" \\
  -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 10.00,
    "currency": "OUSD",
    "description": "Pro plan",
    "reference": "order_123",
    "success_url": "https://YOUR_APP_DOMAIN/pay/success",
    "cancel_url": "https://YOUR_APP_DOMAIN/pay/cancel",
    "metadata": { "order_id": "123" }
  }'
\`\`\`

Example 201 response:

\`\`\`json
{
  "id": "CHARGE_UUID",
  "amount": 10,
  "currency": "OUSD",
  "status": "created",
  "expires_at": "…",
  "checkout_url": "${site}/paybutton/CHARGE_UUID",
  "success_url": "https://YOUR_APP_DOMAIN/pay/success",
  "cancel_url": "https://YOUR_APP_DOMAIN/pay/cancel"
}
\`\`\`

### Frontend pay button

\`\`\`html
<a
  href="${site}/paybutton/CHARGE_UUID"
  style="display:inline-flex;align-items:center;gap:8px;background:#1652f0;color:#fff;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;"
>
  <img src="${site}/openpay-auth-logo.png" width="16" height="16" alt="" />
  Pay with OpenPay
</a>
\`\`\`

### Poll / verify payment (server)

\`\`\`bash
curl -H "Authorization: Bearer opk_live_YOUR_API_KEY" \\
  ${api}/charges/CHARGE_UUID
\`\`\`

Statuses: \`created\` · \`paid\` · \`canceled\` · (expired when past \`expires_at\`)

Cancel unpaid:

\`\`\`bash
curl -X POST "${api}/charges/CHARGE_UUID/cancel" \\
  -H "Authorization: Bearer opk_live_YOUR_API_KEY"
\`\`\`

### Recommended app flow for PayButton

1. User clicks **Buy** in your UI
2. Your edge function / API creates a charge with \`success_url\` / \`cancel_url\`
3. Return \`checkout_url\` to the client and \`window.location = checkout_url\`
4. On success page, optionally re-fetch charge by \`reference\` / \`id\` and unlock the product when \`status === "paid"\`

---

## Full API map

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | \`/\` or \`/health\` | none | Service info |
| POST | \`/oauth/token\` | body: client_id + opk secret | Exchange auth code |
| GET | \`/user/me\` | \`opa_…\` | Signed-in user (scope-aware) |
| GET | \`/user/balance\` | \`opa_…\` + balance scope | User balance |
| GET | \`/me\` | \`opk_…\` | Partner app + owner account |
| GET | \`/balance\` | \`opk_…\` | Owner wallet balance |
| GET | \`/accounts/:id\` | \`opk_…\` | Lookup OpenPay user |
| POST | \`/transfers\` | \`opk_…\` | Send OUSD |
| GET | \`/transfers\` | \`opk_…\` | List transfers |
| POST | \`/charges\` | \`opk_…\` | Create PayButton charge |
| GET | \`/charges/:id\` | \`opk_…\` | Charge status |
| GET | \`/charges\` | \`opk_…\` | List charges |
| POST | \`/charges/:id/cancel\` | \`opk_…\` | Cancel unpaid charge |

### Error codes

| HTTP | Meaning |
|------|---------|
| 401 | Missing/invalid \`opk_\` or \`opa_\` token |
| 403 | Origin not allowed / insufficient OAuth scope |
| 404 | Account / charge / route not found |
| 400 | Validation / business error (\`error\` string in JSON) |

---

## Security checklist (must follow)

- [ ] Keep \`opk_live_…\` on the server only
- [ ] Validate OAuth \`state\` on callback (CSRF)
- [ ] Register exact redirect URIs (no wildcards)
- [ ] Request only needed scopes (\`profile\` is enough for sign-in)
- [ ] Use \`Idempotency-Key\` on transfers
- [ ] Verify charge \`status === "paid"\` on your server before fulfilling orders
- [ ] Prefer \`${site}\` links in UI (not \`*.lovable.app\`)

---

## Acceptance criteria for this integration

Implement in this codebase:

1. **Sign in with OpenPay** button using the blue \`#1652f0\` style + \`${site}/openpay-auth-logo.png\`
2. Callback route \`/auth/openpay/callback\` that exchanges code **on the server** and loads \`/user/me\`
3. Server helper to create PayButton charges and redirect to \`checkout_url\`
4. (Optional) Server helper for \`/transfers\` payouts
5. Env/secrets: \`OPENPAY_CLIENT_ID\`, \`OPENPAY_CLIENT_SECRET\`, \`OPENPAY_REDIRECT_URI\`
6. Short in-app note linking to ${site}/partner-api for key management

Do not invent alternate API hosts. Use the URLs in this document exactly.
`;
}
