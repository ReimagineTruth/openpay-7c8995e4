/** QR Pay Public API — copy/paste integration kit for third parties + AI tools. */

export const QR_PAY_SITE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
  "https://openpy.space";

export const QR_PAY_API_BASE = `${
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "https://araojncyittkahvvpdrn.supabase.co"
}/functions/v1/qr-pay-api`;

export const QR_PAY_API_DOCS_PATH = "/qr-pay/api";

export const OPENLEDGER_SITE_DOCS =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_OPENLEDGER_SITE_URL) ||
  "https://openpyledger.space";

export type QrPayKitOpts = {
  site?: string;
  apiBase?: string;
  apiKey?: string;
  qrToken?: string;
  openLedgerSite?: string;
};

const defaults = (opts: QrPayKitOpts = {}) => ({
  site: opts.site || QR_PAY_SITE,
  api: opts.apiBase || QR_PAY_API_BASE,
  key: opts.apiKey || "qpk_live_YOUR_API_KEY",
  token: opts.qrToken || "QR_TOKEN",
  ledger: opts.openLedgerSite || OPENLEDGER_SITE_DOCS,
});

/** Beginner step-by-step guide (markdown). */
export function buildQrPayQuickStart(opts: QrPayKitOpts = {}): string {
  const { site, api, key, token } = defaults(opts);
  return `# OpenPay QR Pay — Quick start (beginners)

Do these steps in order. Takes ~10 minutes.

## 1) Create a QR Pay link
1. Sign in at ${site}
2. Open **QR Pay → New**
3. Add title, amount/currency, payment methods
4. Create → copy the **token** from the share URL  
   Example: \`${site}/qr-pay/${token}\` → token is \`${token}\`

## 2) Create an API key
1. Open ${site}${QR_PAY_API_DOCS_PATH}
2. Click **+ New API key**
3. Name it (e.g. "My store")
4. **Copy the key once** (\`qpk_live_…\`) — it is only shown once

## 3) Store secrets (never commit)
\`\`\`
OPENPAY_QR_API_KEY=${key}
OPENPAY_QR_API_BASE=${api}
OPENPAY_SITE=${site}
\`\`\`

- Browser apps: only use a **server** proxy for the secret key, OR a restricted key you accept may leak.
- Best practice: call the API from your backend / Edge Function.

## 4) Test with cURL
\`\`\`bash
curl -s "${api}/health"

curl -s "${api}/qr/${token}" \\
  -H "x-api-key: ${key}"
\`\`\`

## 5) Open hosted checkout (Stripe-style)
\`\`\`bash
curl -s -X POST "${api}/checkout-session" \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "qr_pay_token": "${token}",
    "customer_email": "buyer@example.com",
    "customer_name": "Jane Doe",
    "success_url": "https://YOUR_APP/thank-you",
    "cancel_url": "https://YOUR_APP/cart"
  }'
\`\`\`
Redirect the buyer to \`checkout_url\` from the response.

## 6) After payment — verify
\`\`\`bash
curl -s "${api}/transactions/by-ref/QRP-XXXXXXXXXXXX" \\
  -H "x-api-key: ${key}"
\`\`\`
Only fulfill the order when \`transaction.status === "succeeded"\`.

## Auth model (simple)
| Need | Use |
|------|-----|
| Read / pay **your** QR codes from another app | \`x-api-key: qpk_live_…\` |
| Sign users into OpenPay (OAuth) | Partner API client id + secret at ${site}/partner-api |
| No OAuth required for basic QR Pay checkout | API key only |

No client id is required for the QR Pay Public API — only the \`qpk_live_\` key.
`;
}

