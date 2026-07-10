import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  ArrowLeft, TrendingUp, Coins, Users, ShoppingBag, Wallet, Award,
  ArrowUpRight, Activity, DollarSign,
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format as fmtDate } from "date-fns";

const ACCENT = "hsl(217 91% 60%)";
const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

type Stats = {
  totals: {
    total_earnings: number;
    primary_sales_earnings: number;
    resale_earnings: number;
    royalty_earnings: number;
    sales_count: number;
    total_volume: number;
    unique_buyers: number;
    platform_fees_paid: number;
  };
  series: { date: string; earnings: number; sales: number; volume: number }[];
  by_source: { source: string; amount: number }[];
  top_items: any[];
  top_buyers: any[];
  recent_sales: any[];
};

const RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
];

const NftCreatorStatsPage = () => {
  const nav = useNavigate();
  const { format } = useCurrency();
  const [range, setRange] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("nft_creator_stats", { p_days: range });
      if (!error && data) setStats(data as Stats);
      setLoading(false);
    })();
  }, [range]);

  const t = stats?.totals;
  const netRevenue = useMemo(
    () => (t ? (t.total_volume || 0) - (t.platform_fees_paid || 0) : 0),
    [t]
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 dark:bg-black/80 border-b border-slate-200 dark:border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => nav(-1)}
          className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-white/20"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold truncate">Sales Statistics</h1>
          <p className="text-xs text-slate-500 dark:text-white/50">Track earnings, buyers & performance</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-white/10 rounded-full p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                range === r.days
                  ? "bg-white dark:bg-white text-slate-900 shadow"
                  : "text-slate-600 dark:text-white/70"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Hero KPI */}
        <div
          className="rounded-3xl p-6 text-white relative overflow-hidden [&_*]:text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT}, hsl(217 91% 40%))` }}
        >
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <p className="text-xs uppercase tracking-wider opacity-90 text-white">Net Revenue</p>
          <p className="text-4xl font-black mt-2 text-white">{loading ? "…" : format(netRevenue)}</p>
          <div className="flex items-center gap-1 text-sm mt-1 opacity-90 text-white">
            <ArrowUpRight className="h-4 w-4 text-white" />
            <span className="text-white">Last {range} days</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 relative">
            <MiniKpi icon={<Coins className="h-4 w-4" />} label="Earnings" value={format(t?.total_earnings || 0)} />
            <MiniKpi icon={<ShoppingBag className="h-4 w-4" />} label="Sales" value={String(t?.sales_count || 0)} />
            <MiniKpi icon={<Users className="h-4 w-4" />} label="Buyers" value={String(t?.unique_buyers || 0)} />
            <MiniKpi icon={<Award className="h-4 w-4" />} label="Royalties" value={format(t?.royalty_earnings || 0)} />
          </div>
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={<DollarSign />} label="Gross Volume" value={format(t?.total_volume || 0)} tint="green" />
          <StatCard icon={<Wallet />} label="Primary Sales" value={format(t?.primary_sales_earnings || 0)} tint="blue" />
          <StatCard icon={<Activity />} label="Resale Earnings" value={format(t?.resale_earnings || 0)} tint="purple" />
          <StatCard icon={<TrendingUp />} label="Platform Fees" value={format(t?.platform_fees_paid || 0)} tint="orange" />
        </div>

        {/* Earnings trend */}
        <Panel title="Earnings Trend" subtitle="Daily earnings across all sources">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.series || []}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tickFormatter={(d) => fmtDate(new Date(d), "MMM d")} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => format(Number(v))} labelFormatter={(l) => fmtDate(new Date(l), "PP")} />
                <Area type="monotone" dataKey="earnings" stroke={ACCENT} strokeWidth={2} fill="url(#earnGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Sales Volume" subtitle="Daily units sold">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.series || []}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tickFormatter={(d) => fmtDate(new Date(d), "M/d")} fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip labelFormatter={(l) => fmtDate(new Date(l), "PP")} />
                  <Bar dataKey="sales" fill={ACCENT} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Revenue Sources" subtitle="Where your earnings come from">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={(stats?.by_source || []).map((s) => ({ name: s.source.replace("_", " "), value: Number(s.amount) }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(stats?.by_source || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => format(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Top Buyers */}
        <Panel title="Top Buyers" subtitle="Your most valuable collectors">
          {(!stats?.top_buyers || stats.top_buyers.length === 0) ? (
            <EmptyState text="No buyers yet in this range." />
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/5">
              {stats.top_buyers.map((b: any, i: number) => (
                <div key={b.buyer_id} className="flex items-center gap-3 py-3">
                  <div className="w-8 text-center text-sm font-bold text-slate-500 dark:text-white/50">#{i + 1}</div>
                  {b.avatar_url ? (
                    <img src={b.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center font-bold">
                      {(b.full_name || b.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{b.full_name || "Anonymous"}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50 truncate">
                      @{b.username || "user"} · {b.purchases} purchase{b.purchases > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{format(Number(b.spent))}</p>
                    <p className="text-[10px] text-slate-500 dark:text-white/40">
                      {fmtDate(new Date(b.last_purchase_at), "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Top Items */}
        <Panel title="Top-Selling NFTs" subtitle="Best performers by volume">
          {(!stats?.top_items || stats.top_items.length === 0) ? (
            <EmptyState text="No sales data yet." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {stats.top_items.map((it: any) => (
                <div key={it.id} className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5">
                  {it.image_url ? (
                    <img src={it.image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-slate-200 dark:bg-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{it.name}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">
                      {it.sales_count} sold · {format(Number(it.volume || 0))} volume
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-white/40">Net</p>
                    <p className="font-bold text-green-600 dark:text-green-400">
                      {format(Number(it.net_revenue || 0))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Sales Feed */}
        <Panel title="Recent Sales" subtitle="Latest completed transactions with buyer info">
          {(!stats?.recent_sales || stats.recent_sales.length === 0) ? (
            <EmptyState text="No recent sales." />
          ) : (
            <div className="space-y-2">
              {stats.recent_sales.map((s: any) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5"
                >
                  {s.item_image ? (
                    <img src={s.item_image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-slate-200 dark:bg-white/10" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.item_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.buyer_avatar ? (
                        <img src={s.buyer_avatar} alt="" className="h-4 w-4 rounded-full" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-slate-300 dark:bg-white/20" />
                      )}
                      <span className="text-xs text-slate-600 dark:text-white/60 truncate">
                        {s.buyer_name || "Anon"} · @{s.buyer_username || "user"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{format(Number(s.total))}</p>
                    <p className="text-[10px] text-slate-500 dark:text-white/40 capitalize">
                      {s.tx_kind.replace("_", " ")} · {fmtDate(new Date(s.created_at), "MMM d")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

const MiniKpi = ({ icon, label, value }: any) => (
  <div className="rounded-2xl bg-white/15 backdrop-blur p-3 border border-white/10">
    <div className="flex items-center gap-1.5 text-xs opacity-90">{icon}{label}</div>
    <p className="font-black mt-1 text-lg truncate">{value}</p>
  </div>
);

const StatCard = ({ icon, label, value, tint }: any) => {
  const tints: any = {
    green: "text-green-600 bg-green-50 dark:bg-green-500/10",
    blue: "text-blue-600 bg-blue-50 dark:bg-blue-500/10",
    purple: "text-purple-600 bg-purple-50 dark:bg-purple-500/10",
    orange: "text-orange-600 bg-orange-50 dark:bg-orange-500/10",
  };
  return (
    <div className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4">
      <div className={`inline-flex h-8 w-8 rounded-lg items-center justify-center ${tints[tint]}`}>
        <div className="h-4 w-4">{icon}</div>
      </div>
      <p className="text-xs text-slate-500 dark:text-white/50 mt-2">{label}</p>
      <p className="font-bold text-lg mt-0.5 truncate">{value}</p>
    </div>
  );
};

const Panel = ({ title, subtitle, children }: any) => (
  <div className="rounded-2xl bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-white/10 p-4">
    <div className="mb-3">
      <p className="font-bold">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 dark:text-white/50">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-8 text-sm text-slate-500 dark:text-white/50">{text}</div>
);

export default NftCreatorStatsPage;
