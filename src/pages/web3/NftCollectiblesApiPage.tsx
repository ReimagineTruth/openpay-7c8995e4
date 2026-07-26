import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NftPageShell from "@/components/web3/NftPageShell";
import {
  Copy,
  ExternalLink,
  Layers,
  Package,
  ShieldCheck,
  Sparkles,
  UserRound,
  Code2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PROJECT_ID = "araojncyittkahvvpdrn";
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/nft-public-api`;
const DOCS_URL = "https://openpy.space/web3/nft/api/collectibles";

const endpoints = [
  {
    method: "GET",
    path: "/collectibles/:username_or_user_id",
    desc: "List every OpenNFT collectible held by an OpenPay @username or user UUID. Includes item image, permalink, quantity, and creator store.",
  },
  {
    method: "GET",
    path: "/collectibles/:username_or_user_id/items/:item_id",
    desc: "Ownership check for one item (UUID or item code). Returns owns + quantity for gating in OpenPay Pro.",
  },
  {
    method: "GET",
    path: "/owners/:user_id",
    desc: "Legacy holdings feed. Now also accepts @username and returns owner profile.",
  },
];

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
};

const Code = ({ children }: { children: string }) => (
  <div className="relative group">
    <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100 md:text-sm">
      <code>{children}</code>
    </pre>
    <button
      type="button"
      onClick={() => copy(children)}
      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] text-white opacity-0 transition hover:bg-white/20 group-hover:opacity-100"
    >
      <Copy className="h-3 w-3" /> Copy
    </button>
  </div>
);

const NftCollectiblesApiPage = () => {
  const [lookup, setLookup] = useState("wainfoundation");
  const cleanLookup = useMemo(
    () => lookup.trim().replace(/^@+/, "") || "wainfoundation",
    [lookup],
  );
  const collectiblesUrl = `${API_BASE}/collectibles/${encodeURIComponent(cleanLookup)}`;
  const ownsUrl = `${API_BASE}/collectibles/${encodeURIComponent(cleanLookup)}/items/ITEM_ID_OR_CODE`;

  return (
    <NftPageShell
      splashTitle="OpenNFT Collectibles"
      splashSubtitle="API for OpenPay Pro"
    >
      <div className="mx-auto max-w-5xl space-y-8 px-4 pb-24 pt-6">
        <div
          className="theme-fixed relative overflow-hidden rounded-3xl p-6 md:p-10"
          style={{ background: "linear-gradient(135deg, #062a78 0%, #0070BA 55%, #00A3E0 100%)" }}
        >
          <div className="relative z-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" /> OpenNFT · Collectibles API · v2.1
            </div>
            <h1 className="mb-2 text-3xl font-black tracking-tight text-white md:text-5xl">
              User Collectibles API
            </h1>
            <p className="max-w-2xl text-white/85">
              Read-only endpoints so OpenPay Pro can show a user’s OpenNFT collection, gate features by
              ownership, and deep-link into OpenPay marketplace items — using OpenPay{" "}
              <span className="font-semibold text-white">@username</span> or user id.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={collectiblesUrl}
                target="_blank"
                rel="noreferrer"
                className="nft-on-media inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#0070BA]"
              >
                <ExternalLink className="h-4 w-4" /> Try /collectibles/@{cleanLookup}
              </a>
              <Link
                to="/web3/nft/api"
                className="nft-on-media inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white"
              >
                <Layers className="h-4 w-4" /> Full NFT API
              </Link>
              <Link
                to="/web3/nft"
                className="nft-on-media inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-semibold text-white"
              >
                Marketplace
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: UserRound,
              title: "Resolve by @username",
              body: "Pass an OpenPay username — no need to store UUIDs in Pro.",
            },
            {
              icon: Package,
              title: "Holdings + media",
              body: "Each collectible includes image, quantity, permalink, and creator store.",
            },
            {
              icon: ShieldCheck,
              title: "Ownership checks",
              body: "Confirm a Pro user owns a specific NFT before unlocking a perk.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-2xl border bg-card p-4">
              <card.icon className="mb-2 h-5 w-5 text-[#0070BA]" />
              <p className="font-bold">{card.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{card.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Code2 className="h-4 w-4" /> BASE URL
          </div>
          <div className="flex items-center gap-2 break-all rounded-xl bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 md:text-sm">
            <span className="flex-1">{API_BASE}</span>
            <button type="button" onClick={() => copy(API_BASE)} className="rounded p-1 hover:bg-white/10">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            No API key required. CORS open. Edge cached (~15s). Docs: {DOCS_URL}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <p className="mb-3 text-sm font-bold">Live try — OpenPay username</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="@wainfoundation"
              className="font-mono"
            />
            <Button
              type="button"
              className="rounded-xl bg-[#0070BA] text-white hover:bg-[#005ea6]"
              onClick={() => window.open(collectiblesUrl, "_blank", "noopener,noreferrer")}
            >
              <Zap className="mr-2 h-4 w-4" />
              Open JSON
            </Button>
          </div>
        </div>

        <div>
          <h2 className="mb-3 text-2xl font-black">Endpoints</h2>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {endpoints.map((e) => (
              <div key={e.path} className="flex items-start gap-3 p-4 transition hover:bg-muted/40">
                <span className="rounded bg-green-500/15 px-2 py-1 text-[10px] font-bold text-green-600">
                  {e.method}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="break-all font-mono text-sm font-semibold">{e.path}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{e.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(`${API_BASE}${e.path}`)}
                  className="rounded-lg p-2 hover:bg-muted"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold">cURL — list collectibles</h3>
            <Code>{`curl "${API_BASE}/collectibles/${cleanLookup}?limit=50"`}</Code>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">cURL — ownership check</h3>
            <Code>{`curl "${ownsUrl}"`}</Code>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">JavaScript (OpenPay Pro)</h3>
            <Code>{`const username = "alice"; // OpenPay @username
const res = await fetch(
  \`${API_BASE}/collectibles/\${encodeURIComponent(username)}\`
);
const data = await res.json();

// data.owner  → { id, username, full_name, avatar_url }
// data.collectibles → [{ quantity, item: { id, name, image, permalink, store } }]
for (const row of data.collectibles || []) {
  console.log(row.item?.name, row.quantity, row.item?.permalink);
}`}</Code>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">Ownership gate</h3>
            <Code>{`async function ownsCollectible(username, itemId) {
  const res = await fetch(
    \`${API_BASE}/collectibles/\${encodeURIComponent(username)}/items/\${itemId}\`
  );
  const data = await res.json();
  return Boolean(data.owns) && Number(data.quantity) > 0;
}`}</Code>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold">Sample response</h3>
          <Code>{`{
  "owner": {
    "id": "uuid…",
    "username": "alice",
    "full_name": "Alice",
    "avatar_url": "https://…"
  },
  "owner_id": "uuid…",
  "count": 2,
  "collectibles": [
    {
      "item_id": "uuid…",
      "quantity": 1,
      "acquired_at": "2026-07-01T12:00:00Z",
      "item": {
        "id": "uuid…",
        "name": "OpenPay Genesis",
        "code": "op-genesis-1",
        "image": "https://…",
        "permalink": "https://openpy.space/web3/nft/…",
        "store": { "handle": "studio", "url": "https://…" }
      }
    }
  ],
  "pagination": { "limit": 50, "offset": 0 }
}`}</Code>
        </div>

        <div className="rounded-2xl border border-[#0070BA]/20 bg-[#0070BA]/5 p-5">
          <h3 className="text-lg font-black">OpenPay Pro integration notes</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Prefer <code className="rounded bg-muted px-1">/collectibles/:username</code> when Pro already
              knows the OpenPay partner / user tag.
            </li>
            <li>
              Use the ownership check endpoint to gate Pro perks, badges, or drops without syncing a full
              inventory.
            </li>
            <li>
              Item <code className="rounded bg-muted px-1">permalink</code> opens the live OpenPay NFT detail
              page for buy / gift / auction.
            </li>
            <li>
              Full marketplace feed (listings, auctions, activity) remains on{" "}
              <Link to="/web3/nft/api" className="font-semibold text-[#0070BA] hover:underline">
                /web3/nft/api
              </Link>
              .
            </li>
            <li>
              Redeploy edge function <code className="rounded bg-muted px-1">nft-public-api</code> after
              pulling these changes so <code className="rounded bg-muted px-1">/collectibles</code> is live.
            </li>
          </ul>
        </div>
      </div>
    </NftPageShell>
  );
};

export default NftCollectiblesApiPage;