/** Full API reference (complete field schemas + examples). */
export function buildQrPayApiReference(opts: QrPayKitOpts = {}): string {
  const { site, api, key, token, ledger } = defaults(opts);
  return `# OpenPay QR Pay Public API — Full documentation

Base URL: \`${api}\`
Docs & keys UI: \`${site}${QR_PAY_API_DOCS_PATH}\`
Hosted checkout: \`${site}/qr-pay/{token}\`
OpenLedger explorer: \`${ledger}/tx/ref/{transaction_ref}\`
API version: \`1.1.0\` (see \`GET /health\`)

---

## Overview

OpenPay QR Pay Public API lets any app (Shopify, Lovable, custom store, POS) create hosted checkouts for **your** QR payment links and verify paid orders — Stripe-style.

Flow:
1. Merchant creates a QR Pay link in OpenPay → gets a \`token\`
2. Merchant creates an API key at ${site}${QR_PAY_API_DOCS_PATH} → \`qpk_live_…\`
3. Your server calls \`POST /checkout-session\` → redirect buyer to \`checkout_url\`
4. Buyer pays on OpenPay (wallet, card, GCash, Maya, Google Pay, Pi, OpenPay Pro, …)
5. Buyer returns to your \`success_url\` with \`ref=QRP-…\`
6. Your server verifies with \`GET /transactions/by-ref/{ref}\`
7. Optional: open the immutable receipt on OpenLedger using the same \`QRP-…\` as \`external_ref\`

---

## Authentication

All endpoints **except** \`GET /health\` require:

\`\`\`
x-api-key: ${key}
\`\`\`

| Rule | Detail |
|------|--------|
| Format | \`qpk_live_<prefix>_<secret>\` |
| Issue | ${site}${QR_PAY_API_DOCS_PATH} → **+ New API key** |
| Scope | Key can only access **your** QR payments & transactions |
| Revoke | Dashboard → trash icon (apps using it stop immediately) |
| Logging | Every call is logged (endpoint, status, latency) |

Do **not** put production keys in browser bundles. Use a Node/Express/Edge proxy.

CORS is enabled for prototypes. Prefer server-side calls in production.

---

## Endpoints

### GET /health
Public. No API key.

**Response 200**
\`\`\`json
{
  "status": "ok",
  "service": "qr-pay-api",
  "version": "1.1.0",
  "docs": "${site}${QR_PAY_API_DOCS_PATH}",
  "site": "${site}",
  "endpoints": [
    "GET  /health",
    "GET  /qr",
    "GET  /qr/:token",
    "GET  /qr/:token/checkout-url",
    "POST /checkout-session",
    "GET  /transactions",
    "GET  /transactions/:id",
    "GET  /transactions/by-ref/:transaction_ref"
  ],
  "timestamp": "2026-08-08T00:00:00.000Z"
}
\`\`\`

---

### GET /qr
List QR payments owned by the API key owner (max 100, newest first).

**Headers:** \`x-api-key\`

**Response 200**
\`\`\`json
{
  "qr_payments": [
    {
      "id": "uuid",
      "token": "${token}",
      "title": "Coffee + tip",
      "total": 10.5,
      "amount": 10.5,
      "currency": "USD",
      "payment_type": "product",
      "type": "product",
      "status": "active",
      "created_at": "ISO-8601"
    }
  ],
  "count": 1
}
\`\`\`

Notes:
- \`amount\` is an alias of \`total\`
- \`type\` is an alias of \`payment_type\`
- \`status\` is typically \`active\` or inactive/archived values used by the dashboard

---

### GET /qr/{token}
Read one QR Pay + line items (must be yours).

**Headers:** \`x-api-key\`

**Response 200**
\`\`\`json
{
  "qr_pay": {
    "id": "uuid",
    "merchant_user_id": "uuid",
    "user_id": "uuid",
    "token": "${token}",
    "title": "Coffee + tip",
    "description": "Optional",
    "total": 10.5,
    "amount": 10.5,
    "subtotal": 10,
    "currency": "USD",
    "payment_type": "product",
    "type": "product",
    "status": "active",
    "cover_image_url": "https://…",
    "image_url": "https://…",
    "reusable": true,
    "allow_custom_amount": false,
    "min_amount": null,
    "suggested_amount": null,
    "created_at": "ISO-8601"
  },
  "items": [
    {
      "id": "uuid",
      "name": "Latte",
      "description": null,
      "unit_price": 5,
      "price": 5,
      "quantity": 2,
      "line_total": 10,
      "image_url": null
    }
  ]
}
\`\`\`

**Errors:** \`404\` QR payment not found (or not yours)

---

### GET /qr/{token}/checkout-url
Convenience helper — returns hosted checkout URL (no customer prefill).

**Response 200**
\`\`\`json
{
  "token": "${token}",
  "checkout_url": "${site}/qr-pay/${token}"
}
\`\`\`

Prefer \`POST /checkout-session\` when you need \`success_url\`, \`cancel_url\`, or customer prefill.

---

### POST /checkout-session
Create a Stripe-style checkout session and get a redirect URL.

**Headers:** \`x-api-key\`, \`Content-Type: application/json\`

**Body**
\`\`\`json
{
  "qr_pay_token": "${token}",
  "customer_email": "buyer@example.com",
  "customer_name": "Jane Doe",
  "success_url": "https://YOUR_APP/thank-you",
  "cancel_url": "https://YOUR_APP/cart"
}
\`\`\`

| Field | Required | Notes |
|-------|----------|-------|
| \`qr_pay_token\` | yes | Token from \`${site}/qr-pay/{token}\` |
| \`customer_email\` | no | Prefills checkout \`?email=\` |
| \`customer_name\` | no | Prefills checkout \`?name=\` |
| \`success_url\` | no | After pay, buyer is sent here with query params |
| \`cancel_url\` | no | Passed through to hosted checkout |

**Response 200**
\`\`\`json
{
  "id": "uuid",
  "qr_pay_token": "${token}",
  "amount": 10.5,
  "currency": "USD",
  "title": "Coffee + tip",
  "checkout_url": "${site}/qr-pay/${token}?email=buyer%40example.com&name=Jane%20Doe&success_url=…&cancel_url=…",
  "expires_at": "ISO-8601"
}
\`\`\`

Redirect the browser to \`checkout_url\`. Session hint expires in ~1 hour (\`expires_at\`); the underlying QR link remains reusable if configured as reusable.

**Errors**
- \`400\` missing \`qr_pay_token\` / QR not active
- \`404\` QR not found / not yours

---

### GET /transactions?limit=50
List recent transactions for your merchant account.

**Query**
| Param | Default | Max |
|-------|---------|-----|
| \`limit\` | 50 | 100 |

**Response 200**
\`\`\`json
{
  "transactions": [
    {
      "id": "uuid",
      "qr_payment_id": "uuid",
      "amount": 10.5,
      "currency": "USD",
      "status": "succeeded",
      "method": "gcash",
      "payment_method": "gcash",
      "payer_email": "buyer@example.com",
      "customer_email": "buyer@example.com",
      "payer_name": "Jane Doe",
      "customer_name": "Jane Doe",
      "transaction_ref": "QRP-AB12CD34EF56",
      "paid_at": "ISO-8601",
      "created_at": "ISO-8601"
    }
  ],
  "count": 1
}
\`\`\`

---

### GET /transactions/{id}
Fetch one transaction by UUID.

**Response 200:** \`{ "transaction": { … } }\`  
**Errors:** \`404\`

---

### GET /transactions/by-ref/{transaction_ref}
**Primary verification endpoint.** Fetch by OpenPay order reference (\`QRP-…\`).

Example: \`GET ${api}/transactions/by-ref/QRP-AB12CD34EF56\`

**Response 200**
\`\`\`json
{
  "transaction": {
    "id": "uuid",
    "amount": 10.5,
    "currency": "USD",
    "status": "succeeded",
    "method": "gcash",
    "payment_method": "gcash",
    "payer_email": "buyer@example.com",
    "customer_email": "buyer@example.com",
    "payer_name": "Jane Doe",
    "customer_name": "Jane Doe",
    "transaction_ref": "QRP-AB12CD34EF56",
    "paid_at": "ISO-8601",
    "created_at": "ISO-8601"
  }
}
\`\`\`

Fulfill only when \`status === "succeeded"\`.

---

## Return URL callbacks

When you pass \`success_url\` to \`POST /checkout-session\`, after a successful payment OpenPay redirects the buyer to your URL and appends:

| Query param | Example | Meaning |
|-------------|---------|---------|
| \`openpay_return\` | \`1\` | Payment completed return |
| \`ref\` | \`QRP-…\` | Same as transaction_ref |
| \`transaction_ref\` | \`QRP-…\` | Canonical order id |
| \`token\` | QR token | Which QR was paid |
| \`method\` | \`gcash\` | Payment rail used |

Example thank-you URL:
\`\`\`
https://YOUR_APP/thank-you?openpay_return=1&ref=QRP-AB12CD34EF56&transaction_ref=QRP-AB12CD34EF56&token=${token}&method=gcash
\`\`\`

On your thank-you page (server-side):
1. Read \`ref\` or \`transaction_ref\`
2. Call \`GET /transactions/by-ref/{ref}\` with your API key
3. Confirm \`status === "succeeded"\` and amount/currency match
4. Mark order paid / deliver goods

If no \`success_url\` is set, OpenPay shows \`${site}/qr-pay/{token}/success?ref=QRP-…\`.

---

## Payment methods (hosted checkout)

Methods available depend on the QR link settings and platform admin toggles. Common rails:

| Method code | Label |
|-------------|-------|
| \`wallet\` | OpenPay wallet |
| \`virtual_card\` | OpenPay virtual card |
| \`pi\` | Pi Network |
| \`pro\` | OpenPay Pro |
| \`gcash\` | GCash (PayMongo) |
| \`maya\` | Maya (PayMongo) |
| \`grab_pay\` | GrabPay (PayMongo) |
| \`shopeepay\` | ShopeePay (PayMongo) |
| \`qrph\` | QR Ph (PayMongo) |
| \`billease\` | BillEase BNPL |
| \`bank\` / bank rails | Online banking |
| \`google_pay\` | Google Pay |

Your integration does **not** call these rails directly — OpenPay hosted checkout handles them. You only create a session and verify the \`QRP-\` ref afterward.

---

## OpenLedger deep links

Every paid QR order gets a stable \`transaction_ref\` like \`QRP-AB12CD34EF56\`.
That same value is the OpenLedger \`external_ref\`.

| Use | URL |
|-----|-----|
| Public receipt by order | \`${ledger}/tx/ref/{transaction_ref}\` |
| Explorer | \`${ledger}/explorer?source=openpay\` |

Example: \`${ledger}/tx/ref/QRP-AB12CD34EF56\`

Show this link on receipts / thank-you pages so buyers and merchants can audit the payment.

---

## Errors

| Status | Meaning |
|--------|---------|
| 401 | Missing / invalid / revoked API key |
| 404 | QR or transaction not found (or not yours) |
| 400 | Bad request (missing fields, inactive QR) |
| 500 | Server error |

Error body shape:
\`\`\`json
{ "error": "Human readable message" }
\`\`\`

---

## Security checklist

- [ ] API key only in server env / secrets manager
- [ ] Never commit \`qpk_live_\` keys
- [ ] Always verify \`/transactions/by-ref/{ref}\` before fulfillment
- [ ] Match amount + currency to your cart
- [ ] Revoke leaked keys immediately at ${site}${QR_PAY_API_DOCS_PATH}
- [ ] Prefer Node/Express proxy over browser \`x-api-key\`

---

## Partner OAuth (optional)

Not required for QR Pay checkout.
Use ${site}/partner-api only if you need **Sign in with OpenPay**, wallet transfers, or Partner PayButton.
`;
}

