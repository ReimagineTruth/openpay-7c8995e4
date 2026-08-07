/** QR Pay Public API — copy/paste integration kit for third parties + AI tools. */

export const QR_PAY_SITE =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
  "https://openpy.space";

export const QR_PAY_API_BASE = `${
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "https://araojncyittkahvvpdrn.supabase.co"
}/functions/v1/qr-pay-api`;

export const QR_PAY_API_DOCS_PATH = "/qr-pay/api";

export type QrPayKitOpts = {
  site?: string;
  apiBase?: string;
  apiKey?: string;
  qrToken?: string;
};

const defaults = (opts: QrPayKitOpts = {}) => ({
  site: opts.site || QR_PAY_SITE,
  api: opts.apiBase || QR_PAY_API_BASE,
  key: opts.apiKey || "qpk_live_YOUR_API_KEY",
  token: opts.qrToken || "QR_TOKEN",
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
Poll or look up:
\`\`\`bash
curl -s "${api}/transactions?limit=10" \\
  -H "x-api-key: ${key}"
\`\`\`
Or open \`success_url\` with OpenPay query params when the buyer finishes.

## Auth model (simple)
| Need | Use |
|------|-----|
| Read / pay **your** QR codes from another app | \`x-api-key: qpk_live_…\` |
| Sign users into OpenPay (OAuth) | Partner API client id + secret at ${site}/partner-api |
| No OAuth required for basic QR Pay checkout | API key only |

No client id is required for the QR Pay Public API — only the \`qpk_live_\` key.
`;
}

/** Full API reference. */
export function buildQrPayApiReference(opts: QrPayKitOpts = {}): string {
  const { site, api, key, token } = defaults(opts);
  return `# OpenPay QR Pay Public API

Base URL: \`${api}\`
Docs UI: \`${site}${QR_PAY_API_DOCS_PATH}\`

## Authentication
All endpoints except \`GET /health\` require:
\`\`\`
x-api-key: ${key}
\`\`\`

Keys are issued at ${site}${QR_PAY_API_DOCS_PATH}. Format: \`qpk_live_<prefix>_<secret>\`.

## Endpoints

### GET /health
Public. Returns service status + endpoint list.

### GET /qr
List QR payments owned by the API key owner.
Response: \`{ qr_payments: [...], count }\`

### GET /qr/{token}
Read one QR Pay + line items (must be yours).
Response: \`{ qr_pay, items }\`

### GET /qr/{token}/checkout-url
Returns \`{ token, checkout_url }\` for hosted checkout.

### POST /checkout-session
Create a Stripe-style checkout session.

Body:
\`\`\`json
{
  "qr_pay_token": "${token}",
  "customer_email": "buyer@example.com",
  "customer_name": "Jane Doe",
  "success_url": "https://YOUR_APP/thank-you",
  "cancel_url": "https://YOUR_APP/cart"
}
\`\`\`

Response:
\`\`\`json
{
  "id": "uuid",
  "qr_pay_token": "${token}",
  "amount": 10,
  "currency": "USD",
  "title": "…",
  "checkout_url": "${site}/qr-pay/${token}?…",
  "expires_at": "ISO-8601"
}
\`\`\`

Redirect the customer to \`checkout_url\`.

### GET /transactions?limit=50
List recent successful/paid transactions for your merchant account.

### GET /transactions/{id}
Fetch one transaction by UUID (verify payment).

### GET /transactions/by-ref/{transaction_ref}
Fetch one transaction by \`QRP-…\` reference (verify payment).

## Callbacks / return URLs
Pass \`success_url\` and \`cancel_url\` into \`POST /checkout-session\`.
After payment, OpenPay may append:
- \`openpay_return=1\`
- \`ref\` / \`transaction_ref\`
- \`token\`

On your thank-you page, call \`GET /transactions/by-ref/{ref}\` with your API key to confirm \`status=succeeded\`.

## Errors
| Status | Meaning |
|--------|---------|
| 401 | Missing/invalid/revoked API key |
| 404 | QR or transaction not found (or not yours) |
| 400 | Bad request (missing fields) |
| 500 | Server error |

## CORS
Enabled for browser prototypes. Prefer server-side calls in production.
`;
}

/** Universal AI scaffold prompt (Lovable / Cursor / Claude / ChatGPT). */
export function buildQrPayAiPrompt(opts: QrPayKitOpts = {}): string {
  const { site, api, key, token } = defaults(opts);
  return `Integrate OpenPay QR Pay into my app. Follow this spec exactly.

## Official URLs
- Site: ${site}
- API docs / keys: ${site}${QR_PAY_API_DOCS_PATH}
- API base: ${api}
- Hosted checkout: ${site}/qr-pay/{token}

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

## Style
Clean mobile-first Tailwind. Primary #0070BA. Button label: "Pay with OpenPay".

## Acceptance checks
- [ ] health returns ok
- [ ] qr fetch works with my key
- [ ] checkout redirects to ${site}/qr-pay/…
- [ ] thank-you verifies transaction
- [ ] API key only in env / server

Sample QR token to wire first: ${token}
`;
}

export function buildQrPayCurlSnippet(opts: QrPayKitOpts = {}): string {
  const { api, key, token } = defaults(opts);
  return `# Health
curl -s "${api}/health" | jq

# Read QR
curl -s "${api}/qr/${token}" \\
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
  const { site, api, token } = defaults(opts);
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
  const { site, api } = defaults(opts);
  return `# Callbacks & verification (no complex OAuth)

## A) Return URL callback (easiest)
1. Pass \`success_url\` + \`cancel_url\` to POST /checkout-session
2. After payment, buyer lands on your success_url
3. Read \`ref\` or \`transaction_ref\` from the query string
4. Server-side verify:
   GET ${api}/transactions/by-ref/{ref}
   Header: x-api-key: YOUR_KEY
5. Only fulfill the order if \`transaction.status === "succeeded"\`

## B) Polling
While the buyer is on OpenPay checkout (another tab), poll:
GET ${api}/transactions?limit=5
Match by amount / time / payer email.

## C) Partner OAuth (only if you need Sign in with OpenPay)
Not required for QR Pay checkout.
Use ${site}/partner-api for client_id + client_secret if you need user login / wallet transfers.
`;
}
