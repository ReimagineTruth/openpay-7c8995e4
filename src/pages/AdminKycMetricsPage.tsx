import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, RefreshCw, ShieldCheck, TrendingUp, Users, CheckCircle2, Calendar, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_PROFILE_USERNAMES } from "@/lib/kyc";

type Period = "daily" | "monthly" | "yearly";

type Metrics = {
  totalUsers: number;
  totalApproved: number;
  pending: number;
  rejected: number;
  todayApproved: number;
  monthApproved: number;
  yearApproved: number;
  prevDayApproved: number;
  prevMonthApproved: number;
  prevYearApproved: number;
};

const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

const pctChange = (curr: number, prev: number) => {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const AdminKycMetricsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [period, setPeriod] = useState<Period>("monthly");
  const [exporting, setExporting] = useState(false);
  const templateRef = useRef<HTMLDivElement>(null);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in required");
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      const uname = String(profile?.username || "").trim().toLowerCase().replace(/^@+/, "");
      if (!ADMIN_PROFILE_USERNAMES.has(uname)) {
        toast.error("Admin access only");
        navigate("/dashboard", { replace: true });
        return;
      }

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfPrevDay = new Date(startOfDay); startOfPrevDay.setDate(startOfPrevDay.getDate() - 1);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1);

      const countQuery = async (filter: (q: any) => any) => {
        let q: any = (supabase as any).from("kyc_applications").select("id", { count: "exact", head: true });
        q = filter(q);
        const { count, error } = await q;
        if (error) throw error;
        return count || 0;
      };

      const [
        { count: totalUsers },
        totalApproved,
        pending,
        rejected,
        todayApproved,
        prevDayApproved,
        monthApproved,
        prevMonthApproved,
        yearApproved,
        prevYearApproved,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        countQuery((q) => q.eq("status", "approved")),
        countQuery((q) => q.in("status", ["pending", "under_review"])),
        countQuery((q) => q.eq("status", "rejected")),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfDay.toISOString())),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevDay.toISOString()).lt("reviewed_at", startOfDay.toISOString())),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfMonth.toISOString())),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevMonth.toISOString()).lt("reviewed_at", startOfMonth.toISOString())),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfYear.toISOString())),
        countQuery((q) => q.eq("status", "approved").gte("reviewed_at", startOfPrevYear.toISOString()).lt("reviewed_at", startOfYear.toISOString())),
      ]);

      setMetrics({
        totalUsers: totalUsers || 0,
        totalApproved,
        pending,
        rejected,
        todayApproved,
        monthApproved,
        yearApproved,
        prevDayApproved,
        prevMonthApproved,
        prevYearApproved,
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMetrics(); }, []);

  const periodData = useMemo(() => {
    if (!metrics) return null;
    const now = new Date();
    if (period === "daily") {
      return {
        title: now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
        subtitle: "Daily KYC Update",
        primaryLabel: "Approved Today",
        primaryValue: metrics.todayApproved,
        primaryChange: pctChange(metrics.todayApproved, metrics.prevDayApproved),
        secondaryLabel: "Total Verified Users",
        secondaryValue: metrics.totalApproved,
      };
    }
    if (period === "yearly") {
      return {
        title: `${now.getFullYear()} Network Update`,
        subtitle: "Yearly KYC Update",
        primaryLabel: `${now.getFullYear()} Verified`,
        primaryValue: metrics.yearApproved,
        primaryChange: pctChange(metrics.yearApproved, metrics.prevYearApproved),
        secondaryLabel: "Total Verified Users",
        secondaryValue: metrics.totalApproved,
      };
    }
    return {
      title: `${now.toLocaleString("en-US", { month: "long" })} ${now.getFullYear()} Network Update`,
      subtitle: "Monthly KYC Update",
      primaryLabel: `${now.toLocaleString("en-US", { month: "long" })} Verified`,
      primaryValue: metrics.monthApproved,
      primaryChange: pctChange(metrics.monthApproved, metrics.prevMonthApproved),
      secondaryLabel: "Total Verified Users",
      secondaryValue: metrics.totalApproved,
    };
  }, [metrics, period]);

  const handleDownload = async () => {
    if (!templateRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(templateRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0a0a1f",
      });
      const link = document.createElement("a");
      link.download = `openpay-kyc-${period}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Template image downloaded");
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
            <h1 className="text-lg font-bold text-foreground">KYC Metrics & Templates</h1>
            <p className="text-xs text-muted-foreground">Track verifications and generate shareable updates</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadMetrics} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {loading || !metrics ? (
          <div className="grid h-64 place-items-center"><Loader2 className="h-8 w-8 animate-spin text-paypal-blue" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={<Users className="h-5 w-5" />} label="Total Users" value={metrics.totalUsers} tone="blue" />
              <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="Total Approved" value={metrics.totalApproved} tone="emerald" />
              <StatCard icon={<ShieldCheck className="h-5 w-5" />} label="Pending Review" value={metrics.pending} tone="amber" />
              <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Approved Today" value={metrics.todayApproved} tone="violet" />
            </section>

            <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <PeriodCard label="Today" value={metrics.todayApproved} change={pctChange(metrics.todayApproved, metrics.prevDayApproved)} />
              <PeriodCard label="This Month" value={metrics.monthApproved} change={pctChange(metrics.monthApproved, metrics.prevMonthApproved)} />
              <PeriodCard label="This Year" value={metrics.yearApproved} change={pctChange(metrics.yearApproved, metrics.prevYearApproved)} />
            </section>

            {/* Template generator */}
            <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                    <ImageIcon className="h-5 w-5 text-paypal-blue" /> Social Template
                  </h2>
                  <p className="text-xs text-muted-foreground">Generate a shareable KYC update image for socials</p>
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
                    <SocialTemplate ref={templateRef} data={periodData} totalUsers={metrics.totalUsers} />
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

const StatCard = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "blue" | "emerald" | "amber" | "violet" }) => {
  const tones: Record<string, string> = {
    blue: "from-blue-500/15 to-blue-500/5 text-blue-600",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${tones[tone]} p-4`}>
      <div className="flex items-center gap-2">{icon}<span className="text-xs font-semibold uppercase tracking-wide">{label}</span></div>
      <div className="mt-2 text-2xl font-extrabold text-foreground">{formatNumber(value)}</div>
    </div>
  );
};

