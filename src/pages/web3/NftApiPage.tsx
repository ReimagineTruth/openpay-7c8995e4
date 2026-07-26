import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NftPageShell from "@/components/web3/NftPageShell";
import { Copy, ExternalLink, Zap, Activity, Layers, Package, TrendingUp, Code2 } from "lucide-react";
import { toast } from "sonner";

const PROJECT_ID = "araojncyittkahvvpdrn";
const API_BASE = `https://${PROJECT_ID}.supabase.co/functions/v1/nft-public-api`;

type ActivityRow = {
  id: string;
  type: string;
  quantity: number;
  price_each: number;
  total: number;
  currency: string;
  payment_method: string;
  created_at: string;
  item: { id: string; name: string; code: string; image_url: string | null } | null;
};

const kindLabel: Record<string, { label: string; color: string; icon: string }> = {
  mint: { label: "Mint", color: "#8B5CF6", icon: "✨" },
  sale: { label: "Sale", color: "#10B981", icon: "💰" },
  primary_sale: { label: "Primary Sale", color: "#10B981", icon: "🛒" },
  resale: { label: "Resale", color: "#3B82F6", icon: "🔄" },
  auction_settle: { label: "Auction Won", color: "#F59E0B", icon: "🏆" },
  bid: { label: "Bid", color: "#6366F1", icon: "🔨" },
  gift: { label: "Gift", color: "#EC4899", icon: "🎁" },
};

const endpoints = [
  { method: "GET", path: "/stats", desc: "Global marketplace stats: totals, live auctions, active listings, volume by currency + tx kind." },
  { method: "GET", path: "/collections", desc: "All NFT collections with cover, permalink, and creator store." },
  { method: "GET", path: "/collections/:id", desc: "Single collection by UUID or code (store + item count)." },
  { method: "GET", path: "/collections/:id/items", desc: "Items inside a collection, enriched with image + permalink." },
  { method: "GET", path: "/items", desc: "All active items. Filter by ?creator_id, ?category, ?collection_id." },
  { method: "GET", path: "/items/:id", desc: "Single item by UUID or code (full detail + store)." },
  { method: "GET", path: "/items/:id/owners", desc: "Every holder of an item with quantity + acquired timestamps." },
  { method: "GET", path: "/items/:id/transactions", desc: "Full transaction history for one item." },
  { method: "GET", path: "/items/:id/listings", desc: "All listings (active + past) for one item." },
  { method: "GET", path: "/items/:id/auctions", desc: "All auctions ever created for one item." },
  { method: "GET", path: "/stores", desc: "Directory of every creator store. ?verified=true for verified only." },
  { method: "GET", path: "/stores/:handle", desc: "Public creator store: profile, socials, followers, up to 50 items." },
  { method: "GET", path: "/stores/:handle/items", desc: "All items belonging to a store (paginated)." },
  { method: "GET", path: "/stores/:handle/transactions", desc: "Sales & mints originating from a store." },
  { method: "GET", path: "/owners/:user_id", desc: "Every NFT held by a user (UUID or @username) with quantity + item details." },
  { method: "GET", path: "/collectibles/:username_or_user_id", desc: "OpenPay Pro collectibles feed — resolve by OpenPay @username or user id." },
  { method: "GET", path: "/collectibles/:username_or_user_id/items/:item_id", desc: "Ownership check for one collectible (UUID or item code)." },
  { method: "GET", path: "/listings", desc: "Marketplace listings feed. ?status=active|sold|cancelled." },
  { method: "GET", path: "/auctions", desc: "Auction feed with item + seller. ?status=live|ended|cancelled." },
  { method: "GET", path: "/auctions/:id", desc: "Single auction with full bid history sorted high → low." },
  { method: "GET", path: "/auctions/:id/bids", desc: "All bids on one auction." },
  { method: "GET", path: "/transactions", desc: "Every completed transaction. Filter by ?kind, ?currency, ?payment_method, ?since, ?collection_id." },
  { method: "GET", path: "/transactions/:id", desc: "Single transaction with buyer, seller, and item detail." },
  { method: "GET", path: "/activity", desc: "Alias of /transactions — chronological mint/sale/auction/gift feed." },
  { method: "GET", path: "/activity/mints", desc: "Mints only." },
  { method: "GET", path: "/activity/sales", desc: "Sale + primary_sale + resale." },
  { method: "GET", path: "/activity/auctions", desc: "Auction settlements, starts, and bids." },
  { method: "GET", path: "/activity/gifts", desc: "Gifted NFTs." },
];

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied");
};

const Code = ({ children }: { children: string }) => (
  <div className="relative group">
    <pre className="text-xs md:text-sm overflow-x-auto rounded-xl p-4 bg-slate-950 text-slate-100 border border-slate-800">
      <code>{children}</code>
    </pre>
    <button
      type="button"
      onClick={() => copy(children)}
      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[11px] px-2 py-1 rounded-md bg-white/10 text-white hover:bg-white/20 inline-flex items-center gap-1"
    >
      <Copy className="w-3 h-3" /> Copy
    </button>
  </div>
);

