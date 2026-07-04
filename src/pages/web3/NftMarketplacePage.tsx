import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { NftStatusBadge } from "@/lib/nftStatus";
import { formatNftPrice } from "@/lib/nftPrice";
import {
  Plus, LayoutDashboard, Users, Tag, HelpCircle, Sparkles, Gavel, Store, Search,
  BadgeCheck, X, RefreshCw, MessageCircle, Menu, Gift, Image as ImageIcon,
  Settings, Trophy, Heart, Compass, LayoutGrid, Coins, ArrowLeftRight, Calendar,
  Activity as ActivityIcon, Anchor, Wrench, Palette, ChevronRight, ChevronLeft,
  Bell, Wallet, TrendingUp, TrendingDown, Sun, Moon, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { playNftSound } from "@/lib/nftFx";
import { NFT_CATEGORIES, getCategoryMeta } from "@/lib/nftCategories";
import NftPageShell from "@/components/web3/NftPageShell";
import { persistAndApplyAppTheme, getStoredAppTheme } from "@/lib/appTheme";

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

const SIDEBAR_ITEMS = [
  { icon: Compass, label: "Discover", to: "/web3/nft" },
  { icon: LayoutGrid, label: "Collections", to: "/web3/nft/stores" },
  { icon: Coins, label: "My Collection", to: "/web3/nft/my-nfts" },
  { icon: ArrowLeftRight, label: "Swap", to: "/web3/nft/gifts" },
  { icon: Calendar, label: "Drops", to: "/web3/nft/auctions" },
  { icon: ActivityIcon, label: "Activity", to: "/web3/nft/dashboard" },
  { icon: LayoutDashboard, label: "Creator Dashboard", to: "/web3/nft/dashboard" },
  { icon: Anchor, label: "Rewards", to: "/web3/nft/leaderboard" },
  { icon: Wrench, label: "Tools", to: "/web3/nft/store/settings", beta: true },
  { icon: Palette, label: "Studio", to: "/web3/nft/create" },
];

const SECONDARY_ITEMS = [
  { icon: Store, label: "My Store", to: "/web3/nft/store" },
  { icon: Heart, label: "Following", to: "/web3/nft/following" },
  { icon: MessageCircle, label: "Live Chat", to: "/web3/nft/chat", live: true },
  { icon: HelpCircle, label: "How it works", to: "/web3/nft/how-to" },
];

const NftMarketplacePage = () => {
  const nav = useNavigate();
  const location = useLocation();
  const auctionsOnly = location.pathname === "/web3/nft/auctions";
  const { format } = useCurrency();

  const [items, setItems] = useState<NftRow[]>([]);
  const [owners, setOwners] = useState<Record<string, number>>({});
  const [sales, setSales] = useState<Record<string, number>>({});
  const [auctions, setAuctions] = useState<Record<string, any>>({});
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storeByUser, setStoreByUser] = useState<Record<string, StoreRow>>({});
  const [storeItemCounts, setStoreItemCounts] = useState<Record<string, number>>({});
  const [storeFloor, setStoreFloor] = useState<Record<string, { price: number; currency: string }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [tab, setTab] = useState<"nfts" | "tokens">("nfts");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("openpay_nft_sidebar_collapsed") === "1";
  });
  const [theme, setThemeState] = useState<"light" | "dark" | "system">(() => getStoredAppTheme());
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    persistAndApplyAppTheme(next);
  };
  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const nv = !v;
      try { localStorage.setItem("openpay_nft_sidebar_collapsed", nv ? "1" : "0"); } catch {}
      return nv;
    });
  };

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    const [{ data: itemData }, { data: storeData }] = await Promise.all([
      (supabase as any)
        .from("nft_items")
        .select("id,name,code,description,image_url,media_url,media_type,quantity_total,price,currency,creator_id,category")
        .eq("is_active", true)
        .eq("hidden", false)
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
    const floors: Record<string, { price: number; currency: string }> = {};
    list.forEach((it) => {
      counts[it.creator_id] = (counts[it.creator_id] || 0) + 1;
      const cur = floors[it.creator_id];
      if (!cur || it.price < cur.price) floors[it.creator_id] = { price: it.price, currency: it.currency };
    });
    setStoreItemCounts(counts);
    setStoreFloor(floors);
    setLoading(false);

    if (list.length) {
      const ids = list.map((i) => i.id);
      Promise.all([
        (supabase as any).from("nft_ownership").select("item_id, owner_id, quantity").in("item_id", ids),
        (supabase as any).from("nft_transactions").select("item_id, quantity, tx_kind").in("item_id", ids).in("tx_kind", ["sale","primary_sale","resale","auction_settle"]),
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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (auctionsOnly && !auctions[it.id]) return false;
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
  }, [items, search, category, storeByUser, auctionsOnly, auctions]);

  // Hero carousel (top 6 stores that have banner or featured NFTs)
  const heroSlides = useMemo(() => {
    const withBanner = stores.filter((s) => s.banner_url).slice(0, 6);
    if (withBanner.length) return withBanner;
    return stores.slice(0, 6);
  }, [stores]);

  useEffect(() => {
    if (heroSlides.length < 2) return;
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [heroSlides.length]);

  // Collections leaderboard (right rail) — sorted by items count desc
  const leaderboard = useMemo(() => {
    return [...stores]
      .map((s) => ({
        store: s,
        items: storeItemCounts[s.user_id] || 0,
        floor: storeFloor[s.user_id],
        change: ((s.user_id.charCodeAt(0) % 50) - 20) / 10, // pseudo delta
      }))
      .filter((r) => r.items > 0)
      .sort((a, b) => b.items - a.items)
      .slice(0, 14);
  }, [stores, storeItemCounts, storeFloor]);

  const currentSlide = heroSlides[heroIndex];
  const currentSlideItems = useMemo(() => {
    if (!currentSlide) return [] as NftRow[];
    return items.filter((i) => i.creator_id === currentSlide.user_id).slice(0, 3);
  }, [items, currentSlide]);

  const renderCard = (it: NftRow) => {
    const img = it.media_url || it.image_url || "";
    const au = auctions[it.id];
    const store = storeByUser[it.creator_id];
    const cat = getCategoryMeta(it.category);
    return (
      <button
        key={it.id}
        onClick={() => { playNftSound("list"); nav(`/web3/nft/${it.id}`); }}
        className="text-left rounded-2xl overflow-hidden bg-[#0f0f10] border border-white/5 hover:border-white/20 hover:-translate-y-0.5 transition-all duration-200 group"
      >
        <div className="aspect-square bg-[#161616] overflow-hidden relative">
          {img
            ? <img src={img} alt={it.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
            : <div className="h-full w-full flex items-center justify-center text-white/30 text-sm">No image</div>}
          {au && (
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-1 rounded-full bg-black/70 flex items-center gap-1" style={{ color: ACCENT }}>
              <Gavel className="h-3 w-3" /> LIVE
            </span>
          )}
          <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/70 text-white/80">
            {cat.emoji} {cat.label}
          </span>
        </div>
        <div className="p-3">
          {store && (
            <div
              onClick={(e) => { e.stopPropagation(); nav(`/web3/nft/store/${store.handle}`); }}
              className="flex items-center gap-1.5 mb-1"
              role="link"
            >
              {store.avatar_url
                ? <img src={store.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                : <div className="h-4 w-4 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />}
              <span className="text-[11px] text-white/60 truncate hover:text-white">@{store.handle}</span>
              {store.is_verified && <BadgeCheck className="h-3 w-3" style={{ color: ACCENT }} />}
            </div>
          )}
          <p className="font-bold text-sm truncate">{it.name}</p>
          <p className="text-[11px] text-white/40 truncate">#{it.code}</p>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Price</p>
              <p className="font-extrabold text-[14px]" style={{ color: ACCENT }}>
                {au ? formatNftPrice(Number(au.current_bid || au.start_price || 0), it.currency) : formatNftPrice(it.price, it.currency)}
              </p>
            </div>
            <NftStatusBadge sold={sales[it.id] || 0} total={it.quantity_total} hasAuction={!!au} />
          </div>
          <div className="mt-2 flex items-center gap-3 text-[10.5px] text-white/50">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{owners[it.id] || 0}</span>
            <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{sales[it.id] || 0}</span>
            <span className="ml-auto text-white/40">/{it.quantity_total}</span>
          </div>
        </div>
      </button>
    );
  };

  // Sidebar (desktop) + Sheet (mobile) content share
  const Sidebar = ({ compact = false, onNav }: { compact?: boolean; onNav?: () => void }) => (
    <nav className="flex flex-col h-full">
      <div className={`px-4 pt-5 pb-4 flex items-center gap-2 ${compact ? "justify-center" : ""}`}>
        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg,${ACCENT},hsl(217 91% 40%))` }}>
          <Sparkles className="h-4 w-4" />
        </div>
        {!compact && <span className="font-extrabold text-[17px] tracking-tight whitespace-nowrap overflow-hidden">OpenPay NFT</span>}
      </div>
      <div className="px-2 space-y-0.5">
        {SIDEBAR_ITEMS.map((it, idx) => {
          const active = location.pathname === it.to || (it.to === "/web3/nft" && location.pathname === "/web3/nft");
          return (
            <button
              key={it.label}
              onClick={() => { onNav?.(); nav(it.to); }}
              title={compact ? it.label : undefined}
              style={{ animation: `nft-nav-in 0.35s ease-out ${idx * 40}ms both` }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
              } ${compact ? "justify-center" : ""}`}
            >
              <it.icon className="h-[18px] w-[18px] shrink-0" />
              {!compact && (
                <span className="flex-1 text-left flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                  {it.label}
                  {it.beta && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/60">Beta</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!compact && <div className="mx-4 my-4 h-px bg-white/10" />}
      <div className="px-2 space-y-0.5">
        {SECONDARY_ITEMS.map((it, idx) => (
          <button
            key={it.label}
            onClick={() => { onNav?.(); nav(it.to); }}
            title={compact ? it.label : undefined}
            style={{ animation: `nft-nav-in 0.35s ease-out ${(SIDEBAR_ITEMS.length + idx) * 40}ms both` }}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition ${compact ? "justify-center" : ""}`}
          >
            <it.icon className="h-[18px] w-[18px] shrink-0" />
            {!compact && (
              <span className="flex-1 text-left flex items-center gap-1.5 whitespace-nowrap overflow-hidden">
                {it.label}
                {"live" in it && (it as any).live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <div className={`mt-4 px-2`}>
        <button
          onClick={toggleTheme}
          title={compact ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 hover:text-white transition ${compact ? "justify-center" : ""}`}
        >
          {theme === "dark" ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
          {!compact && (
            <span className="flex-1 text-left whitespace-nowrap overflow-hidden">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>
      </div>

      <div className="mt-auto p-3 space-y-2">
        <button
          onClick={() => { onNav?.(); nav("/web3/nft/create"); }}
          title={compact ? "Mint NFT" : undefined}
          className="w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1.5"
          style={{ background: `linear-gradient(135deg,${ACCENT},hsl(217 91% 45%))` }}
        >
          <Plus className="h-4 w-4" /> {!compact && "Mint NFT"}
        </button>
      </div>
      <style>{`
        @keyframes nft-nav-in {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </nav>
  );

  return (
    <NftPageShell className="pb-24 md:pb-6" splashTitle={auctionsOnly ? "Live Auctions" : "OpenPay NFT"}>
      <div className="md:flex md:min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:block shrink-0 border-r border-white/10 bg-[#08080a] sticky top-0 h-screen overflow-y-auto overflow-x-hidden transition-[width] duration-300 ease-out ${
            sidebarCollapsed ? "w-[68px]" : "w-[240px]"
          }`}
        >
          <div className="relative h-full">
            <button
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Expand menu" : "Collapse menu"}
              className="absolute top-4 -right-3 z-10 h-6 w-6 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 flex items-center justify-center backdrop-blur transition"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
            <Sidebar compact={sidebarCollapsed} />
          </div>
        </aside>


        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-black/85 backdrop-blur border-b border-white/5 px-4 md:px-6 py-3 flex items-center gap-2 md:gap-3">
            <button onClick={() => setMenuOpen(true)} className="md:hidden h-9 w-9 rounded-full bg-white/10 flex items-center justify-center" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative flex-1 max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search OpenPay NFT"
                className="w-full bg-[#0f0f10] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-white/30 transition"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white/10 flex items-center justify-center">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button onClick={() => nav("/web3/nft/chat")} className="hidden sm:flex relative h-9 w-9 rounded-full bg-white/10 items-center justify-center" aria-label="Notifications">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
            <button onClick={() => nav("/dashboard")} className="hidden sm:flex h-9 px-3 rounded-full bg-white/10 items-center gap-1.5 text-sm font-bold">
              <Wallet className="h-4 w-4" />
              <span>Wallet</span>
            </button>
            <button onClick={() => load("refresh")} disabled={refreshing} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center disabled:opacity-60" aria-label="Refresh">
              <RefreshCw className={`h-4.5 w-4.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => nav("/web3/nft/create")} className="md:hidden h-9 px-3 rounded-full flex items-center gap-1 text-sm font-bold" style={{ backgroundColor: ACCENT }}>
              <Plus className="h-4 w-4" />
            </button>
          </header>

          {/* Category chips */}
          <div className="px-4 md:px-6 pt-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 md:mx-0 px-4 md:px-0 snap-x flex-1 no-scrollbar">
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
              <div className="hidden md:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
                <button
                  onClick={() => setTab("nfts")}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${tab === "nfts" ? "bg-white/15" : "text-white/60"}`}
                >NFTs</button>
                <button
                  onClick={() => setTab("tokens")}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${tab === "tokens" ? "bg-white/15" : "text-white/60"}`}
                >Tokens</button>
              </div>
            </div>
          </div>

          {/* Main content grid */}
          <div className="px-4 md:px-6 pt-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
            {/* LEFT: Hero + sections */}
            <div className="space-y-6 min-w-0">
              {/* Hero carousel */}
              {heroSlides.length > 0 && (
                <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0f0f10]">
                  <div className="relative aspect-[16/8] md:aspect-[16/6] w-full">
                    {currentSlide?.banner_url ? (
                      <img src={currentSlide.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 30%, hsl(280 80% 30%), #0a0a0a)` }} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="nft-on-media absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6 flex items-end justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {currentSlide?.avatar_url && (
                            <img src={currentSlide.avatar_url} alt="" className="h-8 w-8 rounded-full ring-2 ring-black object-cover" />
                          )}
                          <h2 className="font-extrabold text-lg md:text-2xl truncate">{currentSlide?.display_name || currentSlide?.handle}</h2>
                          {currentSlide?.is_verified && <BadgeCheck className="h-5 w-5" style={{ color: ACCENT }} />}
                        </div>
                        <p className="text-[11px] md:text-xs text-white/60 mt-0.5">By @{currentSlide?.handle}</p>
                        <div className="mt-3 hidden md:flex items-center gap-6 text-xs">
                          <div>
                            <p className="text-white/40 uppercase tracking-wide">Floor</p>
                            <p className="font-bold" style={{ color: ACCENT }}>
                              {storeFloor[currentSlide!.user_id]
                                ? formatNftPrice(storeFloor[currentSlide!.user_id].price, storeFloor[currentSlide!.user_id].currency)
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/40 uppercase tracking-wide">Items</p>
                            <p className="font-bold">{storeItemCounts[currentSlide!.user_id] || 0}</p>
                          </div>
                          <div>
                            <p className="text-white/40 uppercase tracking-wide">Category</p>
                            <p className="font-bold">{getCategoryMeta(currentSlide?.category).emoji} {getCategoryMeta(currentSlide?.category).label}</p>
                          </div>
                        </div>
                      </div>
                      <div className="hidden md:flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => currentSlide && nav(`/web3/nft/store/${currentSlide.handle}`)}
                          className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: ACCENT }}
                        >View collection</button>
                      </div>
                    </div>

                    {/* Preview thumbnails */}
                    {currentSlideItems.length > 0 && (
                      <div className="hidden md:flex absolute right-6 top-6 gap-2">
                        {currentSlideItems.map((it) => {
                          const img = it.media_url || it.image_url || "";
                          return (
                            <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)} className="h-16 w-16 rounded-xl overflow-hidden border border-white/20 hover:border-white/60 transition">
                              {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/10" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Arrows */}
                    {heroSlides.length > 1 && (
                      <>
                        <button onClick={() => setHeroIndex((i) => (i - 1 + heroSlides.length) % heroSlides.length)}
                          className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur items-center justify-center hover:bg-black/80">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={() => setHeroIndex((i) => (i + 1) % heroSlides.length)}
                          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/60 backdrop-blur items-center justify-center hover:bg-black/80">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                  {/* Dots */}
                  <div className="flex items-center justify-center gap-1.5 py-2.5 bg-black/60">
                    {heroSlides.map((_, i) => (
                      <button key={i} onClick={() => setHeroIndex(i)}
                        className={`h-1 rounded-full transition-all ${i === heroIndex ? "w-6 bg-white" : "w-1.5 bg-white/30"}`} />
                    ))}
                  </div>
                </div>
              )}

              {/* Trending Tokens style row (using top items) */}
              {!loading && filteredItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-extrabold text-base">Trending Tokens</h3>
                      <p className="text-[11px] text-white/50">NFTs with momentum today</p>
                    </div>
                    <button onClick={() => nav("/web3/nft/auctions")} className="text-xs font-bold" style={{ color: ACCENT }}>View all →</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...filteredItems]
                      .sort((a, b) => (sales[b.id] || 0) - (sales[a.id] || 0) || (owners[b.id] || 0) - (owners[a.id] || 0))
                      .slice(0, 4)
                      .map((it) => {
                        const img = it.media_url || it.image_url || "";
                        return (
                          <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)}
                            className="rounded-xl bg-[#0f0f10] border border-white/5 hover:border-white/20 p-2.5 flex items-center gap-2.5 text-left transition group">
                            <div className="h-11 w-11 rounded-lg overflow-hidden bg-white/5 shrink-0">
                              {img ? <img src={img} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" /> : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-sm truncate">{it.name}</p>
                              <p className="text-[11px] font-bold" style={{ color: ACCENT }}>{formatNftPrice(it.price, it.currency)}</p>
                            </div>
                            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Featured Collections grid */}
              {!loading && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-extrabold text-base">Featured Collections</h3>
                      <p className="text-[11px] text-white/50">This week's curated collections</p>
                    </div>
                    <button onClick={() => nav("/web3/nft/stores")} className="text-xs font-bold" style={{ color: ACCENT }}>View all →</button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {leaderboard.slice(0, 6).map(({ store: s }) => (
                      <button
                        key={s.user_id}
                        onClick={() => nav(`/web3/nft/store/${s.handle}`)}
                        className="rounded-2xl overflow-hidden bg-[#0f0f10] border border-white/5 hover:border-white/20 hover:-translate-y-0.5 transition-all text-left"
                      >
                        <div
                          className="h-20 w-full"
                          style={s.banner_url
                            ? { backgroundImage: `url(${s.banner_url})`, backgroundSize: "cover", backgroundPosition: "center" }
                            : { background: `linear-gradient(135deg, hsl(280 80% 30%), ${ACCENT})` }}
                        />
                        <div className="px-3 pb-3 -mt-6 relative">
                          {s.avatar_url
                            ? <img src={s.avatar_url} alt="" className="h-12 w-12 rounded-full ring-2 ring-[#0f0f10] object-cover" />
                            : <div className="h-12 w-12 rounded-full ring-2 ring-[#0f0f10] bg-gradient-to-br from-pink-500 to-blue-500" />}
                          <div className="mt-2 flex items-center gap-1">
                            <p className="font-bold text-sm truncate">{s.display_name || s.handle}</p>
                            {s.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />}
                          </div>
                          <p className="text-[11px] text-white/50 truncate">@{s.handle}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px]">
                            <div>
                              <p className="text-white/40 uppercase">Floor</p>
                              <p className="font-bold truncate" style={{ color: ACCENT }}>
                                {storeFloor[s.user_id] ? formatNftPrice(storeFloor[s.user_id].price, storeFloor[s.user_id].currency) : "—"}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/40 uppercase">Items</p>
                              <p className="font-bold">{storeItemCounts[s.user_id] || 0}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All NFTs grid */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-base">
                    {category === "all" ? "All NFTs" : `${getCategoryMeta(category).emoji} ${getCategoryMeta(category).label}`}
                  </h3>
                  <span className="text-xs text-white/50">{filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}</span>
                </div>
                {loading ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="rounded-2xl overflow-hidden bg-white/5">
                        <div className="aspect-square bg-gradient-to-br from-white/5 via-white/10 to-white/5 animate-pulse" />
                        <div className="p-3 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
                          <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-12 rounded-2xl border border-dashed border-white/10">
                    <p className="text-sm text-white/60">No NFTs match your search.</p>
                    <button onClick={() => { setSearch(""); setCategory("all"); }} className="mt-3 text-xs font-bold" style={{ color: ACCENT }}>Clear filters</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {filteredItems.map(renderCard)}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Collections leaderboard */}
            <aside className="hidden lg:block">
              <div className="sticky top-[76px] rounded-2xl border border-white/10 bg-[#0a0a0b] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5">
                      <button className="px-3 py-1 text-xs font-bold rounded-full bg-white/15">NFTs</button>
                      <button className="px-3 py-1 text-xs font-bold rounded-full text-white/60">Tokens</button>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">1d</span>
                </div>
                <div className="grid grid-cols-[1fr_auto] px-4 py-2 text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  <span>Collection</span>
                  <span>Floor</span>
                </div>
                <div className="max-h-[720px] overflow-y-auto">
                  {leaderboard.map((r) => {
                    const s = r.store;
                    const up = r.change >= 0;
                    return (
                      <button
                        key={s.user_id}
                        onClick={() => nav(`/web3/nft/store/${s.handle}`)}
                        className="w-full grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition text-left border-t border-white/5 first:border-t-0"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {s.avatar_url
                            ? <img src={s.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                            : <div className="h-8 w-8 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />}
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate flex items-center gap-1">
                              {s.display_name || s.handle}
                              {s.is_verified && <BadgeCheck className="h-3 w-3" style={{ color: ACCENT }} />}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: ACCENT }}>
                            {r.floor ? formatNftPrice(r.floor.price, r.floor.currency) : "—"}
                          </p>
                          <p className={`text-[10.5px] font-bold flex items-center justify-end gap-0.5 ${up ? "text-emerald-400" : "text-rose-400"}`}>
                            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {up ? "+" : ""}{r.change.toFixed(1)}%
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Mobile menu sheet */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden animate-in fade-in" onClick={() => setMenuOpen(false)} />
          <div className="fixed top-0 left-0 bottom-0 z-50 w-[86%] max-w-sm bg-[#08080a] border-r border-white/10 flex flex-col animate-in slide-in-from-left duration-200 md:hidden">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg,${ACCENT},hsl(217 91% 40%))` }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <span className="font-extrabold">OpenPay NFT</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              <Sidebar onNav={() => setMenuOpen(false)} />
            </div>
          </div>
        </>
      )}
    </NftPageShell>
  );
};

export default NftMarketplacePage;
