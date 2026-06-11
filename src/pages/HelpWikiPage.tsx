import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Wallet,
  Send,
  QrCode,
  CreditCard,
  Store,
  Link2,
  Pickaxe,
  Coins,
  ShieldCheck,
  Users,
  Bell,
  Globe,
  Banknote,
  Receipt,
  Sparkles,
  BookOpen,
  PlayCircle,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type Feature = {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  short: string;
  overview: string;
  steps: string[];
  demoPath?: string;
  demoLabel?: string;
  youtubeId?: string;
  faqs?: { q: string; a: string }[];
};

const FEATURES: Feature[] = [
  {
    id: "wallet",
    title: "Your OpenPay Wallet",
    category: "Basics",
    icon: Wallet,
    short: "Hold balance, top up, and spend across the OpenPay network.",
    overview:
      "Your wallet is the heart of OpenPay. It stores your balance in your preferred currency and lets you send, receive, top up, withdraw, and pay merchants instantly.",
    steps: [
      "Open the Dashboard to see your live balance.",
      "Tap Top up to add funds via Pi, Stripe, PayPal, Apple Pay, USDT, USDC, OUSD, Solana Pay, or local methods.",
      "Use Send / Request / Scan from the floating bottom nav.",
      "All movements are logged in Activity and the public OpenLedger.",
    ],
    demoPath: "/dashboard",
    demoLabel: "Open Dashboard",
    youtubeId: "dQw4w9WgXcQ",
    faqs: [
      { q: "Is my balance insured?", a: "Funds are held in segregated reserve accounts. See /regulatory-status for details." },
      { q: "What currencies are supported?", a: "30+ fiat and crypto currencies — switch from Settings → Currency." },
    ],
  },
  {
    id: "send",
    title: "Send Money",
    category: "Payments",
    icon: Send,
    short: "Send to a username, phone, email, or scan a QR.",
    overview:
      "Send funds to anyone with an OpenPay account in seconds, with optional notes and emoji. Funds settle instantly inside the network.",
    steps: [
      "Tap Send from the Dashboard.",
      "Search a contact, paste a username (@handle), or scan a QR.",
      "Enter amount, add a note, confirm with MPIN/biometrics.",
      "Receipt is saved to Activity and a notification is sent to both sides.",
    ],
    demoPath: "/send",
    demoLabel: "Try Send Money",
    youtubeId: "5qap5aO4i9A",
  },
  {
    id: "request",
    title: "Request Money",
    category: "Payments",
    icon: Receipt,
    short: "Ask anyone to pay you — shareable link included.",
    overview:
      "Create a payment request that the receiver can pay with a single tap. Works inside OpenPay or via a shareable public link.",
    steps: [
      "Tap Request from the Dashboard.",
      "Choose a contact or generate a public link.",
      "Set amount, currency, and reason.",
      "Share via chat, email, or QR.",
    ],
    demoPath: "/request",
    demoLabel: "Request Money",
    youtubeId: "M7lc1UVf-VE",
  },
  {
    id: "qr-pay",
    title: "QR Pay — Create & Accept",
    category: "Payments",
    icon: QrCode,
    short: "Generate a payment QR for products, donations, tips, or digital goods.",
    overview:
      "QR Pay turns any phone into a checkout. Create a payment page with product details, images, custom amounts, and delivery collection — share the link or print the QR.",
    steps: [
      "Go to QR Pay → New.",
      "Pick a type: Product, Digital download, Donation, or Tip.",
      "Add title, image, price (or allow custom amount), and items.",
      "Choose accepted methods: Pi, Wallet, Virtual Card, or Guest.",
      "Share the link/QR. Track sales live in the QR Pay Dashboard.",
    ],
    demoPath: "/qr-pay/new",
    demoLabel: "Create a QR Payment",
    youtubeId: "9bZkp7q19f0",
    faqs: [
      { q: "Can customers pay without an account?", a: "Yes — enable Guest checkout when creating the QR." },
      { q: "Where do payments appear?", a: "Activity, Notifications, OpenLedger, and your QR Pay Dashboard." },
    ],
  },
  {
    id: "scan",
    title: "Open Scan",
    category: "Payments",
    icon: QrCode,
    short: "Universal scanner for OpenPay, QR Pay, and external Pi links.",
    overview:
      "Open Scan recognizes OpenPay usernames, QR Pay tokens, openpay:// deep links, Pi payment URIs, and standard URLs — and routes you to the right action.",
    steps: ["Tap Scan from the bottom nav.", "Point at any QR.", "Confirm the action prompted on screen."],
    demoPath: "/scan",
    demoLabel: "Open the Scanner",
    youtubeId: "kJQP7kiw5Fk",
  },
  {
    id: "virtual-card",
    title: "Virtual Card",
    category: "Payments",
    icon: CreditCard,
    short: "Issue a virtual card backed by your wallet balance.",
    overview:
      "Generate a virtual card to pay online merchants, QR Pay checkouts, and any OpenPay-enabled store. Lock/unlock anytime.",
    steps: [
      "Open Virtual Card from the menu.",
      "Tap Activate (first use auto-activates).",
      "Use card number + CVC at any OpenPay-enabled checkout.",
      "Lock the card in one tap if needed.",
    ],
    demoPath: "/virtual-card",
    demoLabel: "View My Card",
    youtubeId: "L_jWHffIx5E",
  },
  {
    id: "topup",
    title: "Top Up",
    category: "Basics",
    icon: Banknote,
    short: "Fund your wallet from 15+ providers.",
    overview:
      "Add money via Pi, Stripe (card), PayPal, Venmo, Apple Pay, Google Pay, USDT, USDC, OUSD (Solana), Solana Pay, MRWN, or local e-wallets like QR Ph.",
    steps: ["Tap Top up from the Dashboard.", "Choose a provider.", "Follow provider flow.", "Balance updates instantly when confirmed."],
    demoPath: "/top-up",
    demoLabel: "Top Up Wallet",
    youtubeId: "fJ9rUzIMcZQ",
  },
  {
    id: "merchant",
    title: "Merchant Portal",
    category: "Business",
    icon: Store,
    short: "Stripe/PayPal-style portal: POS, catalog, API keys, payouts.",
    overview:
      "Run a real business on OpenPay. Create products, run a POS checkout, manage transfers, issue API keys, and view sales analytics.",
    steps: [
      "Onboard at Merchant Onboarding.",
      "Create products in your catalog.",
      "Run sales from POS or share a checkout link.",
      "Generate API keys for headless integrations.",
    ],
    demoPath: "/merchant-onboarding",
    demoLabel: "Become a Merchant",
    youtubeId: "ScMzIvxBSi4",
  },
  {
    id: "payment-links",
    title: "Payment Links",
    category: "Business",
    icon: Link2,
    short: "One-tap shareable checkout — perfect for socials.",
    overview:
      "Create a hosted checkout page with a single price or a cart. Share the link anywhere; settlements land in your wallet.",
    steps: [
      "Go to Buttons → Payment Links.",
      "Configure items, price, success URL.",
      "Copy the link or embed the button.",
    ],
    demoPath: "/buttons/payment-links",
    demoLabel: "Create a Link",
    youtubeId: "RgKAFK5djSk",
  },
  {
    id: "mining",
    title: "Mining (Ad-gated)",
    category: "Earn",
    icon: Pickaxe,
    short: "Earn daily rewards by watching a rewarded ad.",
    overview:
      "Activate a 24-hour mining cycle by watching a Pi Ad Network rewarded ad. Rewards stream to your wallet automatically.",
    steps: ["Open Mining.", "Tap Watch ad to activate.", "Return after 24h to claim and restart."],
    demoPath: "/mining",
    demoLabel: "Start Mining",
    youtubeId: "OPf0YbXqDm0",
  },
  {
    id: "staking",
    title: "Staking & Savings",
    category: "Earn",
    icon: Coins,
    short: "Earn yield by staking your balance.",
    overview: "Lock funds into a staking position to earn variable yield. Withdraw anytime after the lockup period.",
    steps: ["Open Staking.", "Choose amount and term.", "Confirm with MPIN.", "Track accrual on the dashboard."],
    demoPath: "/staking",
    demoLabel: "Start Staking",
    youtubeId: "60ItHLz5WEA",
  },
  {
    id: "affiliate",
    title: "Affiliate Program",
    category: "Earn",
    icon: Users,
    short: "Refer users, complete social tasks, earn payouts.",
    overview:
      "Get a unique ref link, share it, and earn for every signup. Bonus tasks (follow socials, post about OpenPay) unlock extra rewards.",
    steps: ["Open Affiliate.", "Copy your ref link.", "Complete task submissions for bonuses.", "Withdraw earnings to wallet."],
    demoPath: "/affiliate",
    demoLabel: "Get My Ref Link",
    youtubeId: "JGwWNGJdvx8",
  },
  {
    id: "openledger",
    title: "OpenLedger (Transparency)",
    category: "Trust",
    icon: Globe,
    short: "Public, real-time ledger of every transaction on OpenPay.",
    overview:
      "Every payment, top up, withdrawal, QR Pay sale, and merchant transfer is recorded to a public OpenLedger feed with profile info — full transparency.",
    steps: ["Open OpenLedger.", "Filter by type or search a transaction ID.", "Click an entry to see receipt details."],
    demoPath: "/ledger",
    demoLabel: "Browse OpenLedger",
    youtubeId: "hT_nvWreIhg",
  },
  {
    id: "disputes",
    title: "Disputes & Claims",
    category: "Trust",
    icon: ShieldCheck,
    short: "File a claim using any Transaction ID from your receipts.",
    overview:
      "Found a problem? Open Disputes and submit the Transaction ID printed on your receipt. Our team reviews and reimburses qualifying claims.",
    steps: ["Open Disputes → New claim.", "Paste the Transaction ID.", "Describe what went wrong, attach evidence.", "Track status in real time."],
    demoPath: "/disputes",
    demoLabel: "File a Dispute",
    youtubeId: "CevxZvSJLk8",
  },
  {
    id: "notifications",
    title: "Notifications & Activity",
    category: "Basics",
    icon: Bell,
    short: "Live updates for every payment, request, and merchant event.",
    overview:
      "Notifications surface every important event — incoming payments, QR sales, requests, support replies, mining rewards, and more.",
    steps: ["Tap the bell on the Dashboard.", "Open Activity for full history.", "Tap any row for the full receipt."],
    demoPath: "/activity",
    demoLabel: "Open Activity",
    youtubeId: "y6120QOlsfU",
  },
  {
    id: "api",
    title: "Smart Contract / Developer API",
    category: "Developers",
    icon: Sparkles,
    short: "Build apps with OAuth 2.0, REST API keys, and webhooks.",
    overview:
      "OpenPay's Smart Contract API lets developers create payments, subscriptions, and payouts. Includes a developer dashboard, OAuth 2.0, API keys, and webhooks.",
    steps: ["Open Developer Dashboard.", "Create an app, copy your keys.", "Read the API docs.", "Subscribe to webhooks for live events."],
    demoPath: "/openpay-api-docs",
    demoLabel: "Read API Docs",
    youtubeId: "GwIo3gDZCVQ",
  },
];

