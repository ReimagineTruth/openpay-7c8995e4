import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ArrowLeft, Flame, Trophy, Star, BadgeCheck, ArrowUp, ArrowDown,
  LayoutGrid, List as ListIcon,
} from "lucide-react";
import { getCategoryMeta, NFT_CATEGORIES } from "@/lib/nftCategories";

const ACCENT = "hsl(217 91% 60%)";
const WATCH_KEY = "openpay.nft.watchlist";

type Tab = "trending" | "top" | "watchlist";
type Range = "all" | "30d" | "7d" | "1d" | "1h" | "15m" | "5m" | "1m";

const RANGES: { id: Range; label: string; ms: number | null }[] = [
  { id: "all", label: "All", ms: null },
  { id: "30d", label: "30d", ms: 30 * 86400000 },
  { id: "7d", label: "7d", ms: 7 * 86400000 },
  { id: "1d", label: "1d", ms: 86400000 },
  { id: "1h", label: "1h", ms: 3600000 },
  { id: "15m", label: "15m", ms: 15 * 60000 },
  { id: "5m", label: "5m", ms: 5 * 60000 },
  { id: "1m", label: "1m", ms: 60000 },
];

interface StoreRow {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  category: string | null;
  is_verified: boolean | null;
}
interface ItemRow {
  id: string; creator_id: string; price: number; quantity_total: number; category: string | null;
}
interface TxRow {
  item_id: string; quantity: number; unit_price: number | null; total_amount: number | null; created_at: string; tx_kind: string;
}
interface OwnRow { item_id: string; owner_id: string; quantity: number; }

interface StoreStat {
  store: StoreRow;
  floor: number;
  supply: number;
  owners: number;
  volume: number;
  volumePrev: number;
  sales: number;
  changePct: number | null;
}

const loadWatch = (): string[] => {
  try { return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]"); } catch { return []; }
};
const saveWatch = (ids: string[]) => localStorage.setItem(WATCH_KEY, JSON.stringify(ids));

const fmtNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const NftStoresPage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [tab, setTab] = useState<Tab>("trending");
  const [range, setRange] = useState<Range>("1d");
  const [category, setCategory] = useState<string>("all");
  const [view, setView] = useState<"table" | "grid">("table");
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [owns, setOwns] = useState<OwnRow[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(loadWatch());

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: it }] = await Promise.all([
        (supabase as any)
          .from("nft_store_profiles")
          .select("user_id, handle, display_name, avatar_url, category, is_verified"),
        (supabase as any)
          .from("nft_items")
          .select("id, creator_id, price, quantity_total, category")
          .eq("is_active", true),
      ]);
      const storeList = (s as StoreRow[]) || [];
      const itemList = (it as ItemRow[]) || [];
      setStores(storeList);
      setItems(itemList);
      if (itemList.length) {
        const ids = itemList.map((x) => x.id);
        const [{ data: tx }, { data: ow }] = await Promise.all([
          (supabase as any)
            .from("nft_transactions")
            .select("item_id, quantity, unit_price, total_amount, created_at, tx_kind")
            .in("item_id", ids)
            .in("tx_kind", ["sale", "resale", "auction_settle"]),
          (supabase as any)
            .from("nft_ownership")
            .select("item_id, owner_id, quantity")
            .in("item_id", ids)
            .gt("quantity", 0),
        ]);
        setTxs((tx as TxRow[]) || []);
        setOwns((ow as OwnRow[]) || []);
      }
      setLoading(false);
    })();
  }, []);

  const toggleWatch = (id: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveWatch(next);
      return next;
    });
  };

  const stats: StoreStat[] = useMemo(() => {
    const rangeMs = RANGES.find((r) => r.id === range)?.ms;
    const now = Date.now();
    const startCur = rangeMs ? now - rangeMs : 0;
    const startPrev = rangeMs ? now - 2 * rangeMs : 0;

    // Group items by creator
    const itemsByCreator: Record<string, ItemRow[]> = {};
    items.forEach((it) => {
      (itemsByCreator[it.creator_id] ||= []).push(it);
    });
    // Item -> creator
    const itemCreator: Record<string, string> = {};
    items.forEach((it) => { itemCreator[it.id] = it.creator_id; });

    // Owners per creator (distinct owner ids across items)
    const ownersByCreator: Record<string, Set<string>> = {};
    owns.forEach((o) => {
      const c = itemCreator[o.item_id];
      if (!c) return;
      (ownersByCreator[c] ||= new Set()).add(o.owner_id);
    });

    // Volume / sales per creator
    const volCur: Record<string, number> = {};
    const volPrev: Record<string, number> = {};
    const salesCur: Record<string, number> = {};
    txs.forEach((t) => {
      const c = itemCreator[t.item_id];
      if (!c) return;
      const ts = new Date(t.created_at).getTime();
      const amount = Number(t.total_amount || (Number(t.unit_price || 0) * Number(t.quantity || 0)));
      if (!rangeMs || ts >= startCur) {
        volCur[c] = (volCur[c] || 0) + amount;
        salesCur[c] = (salesCur[c] || 0) + Number(t.quantity || 0);
      }
      if (rangeMs && ts >= startPrev && ts < startCur) {
        volPrev[c] = (volPrev[c] || 0) + amount;
      }
    });

    return stores.map((st) => {
      const its = itemsByCreator[st.user_id] || [];
      const floor = its.length ? Math.min(...its.map((i) => Number(i.price || 0))) : 0;
      const supply = its.reduce((s, i) => s + Number(i.quantity_total || 0), 0);
      const vCur = volCur[st.user_id] || 0;
      const vPrev = volPrev[st.user_id] || 0;
      const change = rangeMs && vPrev > 0 ? ((vCur - vPrev) / vPrev) * 100 : (rangeMs && vCur > 0 ? 100 : null);
      return {
        store: st,
        floor,
        supply,
        owners: (ownersByCreator[st.user_id] || new Set()).size,
        volume: vCur,
        volumePrev: vPrev,
        sales: salesCur[st.user_id] || 0,
        changePct: change,
      };
    });
  }, [stores, items, txs, owns, range]);

  const filtered = useMemo(() => {
    let list = stats;
    if (category !== "all") {
      list = list.filter((s) => (s.store.category || "general") === category);
    }
    if (tab === "watchlist") {
      list = list.filter((s) => watchlist.includes(s.store.user_id));
    }
    if (tab === "top") {
      list = [...list].sort((a, b) => b.volume - a.volume || b.sales - a.sales);
    } else if (tab === "trending") {
      list = [...list].sort((a, b) => {
        const ca = a.changePct ?? -Infinity;
        const cb = b.changePct ?? -Infinity;
        return cb - ca || b.volume - a.volume;
      });
    }
    return list;
  }, [stats, category, tab, watchlist]);

  return (
    <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in duration-300">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold flex-1">Stores Leaderboard</h1>
        <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
          <button
            onClick={() => setView("table")}
            className={`h-7 w-7 rounded-full flex items-center justify-center ${view === "table" ? "bg-white/15" : ""}`}
            aria-label="Table view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`h-7 w-7 rounded-full flex items-center justify-center ${view === "grid" ? "bg-white/15" : ""}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tabs + ranges */}
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
          <TabBtn active={tab === "trending"} onClick={() => setTab("trending")} icon={<Flame className="h-3.5 w-3.5" />} label="Trending" />
          <TabBtn active={tab === "top"} onClick={() => setTab("top")} icon={<Trophy className="h-3.5 w-3.5" />} label="Top" />
          <TabBtn active={tab === "watchlist"} onClick={() => setTab("watchlist")} icon={<Star className="h-3.5 w-3.5" />} label="Watchlist" />
        </div>
        <div className="ml-auto flex items-center gap-1 overflow-x-auto bg-white/5 rounded-full p-1 border border-white/10">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                range === r.id ? "text-black" : "text-white/60 hover:text-white"
              }`}
              style={range === r.id ? { background: ACCENT } : {}}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 mt-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 snap-x">
          {[{ id: "all", label: "All", emoji: "🛒" }, ...NFT_CATEGORIES].map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`shrink-0 snap-start px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  active ? "border-transparent text-black" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
                style={active ? { background: ACCENT } : {}}
              >
                <span className="mr-1">{c.emoji}</span>{c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="px-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <p className="text-white/70 font-semibold">
              {tab === "watchlist" ? "Your watchlist is empty" : "No stores match"}
            </p>
            <p className="text-white/50 text-sm mt-1">
              {tab === "watchlist" ? "Star a store to add it here." : "Try a different range or category."}
            </p>
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto px-2">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/40">
                  <th className="text-left font-semibold px-2 py-2 w-8"></th>
                  <th className="text-left font-semibold px-2 py-2">Store</th>
                  <th className="text-right font-semibold px-2 py-2">Floor</th>
                  <th className="text-right font-semibold px-2 py-2">{range.toUpperCase()} Change</th>
                  <th className="text-right font-semibold px-2 py-2">{range.toUpperCase()} Vol</th>
                  <th className="text-right font-semibold px-2 py-2">{range.toUpperCase()} Sales</th>
                  <th className="text-right font-semibold px-2 py-2">Owners</th>
                  <th className="text-right font-semibold px-2 py-2 pr-4">Supply</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => {
                  const watched = watchlist.includes(s.store.user_id);
                  const change = s.changePct;
                  const cat = getCategoryMeta(s.store.category);
                  return (
                    <tr
                      key={s.store.user_id}
                      onClick={() => nav(`/web3/nft/store/${s.store.handle}`)}
                      className="border-t border-white/5 hover:bg-white/5 cursor-pointer transition"
                    >
                      <td className="px-2 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWatch(s.store.user_id); }}
                          aria-label="Toggle watchlist"
                          className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
                        >
                          <Star className={`h-4 w-4 ${watched ? "fill-yellow-400 text-yellow-400" : "text-white/40"}`} />
                        </button>
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-white/40 w-5 text-right">{idx + 1}</span>
                          {s.store.avatar_url ? (
                            <img src={s.store.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-pink-500 to-blue-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold truncate">{s.store.display_name || s.store.handle}</p>
                              {s.store.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />}
                            </div>
                            <p className="text-[11px] text-white/50 truncate">@{s.store.handle} · {cat.emoji} {cat.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-right font-semibold">{s.floor > 0 ? format(s.floor) : "—"}</td>
                      <td className="px-2 py-3 text-right">
                        {change === null ? (
                          <span className="text-white/40">—</span>
                        ) : (
                          <span className={`font-semibold inline-flex items-center gap-0.5 ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {Math.abs(change).toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right font-semibold">{s.volume > 0 ? format(s.volume) : "—"}</td>
                      <td className="px-2 py-3 text-right">{fmtNum(s.sales)}</td>
                      <td className="px-2 py-3 text-right">{fmtNum(s.owners)}</td>
                      <td className="px-2 py-3 text-right pr-4">{fmtNum(s.supply)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map((s, idx) => {
              const watched = watchlist.includes(s.store.user_id);
              const cat = getCategoryMeta(s.store.category);
              return (
                <button
                  key={s.store.user_id}
                  onClick={() => nav(`/web3/nft/store/${s.store.handle}`)}
                  className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-3 text-left hover:border-white/30 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/40">#{idx + 1}</span>
                    {s.store.avatar_url ? (
                      <img src={s.store.avatar_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-pink-500 to-blue-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-bold text-sm truncate">{s.store.display_name || s.store.handle}</p>
                        {s.store.is_verified && <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: ACCENT }} />}
                      </div>
                      <p className="text-[10px] text-white/50 truncate">{cat.emoji} {cat.label}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWatch(s.store.user_id); }}
                      className="h-7 w-7 rounded-full hover:bg-white/10 flex items-center justify-center"
                      aria-label="Toggle watchlist"
                    >
                      <Star className={`h-4 w-4 ${watched ? "fill-yellow-400 text-yellow-400" : "text-white/40"}`} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <Stat label="Floor" value={s.floor > 0 ? format(s.floor) : "—"} />
                    <Stat
                      label={`${range.toUpperCase()} Δ`}
                      value={s.changePct === null ? "—" : `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(1)}%`}
                      tone={s.changePct === null ? undefined : s.changePct >= 0 ? "up" : "down"}
                    />
                    <Stat label="Volume" value={s.volume > 0 ? format(s.volume) : "—"} />
                    <Stat label="Sales" value={fmtNum(s.sales)} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const TabBtn = ({ active, onClick, icon, label }: any) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition ${
      active ? "text-black" : "text-white/70 hover:text-white"
    }`}
    style={active ? { background: ACCENT } : {}}
  >
    {icon}{label}
  </button>
);

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) => (
  <div>
    <p className="text-white/40 uppercase text-[9px] font-bold">{label}</p>
    <p className={`font-semibold ${tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-white"}`}>{value}</p>
  </div>
);

export default NftStoresPage;