/** Universal AI scaffold prompt (Lovable / Cursor / Claude / ChatGPT). */
export function buildQrPayAiPrompt(opts: QrPayKitOpts = {}): string {
  const { site, api, key, token, ledger } = defaults(opts);
  return `Integrate OpenPay QR Pay into my app. Follow this spec exactly.

## Official URLs
- Site: ${site}
- API docs / keys: ${site}${QR_PAY_API_DOCS_PATH}
- API base: ${api}
- Hosted checkout: ${site}/qr-pay/{token}
- OpenLedger receipt: ${ledger}/tx/ref/{transaction_ref}

## Credentials
\`\`\`
OPENPAY_QR_API_KEY=${key}
OPENPAY_QR_API_BASE=${api}
OPENPAY_SITE=${site}
\`\`\`
Never hardcode secrets in client bundles for production. Use a server/proxy when possible.

## Auth
Header only: \`x-api-key: OPENPAY_QR_API_KEY\`
No OAuth client_id is required for QR Pay Public API.

## Endpoints to implement
1. GET  {API}/health
2. GET  {API}/qr/{token} → { qr_pay, items }
3. POST {API}/checkout-session → { checkout_url }
4. GET  {API}/transactions/by-ref/{ref} → verify payment

## Build this UX
1. Component \`<OpenPayPayButton token="${token}" />\`
2. On mount: fetch GET /qr/{token}, show title + currency + amount + loading/error
3. On click: POST /checkout-session with:
   - qr_pay_token
   - customer_email / customer_name (from form if available)
   - success_url = current origin + /thank-you
   - cancel_url = current origin + /cart
4. Redirect browser to checkout_url
5. Thank-you page reads \`ref\` from query, calls GET /transactions/by-ref/{ref}, shows paid/pending
6. Show OpenLedger link: ${ledger}/tx/ref/{ref}

## Style
Clean mobile-first Tailwind. Primary #0070BA. Button label: "Pay with OpenPay".

## Acceptance checks
- [ ] health returns ok
- [ ] qr fetch works with my key
- [ ] checkout redirects to ${site}/qr-pay/…
- [ ] thank-you verifies transaction status === "succeeded"
- [ ] API key only in env / server
- [ ] OpenLedger deep link uses the QRP- ref

Sample QR token to wire first: ${token}
`;
}

