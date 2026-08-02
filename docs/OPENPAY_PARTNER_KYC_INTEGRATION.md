# OpenPay Partner KYC Integration (for OpenPay Pro)

Connected platforms submit KYC applications into **OpenPay**, where the OpenPay
core admin reviews them at `/admin-kyc-review`. Decisions are pushed back to the
partner via signed webhooks and can also be polled.

- **Base URL:** `https://araojncyittkahvvpdrn.supabase.co/functions/v1/kyc-partner-api`
- **Auth:** `Authorization: Bearer opk_live_...` (partner API key created in OpenPay → `/partner-api`)
- **Content type:** `application/json`
- **Webhook signature secret:** `sha256_hex(your_api_key)`

---

## 1. How the flow works

```
OpenPay Pro user submits KYC
        │
        ▼
POST /applications  ──────────────►  OpenPay kyc_applications (source = "partner")
                                              │
                                              ▼
                                     Admin reviews at /admin-kyc-review
                                              │
             approved / rejected / additional_info_required
                                              │
        ◄──── POST callback_url (signed) ─────┘
        │
   Update your local user record
```

Statuses: `pending` → `under_review` → `approved` | `rejected` | `additional_info_required`.

---

## 2. Endpoints

### `GET /health`
No auth. Returns service metadata and the endpoint list.

### `POST /applications` — submit an application

```jsonc
{
  "external_user_id": "pro_user_9f31",        // required — your user id
  "external_ref": "pro_user_9f31",            // optional, defaults to external_user_id (idempotency key)
  "callback_url": "https://openpaypro.space/api/public/openpay/kyc-webhook",
  "openpay_user_id": null,                     // optional: link to an existing OpenPay account

  "full_name": "Jane Doe",
  "date_of_birth": "1994-03-12",
  "nationality": "PH",
  "residential_address": "12 Rizal St, Manila",
  "phone_number": "+639171234567",
  "email": "jane@example.com",
  "occupation": "Software Engineer",
  "employer_name": "Acme Inc",

  "source_of_funds": "employment",             // employment|business|investments|inheritance|savings|other
  "annual_income_range": "25000-50000",        // 0-25000|25000-50000|50000-100000|100000-250000|250000+
  "political_exposure": false,

  "id_document_type": "passport",              // passport|national_id|drivers_license|residence_permit
  "id_document_number": "P1234567",
  "id_document_issue_date": "2021-01-05",
  "id_document_expiry_date": "2031-01-05",

  "documents": {
    "id_front":  { "data_base64": "<base64>", "content_type": "image/jpeg" },
    "id_back":   { "data_base64": "<base64>", "content_type": "image/jpeg" },
    "selfie":    { "data_base64": "<base64>", "content_type": "image/jpeg" },
    "proof_of_address": { "url": "https://cdn.example.com/poa.pdf" }
  },

  "liveness_passed": true,
  "liveness_score": 0.97,
  "metadata": { "plan": "business", "tier": 2 }
}
```

Responses:
- `201` — created, returns the application object.
- `200` with `"idempotent": true` — an application already exists for
  `(your app, external_ref)`; nothing was duplicated.
- `422` — `{ "error": "Missing required fields", "missing": [...] }`.

Documents are stored in OpenPay's **private** `kyc-documents` bucket; only OpenPay
admins can open them (signed URLs, 1 hour).

### `POST /applications/:application_id/resubmit`
Same body. Use after `rejected` or `additional_info_required`; resets the
application to `pending` with the new data.

### `GET /applications?limit=25&status=approved&external_user_id=pro_user_9f31`
Lists only *your* applications (scoped by API key).

### `GET /applications/:application_id`
Single application.

### `GET /users/:external_user_id`
Latest status for one of your users. If never submitted:

```json
{ "external_user_id": "pro_user_9f31", "status": "not_submitted", "verified": false }
```

Otherwise the full application plus `"verified": true|false`.

### `GET /events/:application_id`
Webhook delivery log (last 50): `event_type`, `delivered`, `response_status`, `created_at`.

---

## 3. Application object

