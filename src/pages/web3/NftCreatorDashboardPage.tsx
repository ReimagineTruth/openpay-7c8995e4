import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { ArrowLeft, TrendingUp, Coins, Package, Plus, BarChart3, ArrowUpRight, Users } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

const NftCreatorDashboardPage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [earnings, setEarnings] = useState<any[]>([]);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [totals, setTotals] = useState({ earnings: 0, royalty: 0, sales: 0, items: 0, buyers: 0 });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: e }, { data: items }, { data: stats }] = await Promise.all([
        (supabase as any).from("nft_earnings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("nft_items").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).rpc("nft_creator_stats", { p_days: 365 }),
      ]);
      setEarnings(e || []);
      setMyItems(items || []);
      const t = stats?.totals || {};
      setTotals({
        earnings: Number(t.total_earnings || 0),
        royalty: Number(t.royalty_earnings || 0),
        sales: Number(t.sales_count || 0),
        items: (items || []).length,
        buyers: Number(t.unique_buyers || 0),
      });
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white pb-24">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 dark:bg-black/85 px-4 py-3 flex items-center gap-3 border-b border-slate-200 dark:border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-extrabold flex-1">Creator Dashboard</h1>
        <button
          onClick={() => nav("/web3/nft/stats")}
          className="h-9 px-3 rounded-full flex items-center gap-1 font-semibold text-sm bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20"
        >
          <BarChart3 className="h-4 w-4" /> Stats
        </button>
        <button onClick={() => nav("/web3/nft/create")} className="h-9 px-3 rounded-full flex items-center gap-1 font-semibold text-sm text-white" style={{ backgroundColor: ACCENT }}>
          <Plus className="h-4 w-4" /> Mint
        </button>
      </header>

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Hero */}
        <div
          className="nft-on-media rounded-3xl p-6 text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, hsl(217 91% 40%))` }}
        >
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="text-xs uppercase tracking-wider opacity-90">Total Earnings</p>
          <p className="text-4xl font-black mt-2 text-white">{format(totals.earnings)}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative">
            <Mini icon={<TrendingUp className="h-4 w-4" />} label="Sales" value={String(totals.sales)} />
            <Mini icon={<Coins className="h-4 w-4" />} label="Royalties" value={format(totals.royalty)} />
            <Mini icon={<Users className="h-4 w-4" />} label="Buyers" value={String(totals.buyers)} />
            <Mini icon={<Package className="h-4 w-4" />} label="NFTs" value={String(totals.items)} />
          </div>
        </div>

        {/* CTA to stats */}
        <button
          onClick={() => nav("/web3/nft/stats")}
          className="w-full rounded-2xl bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 p-4 flex items-center gap-3 hover:border-blue-400 dark:hover:border-blue-500 transition text-left"
        >
          <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-bold">Sales Statistics</p>
            <p className="text-xs text-slate-500 dark:text-white/50">Trends, top buyers, royalties & performance</p>
          </div>
          <ArrowUpRight className="h-5 w-5 text-slate-400" />
        </button>

        {/* NFTs */}
        <div className="rounded-2xl bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold flex items-center gap-2"><Package className="h-4 w-4" /> Your NFTs ({totals.items})</p>
            <button onClick={() => nav("/web3/nft")} className="text-xs text-slate-500 dark:text-white/60 hover:underline">Marketplace →</button>
          </div>
          {myItems.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-white/50">No NFTs yet. Mint your first collectible.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {myItems.map((it) => (
                <button key={it.id} onClick={() => nav(`/web3/nft/${it.id}`)} className="rounded-xl overflow-hidden bg-slate-50 dark:bg-[#161616] border border-slate-200 dark:border-white/5 hover:border-blue-400">
                  <div className="aspect-square">
                    {it.image_url ? <img src={it.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-slate-200 dark:bg-white/5" />}
                  </div>
                  <div className="p-2 text-left">
                    <p className="text-xs font-semibold truncate">{it.name}</p>
                    <p className="text-[10px] text-slate-500 dark:text-white/50">{format(Number(it.price||0))}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent earnings */}
        <div className="rounded-2xl bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold">Recent Earnings</p>
            <button onClick={() => nav("/web3/nft/stats")} className="text-xs text-blue-600 hover:underline">View all →</button>
          </div>
          {earnings.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-white/50">No earnings yet.</p>
          ) : (
            <div className="space-y-2">
              {earnings.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-slate-200 dark:border-white/5 pb-2 last:border-0">
                  <div>
                    <p className="text-sm font-semibold capitalize">{r.source.replace("_"," ")}</p>
                    <p className="text-xs text-slate-500 dark:text-white/40">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <p className="font-bold text-green-600 dark:text-green-400">+{format(Number(r.amount))}</p>
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
  <div className="nft-on-media rounded-xl bg-white/15 backdrop-blur p-3 border border-white/10">
    <div className="flex items-center gap-1 text-xs opacity-90 text-white">{icon}{label}</div>
    <p className="font-bold mt-1 text-white truncate">{value}</p>
  </div>
);

export default NftCreatorDashboardPage;
