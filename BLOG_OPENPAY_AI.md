# Meet OpenPay AI — Your Conversational Money Assistant

OpenPay AI is built into the OpenPay wallet so you can check balances, send money, explore features, and get financial guidance in plain language — without digging through menus.

**Open it:** [https://openpy.space/ai](https://openpy.space/ai)  
**In-app:** Menu → **OpenPay AI** (or type `ai` / `help` in chat)

---

## Why OpenPay AI?

Most wallets make you tap through dashboards to do simple things. OpenPay AI flips that: you **ask**, it **answers**, then it **asks what you want next** so the conversation keeps going.

Whether you need a quick balance check, a transfer to `@username`, or a walkthrough of KYC, mining, merchant tools, or Partner API — the assistant matches your intent to the right OpenPay feature and route.

---

## 1. Chat Like a Human, Act Like a Wallet
**Where:** `/ai`

- Claude-style chat layout: clean sidebar, full-screen conversation, floating composer.
- Light and dark themes that match the rest of OpenPay.
- Your **profile photo**, name, `@username`, and live balance sit in the sidebar — tap to open Profile.
- Empty state suggestions get you started in one tap (balance, spending, health, advice).
- Recent chats stay in the sidebar so you can pick up where you left off.

**Try saying:**
- “What’s my balance?”
- “Help me complete KYC”
- “How does staking work?”
- “Take me to mining”

---

## 2. Real Conversations (Not One-Shot Answers)

OpenPay AI is trained to keep a back-and-forth going:

- Answers are short and actionable.
- Almost every reply ends with a **clear follow-up question** (send money? check spending? open a page?).
- When a feature has two paths, it asks: **go to the page** or **explain it here**.
- Confirmations use simple replies: `confirm` / `cancel`.

That means you can stay in chat and finish real money tasks without losing context.

---

## 3. Send Money From Chat
**Command:** `send to @username amount`

Examples:
- `send to @openpay 25`
- `send to @satoshi 10.50`
- `send to @friend` → AI asks how much

### How it works
1. You type the send command (or describe the transfer).
2. AI shows recipient, amount, balance, and remaining funds.
3. You confirm in chat or in the confirmation dialog.
4. Funds move from **your connected OpenPay wallet** via the **Partner Transfer API**.
5. You get a paper-style **receipt** with OpenLedger link.

Recipients resolve the same way as Partner API docs: `@username`, account number (`OP…`), or email.

**Security:** No fake “TXN…” IDs. Transfers create real ledger transactions. OpenPay never asks for your password, MPIN, or seed phrase in chat.

---

## 4. Balance, Forecast & Insights

Ask for **balance** and get:

- Live wallet balance (via Partner Transfer `GET /balance` when available)
- Optional 7-day / 30-day forecast from your spending velocity
- Tips when the buffer looks thin

Open **Financial insights** from the sidebar for:

- Spending patterns and category breakdowns
- Budget alerts
- Personalized recommendations (KYC, 2FA, mining, staking, merchant, virtual card, and more)
- One-tap “Ask AI” or navigate straight to the feature

---

## 5. Product Expert for Every OpenPay Feature

OpenPay AI knows the product map — not just chat tricks. It can guide you to:

| Need | Feature | Route |
|---|---|---|
| Home / balance | Dashboard | `/dashboard` |
| Send to a user | Express Send | `/send` |
| Get paid | Receive / Request | `/receive`, `/request-payment` |
| Add funds | Top-up | `/topup` |
| Verify identity | KYC | `/kyc` |
| Earn | Mining / Staking / Affiliate | `/mining`, `/staking`, `/affiliate` |
| Sell | Merchant / POS / Links | `/merchant-onboarding`, `/merchant-pos`, `/payment-links/create` |
| Web3 | NFT Marketplace | `/web3/nft` |
| Developers | Partner API | `/partner-api` |
| Trust | OpenLedger | `/ledger` |

Type a feature name (`mining`, `partner api`, `virtual card`) and choose whether to open the page or stay in chat for a walkthrough.

---

## 6. Receipts & OpenLedger

After a successful AI transfer you get:

- Amount, recipient, status, timestamp
- Real **transaction ID** (UUID)
- Updated balance after the debit
- **View on OpenLedger** → `/ledger?tx=…`
- Shortcut to **Activity**

Transparent by design: what left your wallet is what the ledger shows.

---

## 7. Powered by Partner Transfer API

AI sends use the same Partner Transfer surface partners use externally:

- Base: `…/functions/v1/partner-transfer-api`
- In-app: your signed-in OpenPay session (never put `opk_live_…` keys in the browser)
- External apps: `Authorization: Bearer opk_live_YOUR_KEY`

Key routes:
- `GET /me` — account that owns the key/session
- `GET /balance` — live OUSD balance
- `GET /accounts/:identifier` — resolve `@user`, `OP…`, or email
- `POST /transfers` — send with `Idempotency-Key` for safe retries

Body example:

```json
{
  "to": "@username",
  "amount": 10.00,
  "note": "Payout"
}
```

Learn more in-app: [Partner API](https://openpy.space/partner-api)

---

## 8. Privacy & Safety

- Uses your signed-in session — AI cannot move money without confirmation.
- Never ask the AI for passwords, MPINs, seed phrases, or full card numbers.
- Sensitive changes stay on Settings / 2FA / KYC pages.
- Payments always require explicit confirmation.

Footer reminder on `/ai`: *OpenPay AI can make mistakes. Double-check responses. Payments always need confirmation.*

---

## Quick start checklist

1. Sign in at [openpy.space/auth](https://openpy.space/auth)
2. Open [OpenPay AI](https://openpy.space/ai)
3. Ask: “What’s my balance?”
4. Try: `send to @username 5` (then confirm)
5. Open **Financial insights** for recommendations
6. Ask: “How do I top up with PayPal?” or “Help me with KYC”

---

## Who it’s for

- **Everyday users** who want chat instead of hunting menus  
- **Creators & earners** checking mining, staking, and affiliate flows  
- **Merchants** learning POS, payment links, and QR Pay  
- **Developers** exploring Partner API, Auth, and OpenLedger  

---

## What’s next

- Deeper multi-turn planning (budgets, goals, scheduled reminders)
- Richer insight cards inside the conversation
- More Partner API actions from chat (lookup, balance history)
- Tighter Feature Quest + AI onboarding for new users

---

**Try it now:** open OpenPay → **OpenPay AI** → ask anything, then answer the follow-up.

*OpenPay — OpenUSD wallet powered by Pi Network.*
