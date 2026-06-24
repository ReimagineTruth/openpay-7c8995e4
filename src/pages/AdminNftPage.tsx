import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, ShieldCheck, Trash2, RotateCcw, Search, Save, TrendingUp, Package, Users, Coins, Activity, Percent } from "lucide-react";

const ACCENT = "hsl(217 91% 60%)";

type Metrics = {
  total_items?: number; active_items?: number; removed_items?: number;
  total_collections?: number; total_owners?: number; total_sales?: number;
  sales_volume?: number; royalty_paid?: number; platform_fees?: number;
  active_listings?: number; active_auctions?: number;
  sales_24h?: number; sales_7d?: number; sales_30d?: number;
};

const AdminNftPage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [metrics, setMetrics] = useState<Metrics>({});
  const [items, setItems] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [fee, setFee] = useState({ enabled: false, rate: 0, collector_user_id: "" });
  const [mintFee, setMintFee] = useState({ enabled: false, rate: 0, collector_user_id: "" });
  const [loading, setLoading] = useState(true);
  const [savingFee, setSavingFee] = useState(false);
  const [savingMintFee, setSavingMintFee] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [m, items, act, feeCfg, mintCfg] = await Promise.all([
        (supabase as any).rpc("nft_admin_metrics"),
        (supabase as any).rpc("nft_admin_list_items", { p_limit: 200, p_search: search || null }),
        (supabase as any).rpc("nft_admin_recent_activity", { p_limit: 100 }),
        (supabase as any).rpc("nft_get_platform_fee"),
        (supabase as any).rpc("nft_get_mint_fee"),
      ]);
      if (m.error) throw m.error;
      setMetrics(m.data || {});
      setItems(items.data || []);
      setActivity(act.data || []);
      const f = feeCfg.data || {};
      setFee({
        enabled: !!f.enabled,
        rate: Number(f.rate || 0),
        collector_user_id: f.collector_user_id || "",
      });
      const mf = mintCfg.data || {};
      setMintFee({
        enabled: !!mf.enabled,
        rate: Number(mf.rate || 0),
        collector_user_id: mf.collector_user_id || "",
      });
    } catch (e: any) {
      toast({ title: "Access denied", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const saveFee = async () => {
    setSavingFee(true);
    try {
      const { error } = await (supabase as any).rpc("nft_admin_set_platform_fee", {
        p_enabled: fee.enabled,
        p_rate: Number(fee.rate) || 0,
        p_collector: fee.collector_user_id || null,
      });
      if (error) throw error;
      toast({ title: "Platform fee saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingFee(false);
    }
  };

  const remove = async (id: string, name: string) => {
    const reason = prompt(`Remove "${name}"? Enter reason (policy violation):`);
    if (!reason) return;
    const { error } = await (supabase as any).rpc("nft_admin_remove_item", { p_item_id: id, p_reason: reason });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "NFT removed" });
    load();
  };

  const restore = async (id: string) => {
    const { error } = await (supabase as any).rpc("nft_admin_restore_item", { p_item_id: id });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Restored" });
    load();
  };

  return (
    <div className="min-h-screen bg-black text-white pb-32">
      <header className="sticky top-0 z-10 bg-black/85 backdrop-blur px-4 py-3 flex items-center gap-3 border-b border-white/5">
        <button onClick={() => nav(-1)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <ShieldCheck className="h-5 w-5" style={{ color: ACCENT }} />
        <h1 className="text-xl font-extrabold flex-1">NFT Admin</h1>
        <button onClick={load} className="h-9 px-3 rounded-full bg-white/10 text-xs font-semibold">Refresh</button>
      </header>

      <div className="p-4 space-y-5 max-w-3xl mx-auto">
        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Package />} label="Total NFTs" value={metrics.total_items ?? 0} sub={`${metrics.active_items ?? 0} active`} />
          <Stat icon={<TrendingUp />} label="Sales Volume" value={format(Number(metrics.sales_volume || 0))} sub={`${metrics.total_sales ?? 0} sales`} />
          <Stat icon={<Users />} label="Owners" value={metrics.total_owners ?? 0} sub={`${metrics.total_collections ?? 0} collections`} />
          <Stat icon={<Coins />} label="Platform Fees" value={format(Number(metrics.platform_fees || 0))} sub={`royalty ${format(Number(metrics.royalty_paid || 0))}`} />
          <Stat icon={<Activity />} label="24h" value={format(Number(metrics.sales_24h || 0))} sub={`7d ${format(Number(metrics.sales_7d || 0))}`} />
          <Stat icon={<Activity />} label="30d" value={format(Number(metrics.sales_30d || 0))} sub={`${metrics.active_listings ?? 0} listings · ${metrics.active_auctions ?? 0} auctions`} />
        </div>

        {/* Platform Fee */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Percent className="h-4 w-4" style={{ color: ACCENT }} />
            <h2 className="font-bold">Platform Fee</h2>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${fee.enabled ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"}`}>
              {fee.enabled ? "ON" : "OFF"}
            </span>
          </div>
          <p className="text-xs text-white/50 mb-3">Deducted from every NFT sale and credited to collector wallet.</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <label className="block">
              <span className="text-xs text-white/60 font-semibold">Rate (%)</span>
              <input type="number" step="0.1" min={0} max={50} value={fee.rate}
                onChange={(e) => setFee((f) => ({ ...f, rate: Number(e.target.value) }))}
                className="mt-1 w-full rounded-xl bg-[#161616] border border-white/10 p-3 text-sm outline-none" />
            </label>
            <label className="flex items-end gap-2">
              <input id="fee-enabled" type="checkbox" checked={fee.enabled}
                onChange={(e) => setFee((f) => ({ ...f, enabled: e.target.checked }))}
                className="h-5 w-5" />
              <span className="text-sm pb-2">Enable fee</span>
            </label>
          </div>
          <label className="block mb-3">
            <span className="text-xs text-white/60 font-semibold">Collector User ID (UUID)</span>
            <input value={fee.collector_user_id}
              onChange={(e) => setFee((f) => ({ ...f, collector_user_id: e.target.value }))}
              placeholder="UUID of OpenPay treasury wallet user"
              className="mt-1 w-full rounded-xl bg-[#161616] border border-white/10 p-3 text-sm outline-none font-mono" />
          </label>
          <button onClick={saveFee} disabled={savingFee}
            className="w-full rounded-full py-2.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: ACCENT }}>
            <Save className="h-4 w-4" /> {savingFee ? "Saving…" : "Save Fee Settings"}
          </button>
        </div>

        {/* Items */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="font-bold flex-1">All NFTs ({items.length})</h2>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="flex-1 flex items-center gap-2 bg-[#161616] border border-white/10 rounded-xl px-3">
              <Search className="h-4 w-4 text-white/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or code"
                className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
            </div>
            <button onClick={load} className="px-3 rounded-xl bg-white/10 text-sm font-semibold">Go</button>
          </div>
          {loading ? <p className="text-white/50 text-sm">Loading…</p> : items.length === 0 ? (
            <p className="text-white/50 text-sm">No NFTs.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-3 p-2 rounded-xl bg-[#161616] border border-white/5">
                  <div className="h-12 w-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {it.image_url && <img src={it.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{it.name}</p>
                      {!it.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">REMOVED</span>}
                    </div>
                    <p className="text-[11px] text-white/40 truncate">#{it.code} · {it.creator_email || it.creator_id?.slice(0, 8)}</p>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      {format(Number(it.sales_volume || 0))} · {Number(it.sold_count || 0)}/{it.quantity_total} sold · {it.owners_count} owners
                    </p>
                  </div>
                  <button onClick={() => nav(`/web3/nft/${it.id}`)} className="text-xs text-white/60 px-2">View</button>
                  {it.is_active ? (
                    <button onClick={() => remove(it.id, it.name)} className="h-8 w-8 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <button onClick={() => restore(it.id)} className="h-8 w-8 rounded-lg bg-green-500/15 text-green-400 flex items-center justify-center" aria-label="Restore">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-4">
          <h2 className="font-bold mb-3">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="text-white/50 text-sm">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.item_name || t.item_id?.slice(0, 8)}</p>
                    <p className="text-[11px] text-white/40">
                      {t.tx_kind} · {t.payment_method} · {new Date(t.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm">{format(Number(t.total || 0))}</p>
                    <p className="text-[10px] text-white/40">fee {format(Number(t.platform_fee || 0))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value, sub }: any) => (
  <div className="rounded-2xl bg-[#0f0f0f] border border-white/10 p-3">
    <div className="flex items-center gap-2 text-xs text-white/60">
      <span style={{ color: ACCENT }}>{icon}</span>{label}
    </div>
    <p className="text-xl font-extrabold mt-1">{value}</p>
    {sub && <p className="text-[10px] text-white/40 mt-0.5">{sub}</p>}
  </div>
);

export default AdminNftPage;