const PeriodCard = ({ label, value, change }: { label: string; value: number; change: number }) => (
  <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Calendar className="h-4 w-4" />{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${change >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
        {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
      </span>
    </div>
    <div className="mt-2 text-3xl font-extrabold text-paypal-blue">{formatNumber(value)}</div>
    <div className="text-xs text-muted-foreground">approved KYCs</div>
  </div>
);

type TemplateData = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryValue: number;
  primaryChange: number;
  secondaryLabel: string;
  secondaryValue: number;
};

const SocialTemplate = ({ data, totalUsers, ref: _unused, ...rest }: any) => {
  // forwardRef-lite
  return <SocialTemplateInner {...rest} data={data} totalUsers={totalUsers} />;
};

import { forwardRef } from "react";
const SocialTemplateInner = forwardRef<HTMLDivElement, { data: TemplateData; totalUsers: number }>(({ data, totalUsers }, ref) => {
  const now = new Date();
  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1080,
        background: "radial-gradient(circle at 20% 10%, #1e2a78 0%, #0a0a1f 55%, #050516 100%)",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
      className="relative flex flex-col items-center justify-start overflow-hidden rounded-2xl p-16 text-white"
    >
      {/* glow blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />

      {/* Header logo + brand */}
      <div className="z-10 flex items-center gap-4">
        <img src="/openpay-o.svg" alt="OpenPay" style={{ height: 72, width: 72 }} crossOrigin="anonymous" />
        <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: -1 }}>OpenPay</span>
      </div>

      <div className="z-10 mt-3 text-center" style={{ fontSize: 22, color: "#9ca3ff", fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
        {data.subtitle}
      </div>

      <h1 className="z-10 mt-6 text-center" style={{ fontSize: 78, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
        {data.title}
      </h1>

      {/* Cards */}
      <div className="z-10 mt-14 grid w-full grid-cols-2 gap-6">
        <BigStat
          iconBg="#7c3aed"
          icon="users"
          label={data.primaryLabel}
          value={data.primaryValue}
          change={data.primaryChange}
        />
        <BigStat
          iconBg="#2563eb"
          icon="check"
          label={data.secondaryLabel}
          value={data.secondaryValue}
        />
      </div>

      <div className="z-10 mt-6 grid w-full grid-cols-1 gap-6">
        <BigStat
          iconBg="#0ea5e9"
          icon="globe"
          label="OpenPay Community"
          value={totalUsers}
          wide
        />
      </div>

      {/* Footer */}
      <div className="z-10 mt-auto flex w-full items-center justify-between pt-10" style={{ fontSize: 20, color: "#9ca3ff" }}>
        <span>openpay.lovable.app</span>
        <span>
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>
    </div>
  );
});
SocialTemplateInner.displayName = "SocialTemplateInner";

const BigStat = ({ iconBg, icon, label, value, change, wide }: { iconBg: string; icon: "users" | "check" | "globe"; label: string; value: number; change?: number; wide?: boolean }) => (
  <div
    style={{
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 28,
      padding: 32,
      backdropFilter: "blur(8px)",
    }}
  >
    <div className="flex items-center justify-between">
      <div style={{ width: 64, height: 64, borderRadius: 18, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon === "users" && <Users className="h-8 w-8 text-white" />}
        {icon === "check" && <CheckCircle2 className="h-8 w-8 text-white" />}
        {icon === "globe" && <ShieldCheck className="h-8 w-8 text-white" />}
      </div>
      {typeof change === "number" && (
        <span style={{ background: "rgba(16,185,129,0.15)", color: "#34d399", padding: "8px 16px", borderRadius: 999, fontSize: 18, fontWeight: 700 }}>
          ▲ {Math.abs(change).toFixed(2)}%
        </span>
      )}
    </div>
    <div style={{ marginTop: 24, fontSize: 24, color: "#cbd5ff", fontWeight: 600 }}>{label}</div>
    <div style={{ marginTop: 8, fontSize: wide ? 96 : 72, fontWeight: 800, color: "#fbbf24", letterSpacing: -2 }}>
      {formatNumber(value)}+
    </div>
  </div>
);

export default AdminKycMetricsPage;
