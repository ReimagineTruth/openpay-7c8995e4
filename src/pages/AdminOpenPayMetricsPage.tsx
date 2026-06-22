import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
  ArrowLeftRight,
  Globe2,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PROFILE_USERNAMES } from "@/lib/kyc";

type Period = "daily" | "monthly" | "yearly";

type Country = { country: string; users: number };

type OpenPayMetrics = {
  total_users: number;
  users_today: number;
  users_prev_day: number;
  users_month: number;
  users_prev_month: number;
  users_year: number;
  users_prev_year: number;
  kyc_approved: number;
  kyc_pending: number;
  total_balance: number;
  wallets_count: number;
  tx_total_count: number;
  tx_total_volume: number;
  tx_today_count: number;
  tx_today_volume: number;
  tx_month_count: number;
  tx_month_volume: number;
  tx_year_count: number;
  tx_year_volume: number;
  tx_prev_day_volume: number;
  tx_prev_month_volume: number;
  tx_prev_year_volume: number;
  countries_count: number;
  countries: Country[];
};

const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtMoney = (n: number) =>
  "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (curr: number, prev: number) => (prev <= 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

const AdminOpenPayMetricsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<OpenPayMetrics | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [exporting, setExporting] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in required");
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data: prof } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      const uname = String(prof?.username || "").trim().toLowerCase().replace(/^@+/, "");
      if (!ADMIN_PROFILE_USERNAMES.has(uname)) {
        toast.error("Admin access only");
        navigate("/dashboard", { replace: true });
        return;
      }

      const { data, error } = await (supabase as any).rpc("admin_openpay_metrics");
      if (error) throw error;
      const raw = data as any;
      setMetrics({
        ...raw,
        total_balance: Number(raw.total_balance || 0),
        tx_total_volume: Number(raw.tx_total_volume || 0),
        tx_today_volume: Number(raw.tx_today_volume || 0),
        tx_month_volume: Number(raw.tx_month_volume || 0),
        tx_year_volume: Number(raw.tx_year_volume || 0),
        tx_prev_day_volume: Number(raw.tx_prev_day_volume || 0),
        tx_prev_month_volume: Number(raw.tx_prev_month_volume || 0),
        tx_prev_year_volume: Number(raw.tx_prev_year_volume || 0),
        countries: Array.isArray(raw.countries) ? raw.countries : [],
      });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const periodData = useMemo(() => {
    if (!metrics) return null;
    const now = new Date();
    if (period === "daily") {
      return {
        title: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        subtitle: "Daily Network Update",
        primaryLabel: "New Users Today",
        primaryValue: metrics.users_today,
        primaryChange: pct(metrics.users_today, metrics.users_prev_day),
        volumeLabel: "Volume Today",
        volumeValue: metrics.tx_today_volume,
        volumeChange: pct(metrics.tx_today_volume, metrics.tx_prev_day_volume),
        txCount: metrics.tx_today_count,
      };
    }
    if (period === "yearly") {
      return {
        title: `${now.getFullYear()} Network Update`,
        subtitle: "Yearly Network Update",
        primaryLabel: `New Users ${now.getFullYear()}`,
        primaryValue: metrics.users_year,
        primaryChange: pct(metrics.users_year, metrics.users_prev_year),
        volumeLabel: `Volume ${now.getFullYear()}`,
        volumeValue: metrics.tx_year_volume,
        volumeChange: pct(metrics.tx_year_volume, metrics.tx_prev_year_volume),
        txCount: metrics.tx_year_count,
      };
    }
    return {
      title: `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()} Network Update`,
      subtitle: "Monthly Network Update",
      primaryLabel: `New Users ${now.toLocaleString("en-US", { month: "long" })}`,
      primaryValue: metrics.users_month,
      primaryChange: pct(metrics.users_month, metrics.users_prev_month),
      volumeLabel: `Volume ${now.toLocaleString("en-US", { month: "long" })}`,
      volumeValue: metrics.tx_month_volume,
      volumeChange: pct(metrics.tx_month_volume, metrics.tx_prev_month_volume),
      txCount: metrics.tx_month_count,
    };
  }, [metrics, period]);

  const handleDownload = async () => {
    if (!templateRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(templateRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#050516" });
      const link = document.createElement("a");
      link.download = `openpay-network-${period}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Template downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Could not export image");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-secondary hover:bg-secondary/80">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">OpenPay Network Metrics</h1>
            <p className="text-xs text-muted-foreground">Track users, balances, transactions & countries</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading || !metrics ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-paypal-blue" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat icon={<Users className="h-5 w-5" />} label="Total Users" value={fmt(metrics.total_users)} tone="blue" />
              <Stat icon={<Wallet className="h-5 w-5" />} label="Distributed Balance" value={fmtMoney(metrics.total_balance)} tone="emerald" />
              <Stat icon={<ArrowLeftRight className="h-5 w-5" />} label="Total Transactions" value={fmt(metrics.tx_total_count)} tone="violet" />
              <Stat icon={<Globe2 className="h-5 w-5" />} label="Countries" value={fmt(metrics.countries_count)} tone="amber" />
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <PeriodCard
                label="Today"
                users={metrics.users_today}
                usersChange={pct(metrics.users_today, metrics.users_prev_day)}
                volume={metrics.tx_today_volume}
                volumeChange={pct(metrics.tx_today_volume, metrics.tx_prev_day_volume)}
                tx={metrics.tx_today_count}
              />
              <PeriodCard
                label="This Month"
                users={metrics.users_month}
                usersChange={pct(metrics.users_month, metrics.users_prev_month)}
                volume={metrics.tx_month_volume}
                volumeChange={pct(metrics.tx_month_volume, metrics.tx_prev_month_volume)}
                tx={metrics.tx_month_count}
              />
              <PeriodCard
                label="This Year"
                users={metrics.users_year}
                usersChange={pct(metrics.users_year, metrics.users_prev_year)}
                volume={metrics.tx_year_volume}
                volumeChange={pct(metrics.tx_year_volume, metrics.tx_prev_year_volume)}
                tx={metrics.tx_year_count}
              />
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Globe2 className="h-5 w-5 text-paypal-blue" /> Users by Country
              </h2>
              {metrics.countries.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No nationality data yet (from KYC submissions).</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                  {metrics.countries.map((c) => (
                    <div key={c.country} className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-3 py-2">
                      <span className="truncate text-sm font-semibold text-foreground">{c.country}</span>
                      <span className="text-xs font-bold text-paypal-blue">{fmt(c.users)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <ImageIcon className="h-5 w-5 text-paypal-blue" /> Social Template
                  </h2>
                  <p className="text-xs text-muted-foreground">Generate a shareable network update for socials</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-full bg-secondary p-1">
                    {(["daily", "monthly", "yearly"] as Period[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                          period === p ? "bg-paypal-blue text-white shadow" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <Button onClick={handleDownload} disabled={exporting} className="bg-paypal-blue hover:bg-[#004dc5]">
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download PNG
                  </Button>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="mx-auto w-fit rounded-3xl bg-slate-900 p-2 shadow-xl">
                  {periodData && (
                    <NetworkTemplate
                      ref={templateRef}
                      data={periodData}
                      totalUsers={metrics.total_users}
                      totalBalance={metrics.total_balance}
                      totalTx={metrics.tx_total_count}
                      countries={metrics.countries_count}
                      topCountries={metrics.countries.slice(0, 5)}
                    />
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

const Stat = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "emerald" | "amber" | "violet" }) => {
  const tones: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${tones[tone]} p-4`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-extrabold text-foreground">{value}</div>
    </div>
  );
};

const PeriodCard = ({
  label,
  users,
  usersChange,
  volume,
  volumeChange,
  tx,
}: {
  label: string;
  users: number;
  usersChange: number;
  volume: number;
  volumeChange: number;
  tx: number;
}) => (
  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-sm font-bold text-foreground">{label}</span>
      <TrendingUp className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2">
      <Row label="New users" value={fmt(users)} change={usersChange} />
      <Row label="Volume" value={fmtMoney(volume)} change={volumeChange} />
      <Row label="Transactions" value={fmt(tx)} />
    </div>
  </div>
);

const Row = ({ label, value, change }: { label: string; value: string; change?: number }) => (
  <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2">
    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-foreground">{value}</span>
      {typeof change === "number" && (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

type TemplateData = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: number;
  primaryChange: number;
  volumeLabel: string;
  volumeValue: number;
  volumeChange: number;
  txCount: number;
};

const NetworkTemplate = forwardRef<
  HTMLDivElement,
  {
    data: TemplateData;
    totalUsers: number;
    totalBalance: number;
    totalTx: number;
    countries: number;
    topCountries: Country[];
  }
>(({ data, totalUsers, totalBalance, totalTx, countries, topCountries }, ref) => {
  const now = new Date();
  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: "radial-gradient(circle at 20% 10%, #0b3a8c 0%, #051a44 55%, #030615 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      className="relative flex flex-col overflow-hidden rounded-2xl p-14 text-white"
    >
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      <div className="z-10 flex items-center gap-4">
        <img src="/openpay-o.svg" alt="OpenPay" style={{ height: 72, width: 72 }} crossOrigin="anonymous" />
        <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>OpenPay</span>
      </div>

      <div
        className="z-10 mt-3"
        style={{ fontSize: 20, color: "#93c5fd", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}
      >
        {data.subtitle}
      </div>

      <h1 className="z-10 mt-3" style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        {data.title}
      </h1>

      <div className="z-10 mt-10 grid w-full grid-cols-2 gap-5">
        <BigStat iconBg="#2563eb" icon="users" label={data.primaryLabel} value={fmt(data.primaryValue) + "+"} change={data.primaryChange} />
        <BigStat iconBg="#0ea5e9" icon="globe" label="Total Users" value={fmt(totalUsers) + "+"} />
      </div>

      <div className="z-10 mt-5 grid w-full grid-cols-2 gap-5">
        <BigStat iconBg="#7c3aed" icon="wallet" label={data.volumeLabel} value={fmtMoney(data.volumeValue)} change={data.volumeChange} />
        <BigStat iconBg="#10b981" icon="tx" label="Distributed Balance" value={fmtMoney(totalBalance)} />
      </div>

      <div className="z-10 mt-5 grid w-full grid-cols-2 gap-5">
        <BigStat iconBg="#f59e0b" icon="tx" label="Total Transactions" value={fmt(totalTx) + "+"} />
        <BigStat iconBg="#ef4444" icon="globe" label="Countries" value={fmt(countries)} subtitle={topCountries.map((c) => c.country).slice(0, 3).join(" · ")} />
      </div>

      <div
        className="z-10 mt-auto flex w-full items-center justify-between pt-8"
        style={{ fontSize: 20, color: "#93c5fd" }}
      >
        <span>openpay.lovable.app</span>
        <span>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
});
NetworkTemplate.displayName = "NetworkTemplate";

const BigStat = ({
  iconBg,
  icon,
  label,
  value,
  change,
  subtitle,
}: {
  iconBg: string;
  icon: "users" | "wallet" | "tx" | "globe";
  label: string;
  value: string;
  change?: number;
  subtitle?: string;
}) => (
  <div
    style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 24,
      padding: 24,
      backdropFilter: "blur(8px)",
    }}
  >
    <div className="flex items-center justify-between">
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon === "users" && <Users className="h-7 w-7 text-white" />}
        {icon === "wallet" && <Wallet className="h-7 w-7 text-white" />}
        {icon === "tx" && <ArrowLeftRight className="h-7 w-7 text-white" />}
        {icon === "globe" && <Globe2 className="h-7 w-7 text-white" />}
      </div>
      {typeof change === "number" && (
        <span
          style={{
            background: change >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            color: change >= 0 ? "#34d399" : "#f87171",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
    <div style={{ marginTop: 18, fontSize: 20, color: "#cbd5ff", fontWeight: 600 }}>{label}</div>
    <div style={{ marginTop: 6, fontSize: 48, fontWeight: 800, color: "#fbbf24", letterSpacing: -1 }}>{value}</div>
    {subtitle && <div style={{ marginTop: 4, fontSize: 16, color: "#94a3b8" }}>{subtitle}</div>}
  </div>
);

export default AdminOpenPayMetricsPage;
