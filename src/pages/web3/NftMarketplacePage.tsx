import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, Plus, LayoutDashboard, Users, Tag, HelpCircle, Sparkles, Gavel, Store, Search, BadgeCheck, X, RefreshCw } from "lucide-react";
import { playNftSound } from "@/lib/nftFx";
import { NFT_CATEGORIES, getCategoryMeta } from "@/lib/nftCategories";

const ACCENT = "hsl(217 91% 60%)";

interface NftRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  image_url: string | null;
  media_url: string | null;
  media_type: string;
  quantity_total: number;
  price: number;
  currency: string;
  creator_id: string;
  category?: string | null;
}

interface StoreRow {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  category: string | null;
  is_verified: boolean | null;
}

const NftMarketplacePage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [items, setItems] = useState<NftRow[]>([]);
  const [owners, setOwners] = useState<Record<string, number>>({});
  const [sales, setSales] = useState<Record<string, number>>({});
  const [auctions, setAuctions] = useState<Record<string, any>>({});
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeByUser, setStoreByUser] = useState<Record<string, StoreRow>>({});
  const [storeItemCounts, setStoreItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullProgress, setPullProgress] = useState(0); // 0..1
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    // 1) Fetch the items + stores quickly and render them.
    const [{ data: itemData }, { data: storeData }] = await Promise.all([
      (supabase as any)
        .from("nft_items")
        .select("id,name,code,description,image_url,media_url,media_type,quantity_total,price,currency,creator_id,category")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(120),
      (supabase as any)
        .from("nft_store_profiles")
        .select("user_id, handle, display_name, avatar_url, banner_url, category, is_verified")
        .order("view_count", { ascending: false })
        .limit(40),
    ]);
    const list = (itemData as NftRow[]) || [];
    const sList = (storeData as StoreRow[]) || [];
    setItems(list);
    setStores(sList);
    const sMap: Record<string, StoreRow> = {};
    sList.forEach((s) => { sMap[s.user_id] = s; });
    setStoreByUser(sMap);
    const counts: Record<string, number> = {};
    list.forEach((it) => { counts[it.creator_id] = (counts[it.creator_id] || 0) + 1; });
    setStoreItemCounts(counts);
    setLoading(false);

    // 2) Background-load stats so the UI is not blocked.
    if (list.length) {
      const ids = list.map((i) => i.id);
      Promise.all([
        (supabase as any).from("nft_ownership").select("item_id, owner_id, quantity").in("item_id", ids),
        (supabase as any).from("nft_transactions").select("item_id, quantity, tx_kind").in("item_id", ids).in("tx_kind", ["sale","resale"]),
        (supabase as any).from("nft_auctions").select("item_id, current_bid, start_price, ends_at").in("item_id", ids).eq("status", "active"),
      ]).then(([{ data: own }, { data: tx }, { data: au }]) => {
        const ownerCount: Record<string, number> = {};
        (own || []).forEach((o: any) => { if (Number(o.quantity) > 0) ownerCount[o.item_id] = (ownerCount[o.item_id] || 0) + 1; });
        setOwners(ownerCount);
        const soldMap: Record<string, number> = {};
        (tx || []).forEach((t: any) => { soldMap[t.item_id] = (soldMap[t.item_id] || 0) + Number(t.quantity || 0); });
        setSales(soldMap);
        const auMap: Record<string, any> = {};
        (au || []).forEach((a: any) => { auMap[a.item_id] = a; });
        setAuctions(auMap);
      }).finally(() => setRefreshing(false));
    } else {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load("initial"); }, [load]);

  // Pull-up-to-refresh when scrolled to the bottom.
  const pullRef = useRef({ startY: 0, pulling: false, fired: false });
  useEffect(() => {
    const THRESHOLD = 90;
    const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const onTouchStart = (e: TouchEvent) => {
      if (!atBottom()) return;
      pullRef.current = { startY: e.touches[0].clientY, pulling: true, fired: false };
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pullRef.current.pulling) return;
      const dy = pullRef.current.startY - e.touches[0].clientY;
      if (dy <= 0) { setPullProgress(0); return; }
      setPullProgress(Math.min(1, dy / THRESHOLD));
      if (dy > THRESHOLD && !pullRef.current.fired) {
        pullRef.current.fired = true;
        load("refresh");
      }
    };
    const onTouchEnd = () => { pullRef.current.pulling = false; setPullProgress(0); };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && (it.category || "general") !== category) return false;
      if (!q) return true;
      const store = storeByUser[it.creator_id];
      return (
        it.name.toLowerCase().includes(q) ||
        (it.code || "").toLowerCase().includes(q) ||
        (it.description || "").toLowerCase().includes(q) ||
        (store?.handle || "").toLowerCase().includes(q) ||
        (store?.display_name || "").toLowerCase().includes(q)
      );
    });
  }, [items, search, category, storeByUser]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stores.filter((s) => {
      if (category !== "all" && (s.category || "general") !== category) return false;
      if (!q) return true;
      return (
        (s.handle || "").toLowerCase().includes(q) ||
        (s.display_name || "").toLowerCase().includes(q)
      );
    });
  }, [stores, search, category]);

  const recommendedStores = useMemo(() => {
    return [...filteredStores]
      .sort((a, b) => (storeItemCounts[b.user_id] || 0) - (storeItemCounts[a.user_id] || 0))
      .slice(0, 10);
  }, [filteredStores, storeItemCounts]);

  return (
    <div className="min-h-screen bg-black text-white pb-24 animate-in fade-in duration-500">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-2 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-extrabold flex-1 truncate">NFT Marketplace</h1>
        <button onClick={() => nav("/web3/nft/how-to")} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="How it works">
          <HelpCircle className="h-5 w-5" />
        </button>
        <button onClick={() => nav("/web3/nft/dashboard")} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="Creator dashboard">
          <LayoutDashboard className="h-5 w-5" />
        </button>
        <button onClick={() => nav("/web3/nft/store")} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="My store">
          <Store className="h-5 w-5" />
        </button>
        <button onClick={() => nav("/web3/nft/create")} className="h-9 px-3 rounded-full flex items-center gap-1 font-semibold text-sm" style={{ backgroundColor: ACCENT }}>
          <Plus className="h-4 w-4" /> Mint
        </button>
      </header>

      {/* Search bar */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NFTs, stores, creators…"
            className="w-full bg-[#0f0f0f] border border-white/10 rounded-full pl-9 pr-9 py-2.5 text-sm outline-none focus:border-white/30 transition"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
          )}
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
                className={`shrink-0 snap-start px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
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

      <div className="px-4 pt-4 space-y-5">
        {!loading && items.length > 0 && (
          <button
            onClick={() => nav("/web3/nft/how-to")}
            className="w-full rounded-2xl p-3 flex items-center gap-3 text-left border border-white/10 bg-gradient-to-r from-blue-600/20 to-blue-900/10"
          >
            <div className="h-9 w-9 rounded-full flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">New to NFTs?</p>
              <p className="text-[11px] text-white/60">Learn how to mint, buy, resell and auction in 1 minute.</p>
            </div>
            <span className="text-xs font-bold" style={{ color: ACCENT }}>View →</span>
          </button>
        )}

        {loading ? (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="w-44 shrink-0 rounded-2xl overflow-hidden bg-white/5">
                  <div className="aspect-square bg-gradient-to-br from-white/5 via-white/10 to-white/5 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-white/5">
                  <div className="aspect-square bg-gradient-to-br from-white/5 via-white/10 to-white/5 animate-pulse" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
                    <div className="h-4 w-1/3 rounded bg-white/10 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center mt-24">
            <p className="text-white/70 font-semibold">No NFTs yet</p>
            <p className="text-white/50 text-sm mt-1">Be the first to mint a collectible.</p>
            <button onClick={() => nav("/web3/nft/create")} className="mt-6 rounded-full px-6 py-3 font-bold" style={{ backgroundColor: ACCENT }}>
              Mint your NFT
            </button>
          </div>
        ) : (() => {
          const recommended = [...filteredItems]
            .sort((a, b) => (sales[b.id] || 0) - (sales[a.id] || 0) || (owners[b.id] || 0) - (owners[a.id] || 0))
            .slice(0, 6);

          const renderCard = (it: NftRow) => {
            const img = it.media_url || it.image_url || "";
            const au = auctions[it.id];
            const store = storeByUser[it.creator_id];
            const cat = getCategoryMeta(it.category);
            return (
              <button
                key={it.id}
                onClick={() => { playNftSound("list"); nav(`/web3/nft/${it.id}`); }}
                className="text-left rounded-2xl overflow-hidden bg-[#0f0f0f] border border-white/5 hover:border-white/20 hover:scale-[1.02] transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
              >
                <div className="aspect-square bg-[#161616] flex items-center justify-center overflow-hidden relative">
                  {img ? <img src={img} alt={it.name} className="h-full w-full object-cover" /> : <span className="text-white/30 text-sm">No image</span>}
                  {au && (
                    <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full bg-black/70 flex items-center gap-1" style={{ color: ACCENT }}>
                      <Gavel className="h-3 w-3" /> LIVE AUCTION
                    </span>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-white/80">
                    {cat.emoji} {cat.label}
                  </span>
                </div>
                <div className="p-3">
                  {/* Owner store strip */}
                  {store && (
                    <div
                      onClick={(e) => { e.stopPropagation(); nav(`/web3/nft/store/${store.handle}`); }}
                      className="flex items-center gap-1.5 mb-1.5 group/store cursor-pointer"
                      role="link"
                    >
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />
                      )}
                      <span className="text-[11px] text-white/60 truncate group-hover/store:text-white">@{store.handle}</span>
                      {store.is_verified && <BadgeCheck className="h-3 w-3" style={{ color: ACCENT }} />}
                    </div>
                  )}
                  <p className="font-bold text-sm truncate">{it.name}</p>
                  <p className="text-xs text-white/40 truncate">#{it.code}</p>
                  <p className="mt-2 font-bold text-[15px]" style={{ color: ACCENT }}>
                    {au ? format(Number(au.current_bid || au.start_price || 0)) : format(Number(it.price || 0))}
                    {au && <span className="text-[10px] text-white/50 font-normal ml-1">bid</span>}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-white/55">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{owners[it.id] || 0}</span>
                    <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{sales[it.id] || 0} sold</span>
                    <span className="ml-auto">/{it.quantity_total}</span>
                  </div>
                </div>
              </button>
            );
          };

          const renderStore = (s: StoreRow) => (
            <button
              key={s.user_id}
              onClick={() => nav(`/web3/nft/store/${s.handle}`)}
              className="w-44 shrink-0 snap-start rounded-2xl overflow-hidden bg-[#0f0f0f] border border-white/5 hover:border-white/20 hover:scale-[1.02] transition-all text-left animate-in fade-in"
            >
              <div
                className="h-16 w-full"
                style={s.banner_url
                  ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: `linear-gradient(135deg, hsl(280 80% 30%), ${ACCENT})` }}
              />
              <div className="px-3 pb-3 -mt-6 relative">
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="h-12 w-12 rounded-full ring-2 ring-black object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full ring-2 ring-black bg-gradient-to-br from-pink-500 to-blue-500" />
                )}
                <div className="mt-2 flex items-center gap-1">
                  <p className="font-bold text-sm truncate">{s.display_name || s.handle}</p>
                  {s.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />}
                </div>
                <p className="text-[11px] text-white/50 truncate">@{s.handle}</p>
                <p className="text-[10px] text-white/40 mt-1">
                  {getCategoryMeta(s.category).emoji} {getCategoryMeta(s.category).label} · {storeItemCounts[s.user_id] || 0} items
                </p>
              </div>
            </button>
          );

          return (
            <>
              {recommendedStores.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="h-4 w-4" style={{ color: ACCENT }} />
                    <h2 className="font-extrabold">Browse stores</h2>
                    <button onClick={() => nav("/web3/nft/stores")} className="ml-auto text-xs font-bold" style={{ color: ACCENT }}>View all →</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2 snap-x">
                    {recommendedStores.map(renderStore)}
                  </div>
                </div>
              )}

              {recommended.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                    <h2 className="font-extrabold">Recommended for you</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-2 snap-x">
                    {recommended.map((it) => (
                      <div key={it.id} className="w-44 shrink-0 snap-start">{renderCard(it)}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-extrabold">
                    {category === "all" ? "All NFTs" : `${getCategoryMeta(category).emoji} ${getCategoryMeta(category).label}`}
                  </h2>
                  <span className="text-xs text-white/50">{filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</span>
                </div>
                {filteredItems.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border border-dashed border-white/10">
                    <p className="text-sm text-white/60">No NFTs match your search.</p>
                    <button onClick={() => { setSearch(""); setCategory("all"); }} className="mt-3 text-xs font-bold" style={{ color: ACCENT }}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">{filteredItems.map(renderCard)}</div>
                )}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
};

export default NftMarketplacePage;
