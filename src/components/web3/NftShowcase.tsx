import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { NftStatusBadge } from "@/lib/nftStatus";
import { Paintbrush, BadgeCheck, ChevronRight, Gavel } from "lucide-react";
import { cn } from "@/lib/utils";

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
        .eq("hidden", false)
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
        (sp || []).forEach((s: any) => {
          sMap[s.user_id] = s;
        });
        setStores(sMap);
        const aMap: Record<string, boolean> = {};
        (au || []).forEach((a: any) => {
          aMap[a.item_id] = true;
        });
        setAuctions(aMap);
        const soldMap: Record<string, number> = {};
        (tx || []).forEach((t: any) => {
          soldMap[t.item_id] = (soldMap[t.item_id] || 0) + Number(t.quantity || 0);
        });
        setSales(soldMap);
      }
      setLoading(false);
    })();
  }, []);

  if (!loading && items.length === 0) return null;

  const isLight = variant === "light";
  const wrapBg = isLight
    ? "dash-panel dash-panel-static border border-white/80 bg-white/95"
    : "bg-[#0f0f0f] border border-white/10 rounded-3xl";
  const cardBg = isLight
    ? "bg-secondary/45 dark:bg-white/5 ring-1 ring-border/50"
    : "bg-[#1a1a1a] border border-white/10";
  const titleColor = isLight ? "text-foreground" : "text-white";
  const subColor = isLight ? "text-muted-foreground" : "text-white/55";

  return (
    <section className={cn("p-4", wrapBg, className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: ACCENT }}
          >
            <Paintbrush className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className={cn("text-sm font-extrabold tracking-tight", titleColor)}>New NFT drops</p>
            <p className={cn("text-[11px]", subColor)}>Fresh art from creator stores</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => nav("/web3/nft")}
          className="ios-active inline-flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-bold transition hover:bg-paypal-blue/10"
          style={{ color: ACCENT }}
        >
          View all <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn("w-40 shrink-0 overflow-hidden rounded-2xl", cardBg)}>
              <div className="aspect-square animate-pulse bg-black/5 dark:bg-white/5" />
              <div className="space-y-1.5 p-2.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-black/10 dark:bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1 snap-x">
          {items.map((it, index) => {
            const img = it.media_url || it.image_url || "";
            const store = stores[it.creator_id];
            const live = auctions[it.id];
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => nav(`/web3/nft/${it.id}`)}
                style={{ animationDelay: `${index * 40}ms` }}
                className={cn(
                  "nft-drop-card w-40 shrink-0 snap-start overflow-hidden rounded-2xl text-left transition",
                  cardBg,
                  "hover:-translate-y-0.5 active:scale-[0.98]",
                )}
              >
                <div className="relative aspect-square overflow-hidden bg-black/40">
                  {img ? (
                    <img src={img} alt={it.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-white/35">
                      <Paintbrush className="h-6 w-6" />
                      <span className="text-[10px] font-semibold">No image</span>
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/55 to-transparent" />
                  {index < 2 && !live && (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-paypal-blue">
                      New
                    </span>
                  )}
                  {live && (
                    <span
                      className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-bold"
                      style={{ color: ACCENT }}
                    >
                      <Gavel className="h-2.5 w-2.5" /> LIVE
                    </span>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {format(Number(it.price || 0))}
                  </span>
                </div>
                <div className="p-2.5">
                  {store && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        nav(`/web3/nft/store/${store.handle}`);
                      }}
                      className="mb-1 flex cursor-pointer items-center gap-1"
                      role="link"
                    >
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-gradient-to-br from-paypal-blue to-[#38bdf8]" />
                      )}
                      <span className={cn("truncate text-[10px] font-medium", subColor)}>@{store.handle}</span>
                      {store.is_verified && <BadgeCheck className="h-3 w-3 shrink-0" style={{ color: ACCENT }} />}
                    </div>
                  )}
                  <p className={cn("truncate text-xs font-bold", titleColor)}>{it.name}</p>
                  <NftStatusBadge
                    sold={sales[it.id] || 0}
                    total={it.quantity_total}
                    hasAuction={live}
                    className="mt-1"
                  />
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
