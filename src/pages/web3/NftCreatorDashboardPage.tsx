import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, TrendingUp, Coins, Package, Plus } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

const NftCreatorDashboardPage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [totals, setTotals] = useState({ earnings: 0, royalty: 0, sales: 0, items: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: e }, { data: items }] = await Promise.all([
        (supabase as any).from("nft_earnings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("nft_items").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }),
      ]);
      setEarnings(e || []);
      setMyItems(items || []);
      let totalE = 0, royalty = 0, sales = 0;
      (e || []).forEach((r: any) => {
        const amt = Number(r.amount || 0);
        totalE += amt;
        if (r.source === "royalty") royalty += amt;
        else sales += amt;
      });
      setTotals({ earnings: totalE, royalty, sales, items: (items || []).length });
    })();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold flex-1">Creator Dashboard</h1>
        <button onClick={() => nav("/web3/nft/create")} className="h-9 px-3 rounded-full flex items-center gap-1 font-semibold text-sm" style={{ backgroundColor: ACCENT }}>
          <Plus className="h-4 w-4" /> Mint
        </button>
      </header>

      <div className="p-4 space-y-4">
        <div className="rounded-2xl p-5 text-white" style={{ background: `linear-gradient(135deg, ${ACCENT}, hsl(217 91% 40%))` }}>
          <p className="text-xs uppercase opacity-90">Total Earnings</p>
          <p className="text-3xl font-extrabold mt-1">{format(totals.earnings)}</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Mini icon={<TrendingUp className="h-4 w-4" />} label="Sales" value={format(totals.sales)} />
            <Mini icon={<Coins className="h-4 w-4" />} label="Royalties" value={format(totals.royalty)} />
          </div>
        </div>

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Your NFTs ({totals.items})</p>
            <button onClick={() => nav("/web3/nft")} className="text-xs text-white/60">Marketplace →</button>
          </div>
          {myItems.length === 0 ? (
            <p className="text-sm text-white/50">No NFTs yet. Mint your first collectible.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {myItems.map((it) => (
                <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)} className="rounded-xl overflow-hidden bg-[#161616] border border-white/5">
                  <div className="aspect-square">
                    {it.image_url ? <img src={it.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-white/5" />}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold truncate">{it.name}</p>
                    <p className="text-[10px] text-white/50">{format(Number(it.price||0))}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <p className="font-bold mb-3">Earnings History</p>
          {earnings.length === 0 ? (
            <p className="text-sm text-white/50">No earnings yet.</p>
          ) : (
            <div className="space-y-2">
              {earnings.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-semibold capitalize">{r.source.replace("_"," ")}</p>
                    <p className="text-xs text-white/40">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-green-400">+{format(Number(r.amount))}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Mini = ({ icon, label, value }: any) => (
  <div className="rounded-xl bg-white/15 p-3">
    <div className="flex items-center gap-1 text-xs opacity-90">{icon}{label}</div>
    <p className="font-bold mt-1">{value}</p>
  </div>
);

export default NftCreatorDashboardPage;