/** One pasteable document: quick start + full reference + callbacks + AI prompt. */
export function buildQrPayFullDocumentation(opts: QrPayKitOpts = {}): string {
  return [
    buildQrPayQuickStart(opts),
    "",
    "---",
    "",
    buildQrPayApiReference(opts),
    "",
    "---",
    "",
    buildQrPayWebhookGuide(opts),
    "",
    "---",
    "",
    "# AI scaffold prompt (optional)",
    "",
    buildQrPayAiPrompt(opts),
  ].join("\n");
}

export function buildQrPayCurlSnippet(opts: QrPayKitOpts = {}): string {
  const { api, key, token } = defaults(opts);
  return `# Health
curl -s "${api}/health" | jq

# List your QR payments
curl -s "${api}/qr" \\
  -H "x-api-key: ${key}" | jq

# Read QR
curl -s "${api}/qr/${token}" \\
  -H "x-api-key: ${key}" | jq

# Checkout URL helper
curl -s "${api}/qr/${token}/checkout-url" \\
  -H "x-api-key: ${key}" | jq

# Checkout session
curl -s -X POST "${api}/checkout-session" \\
  -H "x-api-key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "qr_pay_token": "${token}",
    "customer_email": "buyer@example.com",
    "customer_name": "Jane Doe",
    "success_url": "https://YOUR_APP/thank-you",
    "cancel_url": "https://YOUR_APP/cart"
  }' | jq

# List transactions
curl -s "${api}/transactions?limit=10" \\
  -H "x-api-key: ${key}" | jq

# Verify by reference
curl -s "${api}/transactions/by-ref/QRP-XXXXXXXXXXXX" \\
  -H "x-api-key: ${key}" | jq
`;
}

