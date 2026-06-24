import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, Plus, LayoutDashboard, Users, Tag, HelpCircle, Sparkles, Gavel } from "lucide-react";

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
}

const NftMarketplacePage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [items, setItems] = useState<NftRow[]>([]);
  const [owners, setOwners] = useState<Record<string, number>>({});
  const [sales, setSales] = useState<Record<string, number>>({});
  const [auctions, setAuctions] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("nft_items")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const list = (data as NftRow[]) || [];
      setItems(list);

      if (list.length) {
        const ids = list.map((i) => i.id);
        const { data: own } = await (supabase as any)
          .from("nft_ownership")
          .select("item_id, owner_id, quantity")
          .in("item_id", ids);
        const ownerCount: Record<string, number> = {};
        (own || []).forEach((o: any) => {
          if (Number(o.quantity) > 0)
            ownerCount[o.item_id] = (ownerCount[o.item_id] || 0) + 1;
        });
        setOwners(ownerCount);

        const { data: tx } = await (supabase as any)
          .from("nft_transactions")
          .select("item_id, quantity, tx_kind")
          .in("item_id", ids)
          .in("tx_kind", ["sale", "resale"]);
        const soldMap: Record<string, number> = {};
        (tx || []).forEach((t: any) => {
          soldMap[t.item_id] = (soldMap[t.item_id] || 0) + Number(t.quantity || 0);
        });
        setSales(soldMap);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold flex-1">NFT Marketplace</h1>
        <button
          onClick={() => nav("/web3/nft/dashboard")}
          className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center"
          aria-label="Creator dashboard"
        >
          <LayoutDashboard className="h-5 w-5" />
        </button>
        <button
          onClick={() => nav("/web3/nft/create")}
          className="h-9 px-3 rounded-full flex items-center gap-1 font-semibold text-sm"
          style={{ backgroundColor: ACCENT }}
        >
          <Plus className="h-4 w-4" /> Mint
        </button>
      </header>

      <div className="px-4 pt-4">
        {loading ? (
          <p className="text-white/50 text-center mt-20">Loading marketplace…</p>
        ) : items.length === 0 ? (
          <div className="text-center mt-24">
            <p className="text-white/70 font-semibold">No NFTs yet</p>
            <p className="text-white/50 text-sm mt-1">Be the first to mint a collectible.</p>
            <button
              onClick={() => nav("/web3/nft/create")}
              className="mt-6 rounded-full px-6 py-3 font-bold"
              style={{ backgroundColor: ACCENT }}
            >
              Mint your NFT
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((it) => {
              const img = it.media_url || it.image_url || "";
              return (
                <button
                  key={it.id}
                  onClick={() => nav(`/web3/nft/${it.id}`)}
                  className="text-left rounded-2xl overflow-hidden bg-[#0f0f0f] border border-white/5 hover:border-white/20 transition"
                >
                  <div className="aspect-square bg-[#161616] flex items-center justify-center overflow-hidden">
                    {img ? (
                      <img src={img} alt={it.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-white/30 text-sm">No image</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-sm truncate">{it.name}</p>
                    <p className="text-xs text-white/40 truncate">#{it.code}</p>
                    <p className="mt-2 font-bold text-[15px]" style={{ color: ACCENT }}>
                      {format(Number(it.price || 0))}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-white/55">
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{owners[it.id] || 0}</span>
                      <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{sales[it.id] || 0} sold</span>
                      <span className="ml-auto">/{it.quantity_total}</span>
                    </div>
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

export default NftMarketplacePage;
