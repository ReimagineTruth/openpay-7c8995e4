## QR Pay — New standalone feature

A merchant creates a payment with inline product items, gets a shareable link + QR code. Customers scan/open, pay via Pi, OpenPay wallet, or virtual card (guest allowed for Pi). Receipts delivered three ways. Dashboard tracks revenue.

### Database (migration)

New tables in `public`:

- **`qr_payments`** — one per created QR payment
  - `merchant_user_id` (uuid, FK profiles), `token` (text unique, used in URL), `title`, `description`, `currency`, `subtotal`, `total`, `status` (`active|paid|expired|cancelled`), `allow_pi`, `allow_wallet`, `allow_virtual_card`, `allow_guest`, `expires_at`, `metadata` (jsonb), timestamps
- **`qr_payment_items`** — inline products
  - `qr_payment_id`, `name`, `description`, `image_url` (optional), `quantity`, `unit_price`, `line_total`
- **`qr_payment_transactions`** — every payment attempt/success
  - `qr_payment_id`, `payer_user_id` (nullable for guest), `payer_name`, `payer_email`, `method` (`pi|wallet|virtual_card`), `amount`, `currency`, `status` (`pending|succeeded|failed|refunded`), `transaction_ref` (unique receipt ID), `pi_payment_id`, `pi_txid`, `provider_payload` (jsonb), `paid_at`, timestamps

Full RLS:
- Merchants manage their own `qr_payments` + items + view their transactions.
- Public/anon `SELECT` on active `qr_payments` and items by token (for checkout page).
- `service_role` full access.
- Insert transactions via SECURITY DEFINER RPCs only.

RPCs:
- `qr_pay_create(...)` — creates payment + items, returns token.
- `qr_pay_get_by_token(token)` — public read for checkout.
- `qr_pay_complete_wallet(token, payer info)` — debits wallet, credits merchant wallet (single credit, reuses existing wallet logic, no double-credit), inserts transaction, marks paid.
- `qr_pay_complete_virtual_card(token, ...)` — same via virtual card balance.
- `qr_pay_complete_pi(token, pi_payment_id, txid, payer info)` — credits merchant wallet after Pi `complete` succeeds.
- `qr_pay_merchant_stats(range)` — totals/count/by-method for dashboard.

GRANTs to `authenticated` + `anon` (read RPC + complete RPCs as needed; guest needs anon access to get + Pi complete).

### Frontend pages/components

- **`/qr-pay`** — Merchant dashboard: revenue cards (total, today, week, month), method breakdown, list of created QR payments (status, link, copy, QR preview, share), "New QR Payment" button.
- **`/qr-pay/new`** — Create form: title, description, currency (CurrencyContext), inline items repeater (name/qty/unit price/optional image), expiration, payment methods toggles. On submit → success view with QR + sharable link + copy/share buttons.
- **`/qr-pay/:token`** — Public checkout (no auth required): shows merchant name/avatar/username, items, total. Tabs/buttons for Pi / Wallet / Virtual Card based on `allow_*`. Pi flow uses existing Pi SDK + `pi-platform` edge function. Wallet/VCard flows require sign-in (redirect to /pi-auth with return URL); guest only for Pi.
- **`/qr-pay/:token/success`** — Thank-you page with receipt details, transaction ref, PDF download, "email me receipt" button (uses existing app-emails infra).
- **PDF receipt** — client-side generation (jsPDF, already in use pattern) with merchant info, items, total, transaction ref, date, method.

Components:
- `QrPayCreateForm`, `QrPayItemRow`, `QrPayShareCard` (QR via `qrcode` lib already used), `QrPayCheckout`, `QrPayMethodPi/Wallet/VCard`, `QrPayReceiptPdf`, `QrPayRevenueDashboard`.

### Integrations

- Reuse `CurrencyContext` for all amounts (project rule).
- Reuse existing single-credit merchant wallet logic — no `merchant_balance_transfers` double posting (per fix already applied).
- Pi payments via existing `supabase/functions/pi-platform` (approve/complete).
- Email receipt via `send-transactional-email` with a new template `qr-payment-receipt`.
- Add nav entry in `MenuPage` / link card on Dashboard.

### Routes
Add to `src/App.tsx`:
- `/qr-pay` (auth required)
- `/qr-pay/new` (auth required)
- `/qr-pay/:token` (public)
- `/qr-pay/:token/success` (public)

### Out of scope
- No catalog integration (inline items only, per your choice).
- No refunds UI (status field present for future).

Approve and I'll build it end-to-end (migration first, then code, then email template + edge wiring).
