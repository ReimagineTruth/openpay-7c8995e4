import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { NftStatusBadge } from "@/lib/nftStatus";
import { Sparkles, BadgeCheck, ChevronRight, Gavel } from "lucide-react";


const ACCENT = "hsl(217 91% 60%)";

interface NftCard {
  id: string;
  name: string;
  code: string;
  image_url: string | null;
  media_url: string | null;
  price: number;
  creator_id: string;
  quantity_total: number;
}
interface StoreLite {
  user_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
}

interface Props {
  className?: string;
  variant?: "dark" | "light";
}

const NftShowcase = ({ className = "", variant = "dark" }: Props) => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [items, setItems] = useState<NftCard[]>([]);
  const [stores, setStores] = useState<Record<string, StoreLite>>({});
  const [auctions, setAuctions] = useState<Record<string, boolean>>({});
  const [sales, setSales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("nft_items")
        .select("id, name, code, image_url, media_url, price, creator_id, quantity_total, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      const list = (data as NftCard[]) || [];
      setItems(list);
      if (list.length) {
        const creatorIds = Array.from(new Set(list.map((i) => i.creator_id)));
        const itemIds = list.map((i) => i.id);
        const [{ data: sp }, { data: au }, { data: tx }] = await Promise.all([
          (supabase as any)
            .from("nft_store_profiles")
            .select("user_id, handle, display_name, avatar_url, is_verified")
            .in("user_id", creatorIds),
          (supabase as any)
            .from("nft_auctions")
            .select("item_id")
            .in("item_id", itemIds)
            .eq("status", "active"),
          (supabase as any)
            .from("nft_transactions")
            .select("item_id, quantity, tx_kind")
            .in("item_id", itemIds)
            .in("tx_kind", ["sale", "resale"]),
        ]);
        const sMap: Record<string, StoreLite> = {};
        (sp || []).forEach((s: any) => { sMap[s.user_id] = s; });
        setStores(sMap);
        const aMap: Record<string, boolean> = {};
        (au || []).forEach((a: any) => { aMap[a.item_id] = true; });
        setAuctions(aMap);
        const soldMap: Record<string, number> = {};
        (tx || []).forEach((t: any) => { soldMap[t.item_id] = (soldMap[t.item_id] || 0) + Number(t.quantity || 0); });
        setSales(soldMap);
      }
      setLoading(false);
    })();
  }, []);


  if (!loading && items.length === 0) return null;

  const isLight = variant === "light";
  const wrapBg = isLight ? "bg-white/60 dark:bg-white/5 border border-border" : "bg-[#0f0f0f] border border-white/10";
  const cardBg = isLight ? "bg-card border border-border" : "bg-[#1a1a1a] border border-white/10";
  const titleColor = isLight ? "text-foreground" : "text-white";
  const subColor = isLight ? "text-muted-foreground" : "text-white/55";

  return (
    <section className={`rounded-3xl p-4 ${wrapBg} ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{ background: ACCENT }}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className={`font-extrabold text-sm ${titleColor}`}>New NFT drops</p>
            <p className={`text-[11px] ${subColor}`}>Fresh from creator stores</p>
          </div>
        </div>
        <button
          onClick={() => nav("/web3/nft")}
          className="text-xs font-bold flex items-center gap-0.5 hover:translate-x-0.5 transition-transform"
          style={{ color: ACCENT }}
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`w-36 shrink-0 rounded-2xl ${cardBg} overflow-hidden`}>
              <div className="aspect-square bg-white/5 animate-pulse" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 w-3/4 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 snap-x">
          {items.map((it) => {
            const img = it.media_url || it.image_url || "";
            const store = stores[it.creator_id];
            const live = auctions[it.id];
            return (
              <button
                key={it.id}
                onClick={() => nav(`/web3/nft/${it.id}`)}
                className={`w-36 shrink-0 snap-start rounded-2xl ${cardBg} overflow-hidden text-left hover:scale-[1.03] transition-transform`}
              >
                <div className="aspect-square relative bg-black/40 overflow-hidden">
                  {img ? (
                    <img src={img} alt={it.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">No image</div>
                  )}
                  {live && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/70 flex items-center gap-0.5" style={{ color: ACCENT }}>
                      <Gavel className="h-2.5 w-2.5" /> LIVE
                    </span>
                  )}
                </div>
                <div className="p-2">
                  {store && (
                    <div
                      onClick={(e) => { e.stopPropagation(); nav(`/web3/nft/store/${store.handle}`); }}
                      className="flex items-center gap-1 mb-0.5 cursor-pointer"
                      role="link"
                    >
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                      ) : (
                        <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />
                      )}
                      <span className={`text-[10px] truncate ${subColor}`}>@{store.handle}</span>
                      {store.is_verified && <BadgeCheck className="h-2.5 w-2.5 shrink-0" style={{ color: ACCENT }} />}
                    </div>
                  )}
                  <p className={`font-bold text-xs truncate ${titleColor}`}>{it.name}</p>
                  <p className="font-bold text-[12px] mt-0.5" style={{ color: ACCENT }}>{format(Number(it.price || 0))}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default NftShowcase;
