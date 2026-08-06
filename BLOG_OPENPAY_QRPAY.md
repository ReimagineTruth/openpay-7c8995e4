# OpenPay QR Pay — Full Feature Blog

QR Pay turns any phone into a checkout. Create a branded payment page, share a QR or link, and get paid with Pi, OpenPay Wallet, Virtual Card, or OpenPay Pro — no forms required.

**Open it:** [https://openpy.space/qr-pay](https://openpy.space/qr-pay)  
**Create a checkout:** [https://openpy.space/qr-pay/new](https://openpy.space/qr-pay/new)  
**API & keys:** [https://openpy.space/qr-pay/api](https://openpy.space/qr-pay/api)  
**Sign in:** [https://openpy.space/auth](https://openpy.space/auth)

> Brand voice: modern fintech, Pi-native, Apple Pay–clean. Signature blue. Primary experience in Pi Browser; full web support everywhere else.  
> Base URL: `https://openpy.space`

---

## CMS pack (ready to publish)

- **Title:** OpenPay QR Pay — Accept Payments with QR Codes & Links
- **Slug:** `openpay-qr-pay`
- **Meta:** Create a branded QR checkout in minutes. Share a link or embed a pay button, collect with Pi, Wallet, or Virtual Card, and track every order from one dashboard.
- **Tags:** `qr-pay`, `checkout`, `pi`, `merchant`, `pos`, `payment-links`, `openpay-pro`

**Hero:** *Create a checkout. Share it. Get paid.*

---

## Why QR Pay?

Most merchant tools force you into heavy catalogs, POS hardware, or clunky invoice forms. QR Pay flips that:

1. **Set up** — pick a purpose, amount, and methods.
2. **Share** — QR for in-person, link for chat, button/iframe for your website.
3. **Pay** — customer pays with Pi, Wallet, Virtual Card, or OpenPay Pro.
4. **Done** — receipt, dashboard update, optional download or redirect.

No counter terminal required. No “build a store first.” If you can share a link, you can get paid.

---

## 1. Merchant Dashboard
**Where:** `/qr-pay`

Your money home for QR checkout:

- **Overview** — available balance, revenue, today / week / month / year, and breakdowns by method (Pi, Wallet, Card).
- **Payment links** — every checkout you’ve created: copy, preview, delete.
- **Orders** — Shopify-style customer panels with payer contact, delivery details, and line items.
- Live toast when a new payment lands (realtime).
- First-visit guide: *“OpenPay is an easy and secure way to get paid with QR codes and payment links.”*

**CTA:** [Open QR Pay dashboard →](https://openpy.space/qr-pay)

---

## 2. Create a Checkout in Minutes
**Where:** `/qr-pay/new` (sign-in required)

### Step by step
1. Choose a **payment purpose** from the searchable catalog (products, tips, bills, crypto, and more).
2. Set **title**, **currency**, description, and optional cover photo.
3. Add **line items** (name, qty, unit price, image) — or, for flexible purposes like donations and tips, set a suggested / minimum amount.
4. Turn on payment methods: **Pi Network**, **OpenPay Wallet**, **Virtual Card**, and optional **guest Pi**.
5. Optional: reusable link, expiry, OpenPay Pro settlement, after-payment download/redirect, delivery fields.
6. Create → share help opens → you’re ready to collect.

Journey rail on every screen: **Set up → Share → Pay → Done**.

**CTA:** [Create a QR payment →](https://openpy.space/qr-pay/new)

---

## 3. Payment Purposes — One Product, Many Use Cases

Backend types stay simple (`product` | `digital` | `donation` | `tip`), but merchants pick from a rich purpose catalog across nine categories:

| Category | Examples |
|----------|----------|
| **Commerce** | Product, Service, Subscription, Membership, Invoice, Quote, Pre-order |
| **Digital** | Digital Product, License, eBook, Course, Music, Video, Download, API Access |
| **Donations** | Donation, Tip, Crowdfunding, Charity, Fundraising |
| **Booking** | Appointment, Event Ticket, Reservation, Consultation, Hotel / Travel |
| **Bills** | Electricity, Water, Internet, Mobile, Cable, Gas, Insurance, Credit card, Mortgage, Tax, Gov fees, Tuition |
| **Finance** | Payment Request, Installment, Deposit, Balance, Loan repayment |
| **Business** | B2B, Freelancer, Contractor, Vendor, Payroll |
| **Personal** | Gift, Split Bill, Rent, Utilities, School, Medical |
| **Crypto** | Crypto pay, Token / NFT purchase, P2P, Swap, Staking, Trading deposit |

Flexible purposes (donation / tip family) let the **payer choose the amount**. Fixed purposes lock in your line items or price.

---

## 4. Multi-Currency Pricing

Create in the currency your customers understand:

- Large fiat catalog (USD, EUR, PHP, NGN, and more) plus **PI**.
- Rates relative to Pi; live Pi/USD where available.
- Checkout shows the payment currency clearly; Pi method converts the charge to π at pay time.
- OpenPay Pro pay assets include **OUSD, USDT, USDC, SOL, and Pi**.

Currency flags and clear labels keep checkout readable on every device.

---

## 5. Share — Mobile vs Website

After create, OpenPay asks: **Share link** or **Website**?

### Mobile (chat, SMS, in person)
- Branded **QR code** for face-to-face scans.
- **Copy link** and native **Share**.
- Preview the customer checkout before you send it.
- Perfect for markets, cafés, services, and DMs.

### Website (storefront & embeds)
- Apple Pay–style **Pay button** with OpenPay wordmark.
- **iFrame**, **widget**, or full **HTML page**.
- Optional **QR embed** for print / display.
- Style presets that match payment type.

Help copy: *“Which should I use?”* — Share Help walks merchants through both paths with **Set Up OpenPay** / **Maybe Later**.

Promo framing on share surfaces: **Now Accepting OpenPay**.

---

## 6. Customer Checkout
**Where:** `/qr-pay/:token` (public — no login required to view)

What buyers see:

- Merchant branding, cover image, items or amount.
- **No fee** callout on checkout.
- Name / email (and optional delivery fields when you enable them).
- Pay with **OpenPay Balance**, **Pi Network**, **Virtual Card**, and **OpenPay Pro** when settlement is configured.
- Desktop split layout; sticky pay bar on mobile.

After payment: optional file download or redirect — otherwise the success / receipt screen.

**Try a live checkout pattern:** `https://openpy.space/qr-pay/<your-token>`

---

## 7. Pay with Pi (Pi Browser)

Pi payments work best **inside Pi Browser**.

- Outside Pi Browser → OpenPay shows a **Pi Browser dialog**: QR + copy link, waiting state, Get Pi Browser, or switch method.
- Customer pays in Pi Browser; your original tab can still receive the receipt via cross-tab callback (`qr_pay_check_result` poll).
- Guest Pi is allowed when the merchant enables it; otherwise OpenPay sign-in.
- Payment memo pattern: `OpenPay QR · {title}`.
- Success hint: close Pi Browser — the other tab already has the receipt.

**Tip for merchants:** share the checkout link; tell Pi users “Open in Pi Browser” for the smoothest path.

---

## 8. Success, Receipts & Trust
**Where:** `/qr-pay/:token/success`

- Animated green check (respects reduced motion).
- Amount paid, method, and receipt actions: download / print / email.
- **Tx ID** for disputes — keep it.
- Digital products: download CTA.
- Redirect flows: continue CTA.
- Records flow into merchant **Orders** and wallet activity.

Trust cues throughout: clear branding, no surprise fees on the pay screen, and auditable transaction IDs.

---

## 9. Orders That Feel Like a Real Store

The **Orders** tab is built for operators, not just crypto hobbyists:

- Customer name and contact.
- Delivery / shipping fields when collected.
- Line-item breakdown.
- Status and payment method at a glance.

Pair it with Overview KPIs and you get a lightweight merchant OS without leaving OpenPay.

---

## 10. OpenPay Pro Settlement

Serious sellers can settle or accept via **OpenPay Pro**:

- Configure settlement destination (`@user` or `0x…` style targets where supported).
- Payers can complete with Pro assets (OUSD, USDT, USDC, SOL, Pi).
- Settlement runs after successful pay via the Pro settle path.

**OpenPay Pro links**
- App: [http://openpaypro4378.pinet.com](http://openpaypro4378.pinet.com)
- Website: [http://openpaypro.space/website](http://openpaypro.space/website)
- OpenUSD ($OUSD): [http://openpaypro.space/openusd](http://openpaypro.space/openusd)
- About: [http://openpaypro.space/about](http://openpaypro.space/about)
- Blog: [http://openpaypro.space/blog](http://openpaypro.space/blog)
- Wiki: [http://openpaypro.space/wiki](http://openpaypro.space/wiki)

---

## 11. QR Pay API — Automate Checkout
**Where:** `/qr-pay/api`

For kiosks, POS integrators, and third-party apps:

- Create / verify payment endpoints.
- API keys with revoke and usage stats.
- Server-side QR checkouts and receipt reconciliation.
- Fits “QR checkout you can automate.”

**CTA:** [QR Pay API dashboard →](https://openpy.space/qr-pay/api)

---

## 12. Scan Anywhere

OpenPay’s scanner recognizes QR Pay tokens and deep links:

- Paths like `/qr-pay/{token}`
- Schemes like `openpay://qr-pay/...`

Scan → preview → pay. Same receipts, same merchant dashboard.

**CTA:** [Open scanner →](https://openpy.space/auth/qr-scanner)

---

## 13. QR Pay vs Merchant POS

| | **QR Pay** | **Merchant POS** |
|---|------------|------------------|
| Best for | Shareable checkouts, remote + in-person | Counter sessions, repeat sales |
| Customer starts | Scan QR / open link / website button | Merchant starts a POS session |
| Catalog | Purpose + line items per link | Session / product POS flow |
| Embeds | Button, iframe, widget, HTML | Display QR on device |

Use **both**: POS at the counter, QR Pay for DMs, invoices, events, and your website.

**POS:** [https://openpy.space/auth/merchant-pos](https://openpy.space/auth/merchant-pos)

---

## 14. Who It’s For

- **Creators & freelancers** — invoices, tips, digital downloads.
- **Shops & pop-ups** — QR on a phone or printout.
- **Services** — appointments, consultations, deposits.
- **Community & charity** — donations and crowdfunding.
- **Developers** — API-driven kiosks and custom storefronts.
- **Pi-native businesses** — pay in π inside Pi Browser, settle with clarity.

---

## 15. Quick Start (5 Minutes)

1. Sign in at [https://openpy.space/auth](https://openpy.space/auth) (Pi Auth recommended in Pi Browser).
2. Open [QR Pay](https://openpy.space/qr-pay) → **Create**.
3. Pick a purpose, currency, and amount (or line items).
4. Enable Pi / Wallet / Card (and guest Pi if you want).
5. Share the **QR** or **link** — or drop a **Pay button** on your site.
6. Watch **Orders** and Overview update as customers pay.

---

## 16. Design Language

QR Pay follows an Apple Pay–inspired surface:

- Light canvas, calm typography, black rounded primary CTAs.
- Outlined OpenPay badge and wordmark on pay buttons.
- iOS Settings–style purpose picker.
- Intentional motion on success — presence, not noise.
- Mobile-first sticky pay bar; desktop split for comfort.

The goal: checkout that feels familiar the first time someone pays.

---

## FAQ

**Do customers need an OpenPay account?**  
Not always. Checkout is public. Wallet and Virtual Card need sign-in. Pi can be guest when you allow it (best in Pi Browser).

**Are there fees on the pay screen?**  
Checkout shows **No fee** for the customer experience messaging on the pay UI. Always confirm your merchant fee policy in-app / terms for your region.

**Can I reuse one link?**  
Yes — enable reusable links when creating. Or generate a fresh checkout per order.

**What happens after digital product payment?**  
Success can offer a download CTA, or redirect to your thank-you / delivery URL.

**How do I handle disputes?**  
Keep the **Tx ID** from the receipt. Use OpenPay activity / dispute tools with that reference.

**Does it work outside Pi Browser?**  
Yes for Wallet / Card / Pro paths and for viewing checkout. Full Pi pay UX is in Pi Browser; outside, OpenPay guides users with the Pi Browser dialog and cross-tab receipt.

---

## Related OpenPay Features

- Merchant POS — [https://openpy.space/auth/merchant-pos](https://openpy.space/auth/merchant-pos)
- Payment Links — [https://openpy.space/auth/payment-links/create](https://openpy.space/auth/payment-links/create)
- Receive / Request — [https://openpy.space/auth/receive](https://openpy.space/auth/receive) · [https://openpy.space/auth/request-payment](https://openpy.space/auth/request-payment)
- Virtual Card — [https://openpy.space/auth/virtual-card](https://openpy.space/auth/virtual-card)
- Help Wiki — in-app Help → QR Pay
- Whitepaper / About — OpenPay merchant ecosystem roadmap

---

## Closing

QR Pay is OpenPay’s answer to “how do I get paid now?” — not next quarter after a full store build.

**Create a checkout. Share a QR or embed a button. Collect with Pi, Wallet, Card, or OpenPay Pro. Track every order.**

**Start here →** [https://openpy.space/qr-pay](https://openpy.space/qr-pay)