export function buildQrPayJsSnippet(opts: QrPayKitOpts = {}): string {
  const { api, key, token } = defaults(opts);
  return `const API = "${api}";
const KEY = process.env.OPENPAY_QR_API_KEY || "${key}";

export async function getQrPay(token = "${token}") {
  const res = await fetch(\`\${API}/qr/\${token}\`, {
    headers: { "x-api-key": KEY },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { qr_pay, items }
}

export async function createCheckoutSession({
  token = "${token}",
  customer_email,
  customer_name,
  success_url,
  cancel_url,
}) {
  const res = await fetch(\`\${API}/checkout-session\`, {
    method: "POST",
    headers: {
      "x-api-key": KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      qr_pay_token: token,
      customer_email,
      customer_name,
      success_url,
      cancel_url,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { checkout_url, ... }
}

export async function verifyByRef(ref) {
  const res = await fetch(\`\${API}/transactions/by-ref/\${encodeURIComponent(ref)}\`, {
    headers: { "x-api-key": KEY },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { transaction }
}
`;
}

export function buildQrPayReactSnippet(opts: QrPayKitOpts = {}): string {
  const { site, api, token, ledger } = defaults(opts);
  return `import { useEffect, useState } from "react";

const API = import.meta.env.VITE_OPENPAY_QR_API_BASE || "${api}";
// Prefer a server proxy in production. For prototypes only:
const KEY = import.meta.env.VITE_OPENPAY_QR_API_KEY;

export function OpenPayPayButton({ token = "${token}" }) {
  const [qr, setQr] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(\`\${API}/qr/\${token}\`, { headers: { "x-api-key": KEY } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed to load");
        if (alive) setQr(j.qr_pay);
      } catch (e) {
        if (alive) setErr(e.message || "Error");
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const pay = async () => {
    setBusy(true);
    try {
      const r = await fetch(\`\${API}/checkout-session\`, {
        method: "POST",
        headers: { "x-api-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          qr_pay_token: token,
          success_url: window.location.origin + "/thank-you",
          cancel_url: window.location.href,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Checkout failed");
      window.location.href = j.checkout_url;
    } catch (e) {
      setErr(e.message || "Checkout failed");
      setBusy(false);
    }
  };

  if (err) return <p className="text-red-600 text-sm">{err}</p>;
  if (!qr) return <button disabled className="opacity-50">Loading OpenPay…</button>;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={pay}
      className="rounded-xl bg-[#0070BA] px-5 py-3 font-semibold text-white"
    >
      {busy ? "Opening…" : \`Pay \${qr.currency} \${Number(qr.total ?? qr.amount).toFixed(2)} with OpenPay\`}
    </button>
  );
}

// Thank-you: verify + OpenLedger
// const ref = new URLSearchParams(location.search).get("ref");
// GET \${API}/transactions/by-ref/\${ref}
// OpenLedger: ${ledger}/tx/ref/\${ref}

// Optional direct link (no API key needed for buyers):
// <a href={"${site}/qr-pay/" + token}>Open hosted checkout</a>
`;
}

