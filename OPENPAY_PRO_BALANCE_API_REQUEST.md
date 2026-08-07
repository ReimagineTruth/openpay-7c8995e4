# OpenPay → OpenPay Pro — Token Balance Integration Request

**From:** OpenPay (`openpy.space` / OpenPay app)  
**To:** OpenPay Pro Wallet team (`openpaypro.space`)  
**Date:** 2026-08-07  
**Priority:** High — required for Dashboard **Assets** live Pro token balances  
**Status today:** Inbound credit works. Portfolio/balance read API is **missing** (404).

---

## 1. Goal

Let OpenPay show a user’s **OpenPay Pro wallet token balances** inside OpenPay (Dashboard → Assets), next to OpenPay-native balances (Wallet / Savings / Mining OUSD).

OpenPay already supports:

| Direction | Status | Endpoint |
|-----------|--------|----------|
| OpenPay → Pro (credit / inbound) | Working | `POST /api/public/openpay/inbound` |
| Pro → OpenPay (read balances) | **Not available** | Need new API below |

---

## 2. What we need from OpenPay Pro

### Primary: Partner Portfolio / Balances API

Expose a **server-to-server** endpoint that returns token balances for a Pro account, authenticated with the same Partner API key pattern as inbound (`Authorization: Bearer opk_…`).

**Proposed URL (either is fine):**

```http
GET  https://openpaypro.space/api/public/openpay/portfolio
POST https://openpaypro.space/api/public/openpay/balances
```

Also mirror on staging if available:

```text
https://openpaypromainnet.lovable.app/api/public/openpay/...
```

### Auth

```http
Authorization: Bearer opk_live_XXXX
Accept: application/json
Content-Type: application/json
```

Same partner key OpenPay already uses for inbound (`OPENPAY_PRO_PARTNER_API_KEY`).

### Lookup (accept any one)

| Field | Example | Notes |
|-------|---------|--------|
| `username` | `alice` or `@alice` | Pro handle |
| `wallet` / `address` | `0xabc…` | 0x + 40 hex |
| `uid` | `uid_…` | If Pro uses internal UIDs |

OpenPay will pass the signed-in user’s linked Pro identity (username preferred).

---

## 3. Request examples

### GET (query)

```http
GET /api/public/openpay/portfolio?username=alice
Authorization: Bearer opk_live_XXXX
```

### POST (body) — preferred for privacy

```http
POST /api/public/openpay/balances
Authorization: Bearer opk_live_XXXX
Content-Type: application/json

{
  "username": "alice"
}
```

or

```json
{ "wallet": "0x1234567890abcdef1234567890abcdef12345678" }
```

---

## 4. Required response shape

OpenPay client code is already written for this shape (`ProPortfolioPayload`):

```json
{
  "ok": true,
  "username": "alice",
  "wallet": "0x1234567890abcdef1234567890abcdef12345678",
  "updated_at": "2026-08-07T08:00:00.000Z",
  "assets": [
    {
      "symbol": "OUSD",
      "name": "OpenUSD",
      "balance": 125.50,
      "usd_value": 125.50,
      "logo": "https://…"
    },
    {
      "symbol": "USDT",
      "name": "Tether",
      "balance": 40.00,
      "usd_value": 40.00,
      "logo": "https://…"
    },
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "balance": 10.00,
      "usd_value": 10.00
    },
    {
      "symbol": "SOL",
      "name": "Solana",
      "balance": 0.85,
      "usd_value": 142.30
    },
    {
      "symbol": "PI",
      "name": "Pi Network",
      "balance": 200.0,
      "usd_value": 84.00
    }
  ]
}
```

### Field rules

| Field | Required | Notes |
|-------|----------|--------|
| `assets[]` | **Yes** | Array (empty `[]` if wallet has nothing) |
| `symbol` | **Yes** | Uppercase: `OUSD`, `USDT`, `USDC`, `SOL`, `PI` |
| `balance` | **Yes** | Number (human units, not wei) |
| `usd_value` | Strongly preferred | Number in USD |
| `name` | Optional | Display name |
| `logo` | Optional | Absolute HTTPS URL |
| `username` / `wallet` | Optional | Echo of resolved account |
| `updated_at` | Optional | ISO-8601 |