const NftApiPage = () => {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [stats, setStats] = useState<{ collections: number; active_items: number; mints: number; sales: number; auctions: number; total_volume: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: tx }, { data: colCount }, { data: itemCount }] = await Promise.all([
        supabase.from("nft_transactions")
          .select("id, tx_kind, quantity, price_each, total, currency, payment_method, created_at, nft_items!inner(id, name, code, image_url)")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("nft_collections").select("id", { count: "exact", head: true }) as unknown as { data: { count: number } | null },
        supabase.from("nft_items").select("id", { count: "exact", head: true }).eq("is_active", true) as unknown as { data: { count: number } | null },
      ]);

      const activity: ActivityRow[] = (tx || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        type: r.tx_kind as string,
        quantity: r.quantity as number,
        price_each: Number(r.price_each || 0),
        total: Number(r.total || 0),
        currency: (r.currency as string) || "OUSD",
        payment_method: r.payment_method as string,
        created_at: r.created_at as string,
        item: r.nft_items ? {
          id: (r.nft_items as Record<string, unknown>).id as string,
          name: (r.nft_items as Record<string, unknown>).name as string,
          code: (r.nft_items as Record<string, unknown>).code as string,
          image_url: (r.nft_items as Record<string, unknown>).image_url as string | null,
        } : null,
      }));
      setRows(activity);

      // Aggregate stats client-side (also served by /stats)
      const kinds = (tx || []).reduce((acc: Record<string, number>, r) => {
        const k = (r as Record<string, unknown>).tx_kind as string;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      const vol: Record<string, number> = {};
      for (const r of tx || []) {
        const c = ((r as Record<string, unknown>).currency as string) || "OUSD";
        vol[c] = (vol[c] || 0) + Number((r as Record<string, unknown>).total || 0);
      }
      setStats({
        collections: (colCount as unknown as { count?: number })?.count || 0,
        active_items: (itemCount as unknown as { count?: number })?.count || 0,
        mints: kinds.mint || 0,
        sales: (kinds.sale || 0) + (kinds.primary_sale || 0) + (kinds.resale || 0),
        auctions: (kinds.auction_settle || 0) + (kinds.bid || 0),
        total_volume: vol,
      });
      setLoading(false);
    })();

    const channel = supabase.channel("nft-api-activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "nft_transactions" }, () => {
        // Re-fetch small feed
        supabase.from("nft_transactions")
          .select("id, tx_kind, quantity, price_each, total, currency, payment_method, created_at, nft_items!inner(id, name, code, image_url)")
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data }) => {
            if (!data) return;
            setRows(data.map((r: Record<string, unknown>) => ({
              id: r.id as string,
              type: r.tx_kind as string,
              quantity: r.quantity as number,
              price_each: Number(r.price_each || 0),
              total: Number(r.total || 0),
              currency: (r.currency as string) || "OUSD",
              payment_method: r.payment_method as string,
              created_at: r.created_at as string,
              item: r.nft_items ? {
                id: (r.nft_items as Record<string, unknown>).id as string,
                name: (r.nft_items as Record<string, unknown>).name as string,
                code: (r.nft_items as Record<string, unknown>).code as string,
                image_url: (r.nft_items as Record<string, unknown>).image_url as string | null,
              } : null,
            })));
          });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const timeAgo = useMemo(() => (d: string) => {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }, []);

  return (
    <NftPageShell>
      <div className="max-w-6xl mx-auto px-4 pt-6 pb-24 space-y-8">
        {/* Hero */}
        <div className="theme-fixed rounded-3xl p-6 md:p-10 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #003087 0%, #0070BA 100%)" }}>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold mb-4">
              <Zap className="w-3 h-3" /> LIVE · v1.0
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white mb-2">NFT Collections API</h1>
            <p className="text-white/85 max-w-2xl">
              Public, read-only endpoints for mints, sales, auctions, gifts, and transfers across every OpenPay NFT collection. Perfect for OpenLedger, explorers, dashboards, or bots.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={`${API_BASE}/stats`} target="_blank" rel="noreferrer" className="nft-on-media inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#0070BA] font-semibold text-sm">
                <ExternalLink className="w-4 h-4" /> Try /stats
              </a>
              <a href={`${API_BASE}/activity`} target="_blank" rel="noreferrer" className="nft-on-media inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white font-semibold text-sm border border-white/30">
                <Activity className="w-4 h-4" /> Try /activity
              </a>
              <Link to="/web3/nft/api/collectibles" className="nft-on-media inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white font-semibold text-sm border border-white/30">
                Collectibles API (Pro)
              </Link>
              <Link to="/web3/nft" className="nft-on-media inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 text-white font-semibold text-sm border border-white/30">
                Marketplace
              </Link>
            </div>
          </div>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Collections", value: stats?.collections ?? "—", icon: Layers, color: "#8B5CF6" },
            { label: "Active Items", value: stats?.active_items ?? "—", icon: Package, color: "#0070BA" },
            { label: "Recent Mints", value: stats?.mints ?? "—", icon: Zap, color: "#EC4899" },
            { label: "Recent Sales", value: stats?.sales ?? "—", icon: TrendingUp, color: "#10B981" },
            { label: "Auction Events", value: stats?.auctions ?? "—", icon: Activity, color: "#F59E0B" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl p-4 border bg-card">
              <s.icon className="w-5 h-5 mb-2" style={{ color: s.color }} />
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-black">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Base URL */}
        <div className="rounded-2xl border p-5 bg-card">
          <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-2"><Code2 className="w-4 h-4" /> BASE URL</div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-950 text-slate-100 px-3 py-2 font-mono text-xs md:text-sm break-all">
            <span className="flex-1">{API_BASE}</span>
            <button type="button" onClick={() => copy(API_BASE)} className="p-1 rounded hover:bg-white/10"><Copy className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">No API key required. CORS is open. Edge cached (~15s).</p>
        </div>

        {/* Endpoints */}
        <div>
          <h2 className="text-2xl font-black mb-3">Endpoints</h2>
          <div className="rounded-2xl border overflow-hidden bg-card divide-y">
            {endpoints.map((e) => (
              <div key={e.path} className="p-4 hover:bg-muted/40 transition flex items-start gap-3">
                <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-500/15 text-green-600">{e.method}</span>
                <div className="flex-1 min-w-0">
                  <a href={`${API_BASE}${e.path.replace(/:.*$/, "")}`} target="_blank" rel="noreferrer" className="font-mono text-sm font-semibold hover:underline break-all">
                    {e.path}
                  </a>
                  <p className="text-xs text-muted-foreground mt-1">{e.desc}</p>
                </div>
                <button type="button" onClick={() => copy(`${API_BASE}${e.path}`)} className="p-2 rounded-lg hover:bg-muted"><Copy className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Examples */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-bold mb-2">cURL</h3>
            <Code>{`curl "${API_BASE}/activity?limit=10"`}</Code>
          </div>
          <div>
            <h3 className="text-sm font-bold mb-2">JavaScript</h3>
            <Code>{`const res = await fetch(
  "${API_BASE}/activity/sales?limit=25"
);
const { activity } = await res.json();
console.log(activity);`}</Code>
          </div>
          <div>
            <h3 className="text-sm font-bold mb-2">Sample activity response</h3>
            <Code>{`{
  "activity": [{
    "id": "…",
    "type": "sale",
    "quantity": 1,
    "price_each": 25.00,
    "total": 25.00,
    "royalty_amount": 1.25,
    "platform_fee": 0.75,
    "currency": "OUSD",
    "payment_method": "openpay_balance",
    "seller_id": "…",
    "buyer_id": "…",
    "created_at": "2026-07-19T…Z",
    "item": {
      "id": "…", "name": "…", "code": "…",
      "image": "https://…/nft.jpg",
      "image_url": "…", "media_url": "…",
      "collection_id": "…", "creator_id": "…",
      "permalink": "https://openpay.lovable.app/web3/nft/…",
      "collection_url": "https://openpay.lovable.app/web3/nft?collection=…",
      "store": {
        "handle": "artstudio",
        "display_name": "Art Studio",
        "avatar_url": "…",
        "is_verified": true,
        "url": "https://openpay.lovable.app/web3/nft/store/artstudio"
      }
    },
    "marketplace_url": "https://openpay.lovable.app/web3/nft"
  }]
}`}</Code>
          </div>
          <div>
            <h3 className="text-sm font-bold mb-2">OpenLedger integration</h3>
            <Code>{`// Poll every 15s and stream new events into OpenLedger
setInterval(async () => {
  const r = await fetch(
    "${API_BASE}/activity?limit=50"
  );
  const { activity } = await r.json();
  for (const ev of activity) {
    openLedger.record({
      source: "openpay-nft",
      kind: ev.type,
      ref: ev.id,
      amount: ev.total,
      currency: ev.currency,
      at: ev.created_at,
    });
  }
}, 15_000);`}</Code>
          </div>
        </div>

        {/* Live Feed */}
        <div>
          <h2 className="text-2xl font-black mb-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live Activity Feed
          </h2>
          <div className="rounded-2xl border bg-card overflow-hidden">
            {loading && <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}
            {!loading && rows.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>}
            {!loading && rows.length > 0 && (
              <div className="divide-y">
                {rows.map((r) => {
                  const meta = kindLabel[r.type] || { label: r.type, color: "#6B7280", icon: "•" };
                  return (
                    <Link key={r.id} to={r.item ? `/web3/nft/${r.item.id}` : "#"} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition">
                      {r.item?.image_url ? (
                        <img src={r.item.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">{meta.icon}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: meta.color, backgroundColor: `${meta.color}20` }}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold truncate">{r.item?.name || "Unknown item"}</div>
                        <div className="text-xs text-muted-foreground">Qty {r.quantity} · {r.payment_method}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-black">{Number(r.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-[10px] text-muted-foreground">{r.currency}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </NftPageShell>
  );
};

export default NftApiPage;