const CATEGORIES = ["All", "Basics", "Payments", "Business", "Earn", "Trust", "Developers"];

const HelpWikiPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FEATURES.filter((f) => {
      const inCat = category === "All" || f.category === category;
      if (!inCat) return false;
      if (!q) return true;
      return (
        f.title.toLowerCase().includes(q) ||
        f.short.toLowerCase().includes(q) ||
        f.overview.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-paypal-dark">OpenPay Help & Wiki</h1>
            <p className="text-xs text-muted-foreground">
              Every feature, explained — with demos and video tutorials.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6">
        {/* Hero */}
        <section className="paypal-surface mb-6 rounded-3xl p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-paypal-blue">
            <BookOpen className="h-4 w-4" /> OpenPay Wiki
          </div>
          <h2 className="mt-2 text-2xl font-bold text-paypal-dark">
            Learn OpenPay in minutes
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Step-by-step guides, live demos, and YouTube tutorials for every feature in the app.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features (e.g. QR Pay, Mining, Virtual Card)"
                className="pl-9"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "bg-paypal-blue text-white"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        {/* Quick links */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURES.slice(0, 8).map((f) => {
            const Icon = f.icon;
            return (
              <a
                key={f.id}
                href={`#${f.id}`}
                className="paypal-surface flex flex-col gap-1 rounded-2xl p-3 transition hover:scale-[1.02]"
              >
                <Icon className="h-5 w-5 text-paypal-blue" />
                <p className="text-sm font-semibold text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{f.short}</p>
              </a>
            );
          })}
        </section>

        {/* Feature list */}
        <section className="space-y-4">
          {filtered.length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No features match your search.</p>
          )}

          {filtered.map((f) => {
            const Icon = f.icon;
            return (
              <article
                key={f.id}
                id={f.id}
                className="paypal-surface scroll-mt-24 overflow-hidden rounded-3xl"
              >
                <div className="flex flex-col gap-4 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paypal-blue/10">
                        <Icon className="h-6 w-6 text-paypal-blue" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-paypal-dark">{f.title}</h3>
                          <Badge variant="secondary" className="text-[10px]">{f.category}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{f.short}</p>
                      </div>
                    </div>
                    {f.demoPath && (
                      <Button
                        size="sm"
                        onClick={() => navigate(f.demoPath!)}
                        className="bg-paypal-blue hover:bg-paypal-blue/90"
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        {f.demoLabel || "Try it"}
                      </Button>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-foreground/90">{f.overview}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Steps */}
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-paypal-dark">How to use</h4>
                      <ol className="space-y-1.5 text-sm text-foreground/90">
                        {f.steps.map((s, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-paypal-blue text-[11px] font-bold text-white">
                              {i + 1}
                            </span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Video */}
                    {f.youtubeId && (
                      <div className="overflow-hidden rounded-2xl border border-border bg-black">
                        <div className="relative aspect-video">
                          <iframe
                            src={`https://www.youtube.com/embed/${f.youtubeId}`}
                            title={`${f.title} tutorial`}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            loading="lazy"
                            className="absolute inset-0 h-full w-full"
                          />
                        </div>
                        <a
                          href={`https://www.youtube.com/watch?v=${f.youtubeId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between bg-background px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <span>Watch on YouTube</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {f.faqs && f.faqs.length > 0 && (
                    <Accordion type="single" collapsible className="rounded-2xl border border-border bg-background/60 px-4">
                      {f.faqs.map((faq, i) => (
                        <AccordionItem key={i} value={`faq-${f.id}-${i}`} className="border-b-0">
                          <AccordionTrigger className="text-sm">{faq.q}</AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Footer help */}
        <section className="paypal-surface mt-8 rounded-3xl p-6 text-center">
          <h3 className="text-lg font-bold text-paypal-dark">Still need help?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk to a human or browse the full Help Center.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/help-center")}>Help Center</Button>
            <Button variant="outline" onClick={() => navigate("/support")}>Contact Support</Button>
            <Button variant="outline" onClick={() => navigate("/openpay-documentation")}>Full Documentation</Button>
            <Button variant="outline" onClick={() => navigate("/openpay-api-docs")}>API Docs</Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HelpWikiPage;
