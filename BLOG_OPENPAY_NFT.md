# OpenPay NFT — Complete Feature Blog

A creator-first NFT marketplace built into OpenPay. Mint, sell, auction, gift, chat, and run your own store — all from one app, on web and inside Pi Browser.

---

## 1. Mint Your First NFT
**Where:** `/web3/nft/create`

- Upload image, GIF, video, or audio.
- Set name, unique code, description, category, and royalty %.
- Choose supply (1 = 1/1, more = limited edition).
- Pick currency: OUSD, USD, or Pi.
- **Sale Type picker:** Fixed Price (instant buy) or 🔥 **Live Auction** (real-time bidding war that launches the moment you mint).

**Why creators love it:** zero gas fees, fully on-platform escrow, your buyers pay with their OpenPay balance, virtual card, or Pi.

---

## 2. Live Realtime Auctions
**Where:** any NFT detail page

- ⏱️ Countdown updates every second (turns red and pulses in the last hour).
- 📈 Current bid jumps in realtime with a green glow animation each time someone bids.
- 👑 Leader nameplate switches live.
- 📜 Recent bids feed shows the last 5 bids and bidders.
- 🏆 Winner banner appears the second the auction ends — no refresh needed.
- 💸 Funds are escrowed safely; outbid users are refunded automatically.

---

## 3. Global Live Chat
**Where:** marketplace header → 💬 icon, or `/web3/nft/chat`

- Real-time global chat for every signed-in OpenPay user.
- **Share NFT button:** pick from NFTs you own or created → it renders as a clickable preview card in the chat.
- Live indicator, message timestamps, delete-your-own.
- Built on Supabase realtime — messages stream in instantly.

Use it to: hype your drop, find collectors, run giveaways, build a fandom.

---

## 4. Status Badges
Every NFT card shows live availability:
- 🟢 **Available**
- 🟠 **Limited** (≤ 3 left or ≤ 10% of supply)
- 🔴 **Sold Out**
- 🔵 **Live Auction**

Visible on the marketplace grid, detail page, dashboard, and store pages.

---

## 5. Buy & Resale Listings
- Buy with **OpenPay balance**, **Virtual Card**, or **Pi** (in Pi Browser).
- Virtual card details are masked behind an 👁️ eye toggle — screenshot/screen-record protection.
- Owners can **list for resale** at any price, edit the price anytime, or cancel.
- Auto-receipt with reference, method, masked card, Pi TxID.

---

## 6. Gifting NFTs
- Send any NFT you own to another OpenPay user by **@username**.
- Add a personal message — recipient sees a celebratory burst on delivery.

---

## 7. Creator Store Profile
**Where:** `/web3/nft/store/settings`

Build a Stripe/PayPal-grade storefront for your collection:
- Custom **handle** (your URL: `/web3/nft/store/<handle>`)
- Display name, bio, banner image, avatar
- Category (collectibles, art, music, gaming, photography, etc.)
- Social links: **Website · Twitter/X · Instagram · Facebook · YouTube · Telegram · Discord · Public email**
- Verified badge for trusted creators
- "Feature my NFTs" toggle for marketing showcase

---

## 8. Followers & Following
- **Follow / Unfollow** any store with one tap.
- Stats grid shows **Followers** and **Following** counts.
- Tap either count to open a list of users — see their avatar, name, bio, verified badge, and jump directly to their store.

---

## 9. Storefront Page
Every store page shows:
- Store value, NFTs collected, NFTs created, followers, following
- Tabs: **Collected · Created · Activity · Offers**
- Grid or list view
- All linked socials with icon shortcuts
- One-tap share / copy store ID

---

## 10. Smooth, Always-Fresh Marketplace
- Pull-to-refresh + auto-refresh when you scroll to the bottom.
- Skeleton loaders — never a long blank screen.
- Search across NFTs, stores, and creators.

---

## 11. Transparent History (OpenLedger)
Each NFT detail page shows the full chain of mints, sales, gifts, and resales — with timestamps and amounts. Public, immutable, audit-friendly.

---

## 12. Pi Network Integration
- **Pi Ad Network rewarded ads** play before Pi authentication on `/auth`.
- Mining activation via rewarded ads.
- Pi payments inside the marketplace for any NFT priced in Pi.
- Optimized UX when running inside Pi Browser (email sign-in is hidden there; outside Pi Browser email + Apple sign-in are available).

---

## 13. Security & Trust
- Row-level security on every NFT table.
- Auction escrow + automatic outbid refunds.
- Virtual card masking on detail/buy modals.
- No client-side admin checks — all role enforcement server-side.
- 2FA, MPIN, and account locking carry over from OpenPay core.

---

## 14. Mobile-First, PWA-Ready
- Floating bottom nav on the dashboard.
- Smooth bottom-sheet modals (buy, gift, list, auction, bid, follow list).
- Works in Pi Browser, mobile Safari, Chrome, and as an installed PWA.

---

## Roadmap
- Bundled drops
- Creator analytics dashboard upgrades
- NFT-gated content
- Cross-store collabs
- Open marketplace API for third-party apps

---

**Try it now:** open OpenPay → menu → **NFT Marketplace** → 🔥 Mint or browse.