export function buildQrPayNodeSnippet(opts: QrPayKitOpts = {}): string {
  const { api, token } = defaults(opts);
  return `// Node / Express proxy (recommended for production)
import express from "express";

const app = express();
app.use(express.json());

const API = process.env.OPENPAY_QR_API_BASE || "${api}";
const KEY = process.env.OPENPAY_QR_API_KEY;

app.get("/api/openpay/qr/:token", async (req, res) => {
  const r = await fetch(\`\${API}/qr/\${req.params.token}\`, {
    headers: { "x-api-key": KEY },
  });
  const j = await r.json();
  res.status(r.status).json(j);
});

app.post("/api/openpay/checkout", async (req, res) => {
  const r = await fetch(\`\${API}/checkout-session\`, {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      qr_pay_token: req.body.token || "${token}",
      customer_email: req.body.email,
      customer_name: req.body.name,
      success_url: req.body.success_url,
      cancel_url: req.body.cancel_url,
    }),
  });
  const j = await r.json();
  res.status(r.status).json(j);
});

app.get("/api/openpay/verify/:ref", async (req, res) => {
  const r = await fetch(\`\${API}/transactions/by-ref/\${encodeURIComponent(req.params.ref)}\`, {
    headers: { "x-api-key": KEY },
  });
  const j = await r.json();
  res.status(r.status).json(j);
});

app.listen(3001, () => console.log("OpenPay QR proxy on :3001"));
`;
}