```json
{
  "application_id": "uuid",
  "status": "approved",
  "source": "partner",
  "external_user_id": "pro_user_9f31",
  "external_ref": "pro_user_9f31",
  "openpay_user_id": null,
  "applicant": { "full_name": "...", "date_of_birth": "...", "nationality": "...",
                 "residential_address": "...", "phone_number": "...", "email": "...",
                 "occupation": "...", "employer_name": "..." },
  "financial": { "source_of_funds": "employment", "annual_income_range": "25000-50000",
                 "political_exposure": false },
  "document": { "type": "passport", "number": "P1234567", "issue_date": "...",
                "expiry_date": "...", "has_front": true, "has_back": true,
                "has_selfie": true, "has_proof_of_address": false },
  "review": { "rejection_reason": null, "admin_notes": null, "reviewed_at": "..." },
  "metadata": {},
  "callback_url": "https://...",
  "submitted_at": "2026-08-02T09:00:00Z",
  "updated_at": "2026-08-02T10:12:00Z"
}
```

---

## 4. Webhooks

Fired to `callback_url` whenever an OpenPay admin decides an application.

Headers:
- `X-OpenPay-Event: kyc.approved | kyc.rejected | kyc.additional_info_required | kyc.under_review`
- `X-OpenPay-Signature: sha256=<hmac_hex>`

Body:

```json
{
  "id": "evt-uuid",
  "type": "kyc.approved",
  "created_at": "2026-08-02T10:12:00Z",
  "data": { /* application object above */ }
}
```

### Verifying the signature (Deno / Supabase edge function)

```ts
const API_KEY = Deno.env.get("OPENPAY_KYC_API_KEY")!; // opk_live_...

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const raw = await req.text();
  const secret = await sha256Hex(API_KEY);            // signing secret
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const got = (req.headers.get("X-OpenPay-Signature") || "").replace("sha256=", "");
  if (got !== expected) return new Response("bad signature", { status: 401 });

  const event = JSON.parse(raw);
  // event.data.external_user_id → your user; event.type → decision
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Respond `2xx` quickly. Deliveries are logged and can be replayed by the OpenPay admin.

---

## 5. Suggested OpenPay Pro schema

```sql
CREATE TABLE public.openpay_kyc_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  application_id uuid,
  external_ref text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'not_submitted',
  rejection_reason text,
  admin_notes text,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.openpay_kyc_links TO authenticated;
GRANT ALL ON public.openpay_kyc_links TO service_role;
ALTER TABLE public.openpay_kyc_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own KYC link"
ON public.openpay_kyc_links FOR SELECT TO authenticated
USING (user_id = auth.uid());
```

Writes happen only from your edge functions (service role): the submit call and
the webhook handler.

---

## 6. Client snippet (OpenPay Pro edge function)

```ts
const BASE = "https://araojncyittkahvvpdrn.supabase.co/functions/v1/kyc-partner-api";
const KEY = Deno.env.get("OPENPAY_KYC_API_KEY")!;

export async function submitKyc(payload: Record<string, unknown>) {
  const res = await fetch(`${BASE}/applications`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "KYC submit failed");
  return data;
}

export async function getKycStatus(externalUserId: string) {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(externalUserId)}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  return res.json();
}
```

---

## 7. Errors

| Status | Meaning |
| --- | --- |
| 401 | Missing/invalid/revoked API key |
| 403 | Admin-only endpoint |
| 404 | Application not found (or not owned by your app) |
| 422 | Validation failed — see `missing[]` |
| 500 | Unexpected server error |

## 8. Checklist

1. Create a partner app in OpenPay → `/partner-api`, copy the `opk_live_...` key.
2. Store it in OpenPay Pro as `OPENPAY_KYC_API_KEY` (never expose to the browser).
3. Deploy your webhook endpoint, then pass it as `callback_url` on submit.
4. Submit applications from your KYC form (base64 documents).
5. Poll `GET /users/:external_user_id` on login as a safety net.
6. OpenPay admin reviews at `/admin-kyc-review` — partner submissions show a **PARTNER** badge.