### Tokens we display in OpenPay Assets / Pro Pay

1. **OUSD**  
2. **USDT**  
3. **USDC**  
4. **SOL**  
5. **PI**  

Include a row even when balance is `0` (cleaner UI), or omit zeros — either works.

---

## 5. Error responses

Please return JSON (not HTML 404 SPA pages):

```json
{ "ok": false, "error": "user_not_found" }
```

| HTTP | When |
|------|------|
| `200` | Success (even if all balances are 0) |
| `400` | Missing / invalid username or wallet |
| `401` | Missing / invalid partner API key |
| `403` | Key not allowed to read balances |
| `404` | User / wallet not found on Pro |
| `429` | Rate limited |
| `500` | Server error |

CORS: if this must be called from the browser, allow `https://openpy.space` (and localhost for dev). **Preferred:** OpenPay calls this from a **Supabase Edge Function** (server-side) with the partner key — no CORS needed.

---

## 6. Security / privacy (what we need decided)

OpenPay Pro is self-custody. Please choose one model:

### Option A — Partner read (recommended for OpenPay Dashboard)

- Same `opk_` partner key as inbound  
- Partner may read balances **only for accounts that have opted in** OR for any lookup (product decision)  
- OpenPay never receives private keys — balances only  

### Option B — User OAuth / consent

- User connects Pro wallet once in OpenPay  
- OpenPay uses a short-lived user token (`opa_…` or similar) to read **that user’s** balances only  
- Best privacy; more work on both sides  

### Option C — Public read by username (least preferred)

- `GET …/portfolio?username=` with no auth  
- Simple, but leaks balances publicly — only if Pro product allows public portfolio  

**OpenPay recommendation:** **Option A** for v1 (fast), then **Option B** for production privacy.

---

## 7. What OpenPay will do once the API exists

1. Call the new endpoint from a Supabase function (server-side, partner key).  
2. Merge Pro `assets[]` into Dashboard → **Assets** (“Your Pro tokens”).  
3. Show live balances for OUSD / USDT / USDC / SOL / PI.  
4. Keep linking to `https://openpaypro.space/wallet` for manage / send / swap.  

Client merge logic is already prepared in:

- `src/lib/openpayProAssets.ts` → `fetchProPortfolio` / `mergeProPortfolio`  
- Current probe URLs return **HTML 404** (route not implemented).

---

## 8. Checklist for OpenPay Pro team

- [ ] Implement `GET` and/or `POST` portfolio/balances under `/api/public/openpay/…`  
- [ ] Auth with existing Partner API key (`Bearer opk_…`)  
- [ ] Lookup by `username` and/or `0x` wallet (same as inbound `to`)  
- [ ] Return `assets[]` with `symbol`, `balance`, `usd_value`  
- [ ] Cover OUSD, USDT, USDC, SOL, PI  
- [ ] JSON errors (not SPA 404 HTML)  
- [ ] Share production URL + any staging URL  
- [ ] Share rate limits + example curl with a test account  
- [ ] Confirm privacy model (A / B / C)  

---

## 9. Example curl (for Pro to validate)

```bash
curl -sS -X POST "https://openpaypro.space/api/public/openpay/balances" \
  -H "Authorization: Bearer opk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"username":"alice"}'
```

Expected: HTTP 200 + `assets` array (not HTML).

---

## 10. Contact / handoff

Once live, send OpenPay:

1. Final path (`/portfolio` or `/balances`)  
2. Auth model confirmed  
3. One test username + sample JSON response  
4. Any required allowlist for our partner app / API key  

OpenPay will wire the Dashboard Assets section the same day.

---

## Appendix — Existing working inbound (reference)

```http
POST https://openpaypro.space/api/public/openpay/inbound
Authorization: Bearer opk_live_XXXX
Content-Type: application/json

{
  "to": "@alice",
  "amount": 10.00,
  "openpay_tx_id": "…",
  "note": "pro_xfer:@alice:r_…",
  "from_username": "bob"
}
```

We only need the **read** counterpart for balances.