export function buildQrPayPythonSnippet(opts: QrPayKitOpts = {}): string {
  const { api, token } = defaults(opts);
  return `import os, requests

API = os.environ.get("OPENPAY_QR_API_BASE", "${api}")
KEY = os.environ["OPENPAY_QR_API_KEY"]

def get_qr(token="${token}"):
    r = requests.get(f"{API}/qr/{token}", headers={"x-api-key": KEY}, timeout=15)
    r.raise_for_status()
    return r.json()

def checkout(token="${token}", email=None, name=None, success_url=None, cancel_url=None):
    r = requests.post(
        f"{API}/checkout-session",
        headers={"x-api-key": KEY, "Content-Type": "application/json"},
        json={
            "qr_pay_token": token,
            "customer_email": email,
            "customer_name": name,
            "success_url": success_url,
            "cancel_url": cancel_url,
        },
        timeout=15,
    )
    r.raise_for_status()
    return r.json()

def verify(ref: str):
    r = requests.get(f"{API}/transactions/by-ref/{ref}", headers={"x-api-key": KEY}, timeout=15)
    r.raise_for_status()
    return r.json()
`;
}

export function buildQrPayPhpSnippet(opts: QrPayKitOpts = {}): string {
  const { api, token } = defaults(opts);
  return `<?php
$api = getenv('OPENPAY_QR_API_BASE') ?: '${api}';
$key = getenv('OPENPAY_QR_API_KEY');
$token = '${token}';

$ch = curl_init("$api/qr/" . urlencode($token));
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ["x-api-key: $key"],
]);
$qr = json_decode(curl_exec($ch), true);
curl_close($ch);

$ch = curl_init("$api/checkout-session");
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => ["x-api-key: $key", "Content-Type: application/json"],
  CURLOPT_POSTFIELDS => json_encode([
    "qr_pay_token" => $token,
    "customer_email" => "buyer@example.com",
    "success_url" => "https://YOUR_APP/thank-you",
    "cancel_url" => "https://YOUR_APP/cart",
  ]),
]);
$session = json_decode(curl_exec($ch), true);
curl_close($ch);

header("Location: " . $session["checkout_url"]);
`;
}

export function buildQrPayEnvSnippet(opts: QrPayKitOpts = {}): string {
  const { site, api, key } = defaults(opts);
  return `# OpenPay QR Pay
OPENPAY_SITE=${site}
OPENPAY_QR_API_BASE=${api}
OPENPAY_QR_API_KEY=${key}

# Optional browser prototype only (prefer server proxy):
# VITE_OPENPAY_QR_API_BASE=${api}
# VITE_OPENPAY_QR_API_KEY=${key}
`;
}

export function buildQrPayWebhookGuide(opts: QrPayKitOpts = {}): string {
  const { site, api, ledger } = defaults(opts);
  return `# Callbacks & verification (no complex OAuth)

## A) Return URL callback (easiest)
1. Pass \`success_url\` + \`cancel_url\` to POST /checkout-session
2. After payment, buyer lands on your success_url
3. Read \`ref\` or \`transaction_ref\` from the query string
4. Server-side verify:
   GET ${api}/transactions/by-ref/{ref}
   Header: x-api-key: YOUR_KEY
5. Only fulfill the order if \`transaction.status === "succeeded"\`
6. Optional receipt: ${ledger}/tx/ref/{ref}

## B) Polling
While the buyer is on OpenPay checkout (another tab), poll:
GET ${api}/transactions?limit=5
Match by amount / time / payer email.

## C) Partner OAuth (only if you need Sign in with OpenPay)
Not required for QR Pay checkout.
Use ${site}/partner-api for client_id + client_secret if you need user login / wallet transfers.
`;
}
