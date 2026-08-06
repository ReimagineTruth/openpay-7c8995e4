import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Copy, ExternalLink, QrCode, TrendingUp, Wallet, CreditCard, Eye, Trash2, BarChart3, Users, ChevronDown, ChevronUp, Package, Mail, Phone, RefreshCw, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QrPayHeader from "@/components/qrpay/QrPayHeader";
import QrPayGuideDialog from "@/components/qrpay/QrPayGuideDialog";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import BrandLogo from "@/components/BrandLogo";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface QrPay {
  id: string;
  token: string;
  title: string;
  currency: string;
  total: number;
  status: string;
  created_at: string;
  payment_type?: string | null;
  payment_purpose?: string | null;
}
interface QrItem { id: string; name: string; quantity: number; unit_price: number; line_total: number; image_url: string | null; description?: string | null; }
interface Tx {
  id: string;
  qr_payment_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transaction_ref: string;
  paid_at: string | null;
  payer_name: string | null;
  payer_email: string | null;
  payer_phone: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
}

function customerInitials(name?: string | null, email?: string | null) {
  const src = (name || email || "C").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function methodLabel(method: string) {
  const m = (method || "").toLowerCase();
  if (m === "pi") return "Pi Network";
  if (m === "wallet") return "OpenPay Wallet";
  if (m === "virtual_card" || m === "card") return "Virtual Card";
  if (m === "pro") return "OpenPay Pro";
  return method.replace(/_/g, " ");
}

function OrderField({ label, value, multiline }: { label: string; value?: string | null; multiline?: boolean }) {
  const empty = !value || !String(value).trim();
  return (
    <div className="qrp-order-field">
      <div className="qrp-order-field-k">{label}</div>
      <div className={`qrp-order-field-v ${empty ? "is-empty" : ""} ${multiline ? "whitespace-pre-line" : ""}`}>
        {empty ? "—" : value}
      </div>
    </div>
  );
}

type Range = "today" | "week" | "month" | "year" | "all";

interface Stats {
  total: number; today: number; week: number; month: number; year: number;
  count: number; by_method: Record<string, number>; available_balance: number;
}

interface Analytics {
  daily: { date: string; label: string; revenue: number; payments: number }[];
  top: { id: string; token: string; title: string; currency: string; revenue: number; payments: number }[];
  by_method: Record<string, number>;
  totals: { total_revenue: number; total_payments: number; avg_payment: number; unique_customers: number };
}

export default function QrPayDashboardPage() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [stats, setStats] = useState<Stats | null>(null);
  const [payments, setPayments] = useState<QrPay[]>([]);
  const [recentTx, setRecentTx] = useState<Tx[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QrPay | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [range, setRange] = useState<Range>("month");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, QrItem[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<"overview" | "links" | "orders">("overview");
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("qrpay_guide_seen")) {
      setGuideOpen(true);
      localStorage.setItem("qrpay_guide_seen", "1");
    }
  }, []);

  const rangeLabel = useMemo(() => ({
    today: "today", week: "this week", month: "last 30 days", year: "this year", all: "all time"
  } as Record<Range, string>)[range], [range]);

  const load = async (r: Range = range) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: s }, { data: list }, { data: txs }, { data: an }] = await Promise.all([
      (supabase as any).rpc("qr_pay_merchant_stats"),
      (supabase as any).from("qr_payments")
        .select("id,token,title,currency,total,status,created_at,payment_type,payment_purpose")
        .eq("merchant_user_id", user.id)
        .order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("qr_payment_transactions")
        .select("id,qr_payment_id,amount,currency,method,status,transaction_ref,paid_at,payer_name,payer_email,payer_phone,delivery_address,delivery_notes")
        .eq("merchant_user_id", user.id)
        .order("created_at", { ascending: false }).limit(50),
      (supabase as any).rpc("qr_pay_analytics", { p_range: r }),
    ]);
    setStats(s as any);
    setPayments((list as any) || []);
    setRecentTx((txs as any) || []);
    setAnalytics(an as any);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await load(range);
    setRefreshing(false);
  };

  useEffect(() => { load(range); /* eslint-disable-next-line */ }, [range]);

  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase.channel("qr-pay-tx")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "qr_payment_transactions", filter: `merchant_user_id=eq.${user.id}` },
          (payload: any) => {
            setRecentTx(prev => [payload.new as Tx, ...prev].slice(0, 50));
            toast.success(`New payment: ${payload.new.currency} ${Number(payload.new.amount).toFixed(2)}`);
            load(range);
          })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
          () => { load(range); })
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = async (tx: Tx) => {
    const key = tx.id;
    if (expanded === key) { setExpanded(null); return; }
    setExpanded(key);
    if (!itemsCache[tx.qr_payment_id]) {
      const { data } = await (supabase as any)
        .from("qr_payment_items")
        .select("id,name,quantity,unit_price,line_total,image_url,description")
        .eq("qr_payment_id", tx.qr_payment_id);
      setItemsCache(prev => ({ ...prev, [tx.qr_payment_id]: (data as any) || [] }));
    }
  };


  const copy = (token: string) => {
    const url = `${window.location.origin}/qr-pay/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied");
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { data, error } = await (supabase as any).rpc("qr_pay_delete", { p_id: confirmDelete.id });
    setDeleting(false);
    if (error || !data?.success) {
      toast.error(error?.message || data?.error || "Failed to delete");
      return;
    }
    toast.success("QR payment deleted");
    setPayments(prev => prev.filter(p => p.id !== confirmDelete.id));
    setConfirmDelete(null);
    load();
  };

  const previewUrl = previewToken ? `${window.location.origin}/qr-pay/${previewToken}` : "";

  return (
    <div className="min-h-screen qrp-page-bg pb-28">
      <QrPayHeader
        eyebrow="OpenPay"
        title="QR Pay"
        subtitle="Accept payments with QR codes and links."
        watermark="QR"
        backTo="/dashboard"
        backLabel="Back to dashboard"
        actions={
          <>
            <Button variant="ghost" size="icon" className="qrp-hero-btn rounded-full h-9 w-9" onClick={() => setGuideOpen(true)} title="How QR Pay works">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="qrp-hero-btn rounded-full h-9 w-9" onClick={refresh} title="Refresh">
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" className="qrp-hero-btn rounded-full h-10 px-3.5 text-[13px] font-semibold" onClick={() => navigate("/qr-pay/api")} title="QR Pay API">
              API
            </Button>
            <Button size="sm" className="qrp-hero-cta rounded-full h-10 px-4 text-[14px]" onClick={() => navigate("/qr-pay/new")}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </>
        }
      />


      <div className="relative z-[1] mx-auto max-w-6xl space-y-4 p-3 sm:space-y-5 sm:p-5">
        {/* ── Section nav ─────────────────── */}
        <div className="qrp-subnav qrp-rise">
          {([["overview", "Overview", BarChart3], ["links", "Payment links", QrCode], ["orders", "Orders", Package]] as const).map(([k, label, Icon]) => (
            <button key={k} type="button" onClick={() => setSection(k)}
              className={`qrp-subnav-tab ${section === k ? "is-active" : ""}`}>
              <Icon className="h-4 w-4" />
              {label}
              {k === "links" && <span className="qrp-subnav-count">{payments.length}</span>}
              {k === "orders" && <span className="qrp-subnav-count">{recentTx.length}</span>}
            </button>
          ))}
        </div>

        {section === "overview" && (
        <div className="space-y-4 qrp-stagger sm:space-y-5">
        {/* Top KPI cards */}
        <div className="qrp-dash-grid cols-2">
          <div className="qrp-card-blue p-4 sm:p-6">
            <div className="qrp-label flex items-center gap-1.5"><Wallet className="h-4 w-4"/>Available balance</div>
            <div className="qrp-display mt-2 text-[2.5rem] leading-none sm:text-[3rem]">{format(stats?.available_balance || 0)}</div>
            <div className="qrp-meta mt-2.5">Updates in realtime</div>
          </div>
          <div className="qrp-sheet p-4 sm:p-6">
            <div className="qrp-label flex items-center gap-1.5"><TrendingUp className="h-4 w-4"/>Total revenue</div>
            <div className="qrp-display mt-2 text-[2.5rem] leading-none text-foreground sm:text-[3rem]">{format(stats?.total || 0)}</div>
            <div className="qrp-meta mt-2.5">{stats?.count || 0} payments settled</div>
          </div>
        </div>

        <div className="qrp-dash-grid cols-4">
          {([["today","Today",stats?.today],["week","Week",stats?.week],["month","Month",stats?.month],["year","Year",stats?.year]] as const).map(([k,label,val]) => (
            <div key={k} className="qrp-kpi">
              <div className="qrp-label">{label}</div>
              <div className="qrp-value mt-1.5 text-[1.15rem] sm:text-[1.25rem]">{format(Number(val) || 0)}</div>
            </div>
          ))}
        </div>

        {/* Method breakdown */}
        <div className="qrp-sheet">
          <div className="qrp-sheet-head"><span>Revenue by method</span><span>All time</span></div>
          <div className="grid grid-cols-3 divide-x divide-border/70">
            {([["Pi", stats?.by_method?.pi, "bg-black/[0.05] text-[var(--qrp-ink)]"], ["Wallet", stats?.by_method?.wallet, "bg-black/[0.05] text-[var(--qrp-accent)]"], ["Card", stats?.by_method?.virtual_card, "bg-slate-500/10 text-slate-600"]] as const).map(([label, val, tone], i) => (
              <div key={label} className="p-4 text-center sm:p-5">
                <span className={`mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full ${tone}`}>
                  {i === 0 ? <span className="text-base font-bold">π</span> : i === 1 ? <Wallet className="h-4 w-4"/> : <CreditCard className="h-4 w-4"/>}
                </span>
                <div className="qrp-label">{label}</div>
                <div className="qrp-value mt-1">{format(Number(val) || 0)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics */}
        <div className="qrp-sheet">
          <div className="qrp-sheet-head">
            <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-[var(--qrp-accent)]" /> Analytics — <span className="font-medium text-[var(--qrp-muted)]">{rangeLabel}</span></span>
            <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
              <TabsList className="h-9">
                {(["today","week","month","year","all"] as Range[]).map(r => (
                  <TabsTrigger key={r} value={r} className="h-7 px-2.5 text-[13px] capitalize">{r}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="p-4 sm:p-5">
            {analytics?.totals && (
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="qrp-label">Revenue</div>
                  <div className="qrp-value mt-1">{format(Number(analytics.totals.total_revenue) || 0)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="qrp-label">Payments</div>
                  <div className="qrp-value mt-1">{analytics.totals.total_payments}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="qrp-label">Avg payment</div>
                  <div className="qrp-value mt-1">{format(Number(analytics.totals.avg_payment) || 0)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5">
                  <div className="qrp-label flex items-center gap-1"><Users className="h-3.5 w-3.5"/>Customers</div>
                  <div className="qrp-value mt-1">{analytics.totals.unique_customers}</div>
                </div>
              </div>
            )}

            <div className="h-52 -mx-1 sm:h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.daily || []} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                  <defs>
                    <linearGradient id="qrRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d1d1f" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#1d1d1f" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#86868b" }} interval={4} />
                  <YAxis tick={{ fontSize: 12, fill: "#86868b" }} width={42} />
                  <Tooltip
                    contentStyle={{ fontSize: 14, borderRadius: 10 }}
                    formatter={(v: any, name: string) => [name === "revenue" ? format(Number(v) || 0) : v, name === "revenue" ? "Revenue" : "Payments"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#1d1d1f" fill="url(#qrRev)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {analytics?.top && analytics.top.length > 0 && (
            <div className="border-t border-border/70">
              <div className="qrp-sheet-head border-b-0"><span>Top performing</span></div>
              <div className="px-4 pb-4">
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70">
                  {analytics.top.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 bg-card px-3.5 py-3 text-[14px]">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/[0.05] font-mono text-[12px] font-bold text-[var(--qrp-accent)]">{i+1}</span>
                        <span className="truncate font-semibold text-foreground">{t.title || "Untitled"}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-[13px] text-muted-foreground">{t.payments}×</span>
                        <span className="font-bold text-foreground">{t.currency} {Number(t.revenue).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
        )}

        {/* ── Payment links ─────────────────────────────────────── */}
        {section === "links" && (
        <div className="qrp-sheet qrp-rise">
          <div className="qrp-sheet-head">
            <span>Payment links</span>
            <Button variant="ghost" size="sm" className="h-8 text-[13px] font-semibold text-[var(--qrp-accent)]" onClick={() => navigate("/qr-pay/new")}>
              <Plus className="mr-1 h-4 w-4"/>Create
            </Button>
          </div>
          {loading ? <p className="p-4 text-[15px] text-muted-foreground">Loading…</p> :
            payments.length === 0 ? (
              <div className="p-8 text-center">
                <QrCode className="mx-auto mb-2 h-10 w-10 text-muted-foreground"/>
                <p className="mb-3 text-[15px] text-muted-foreground">No QR payments yet</p>
                <Button className="qrp-primary-btn gap-2" onClick={() => navigate("/qr-pay/new")}>
                  <BrandLogo variant="white" animate={false} className="h-5 w-5" />
                  Create your first
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3.5 py-3.5 transition-colors hover:bg-muted/40">
                    <div className="shrink-0 rounded-xl bg-muted p-2.5"><QrCode className="h-5 w-5"/></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-[15px] font-semibold text-foreground">{p.title || "Untitled"}</div>
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[12px] capitalize">{p.status}</Badge>
                      </div>
                      <div className="qrp-meta mt-0.5">
                        {p.payment_purpose ? `${String(p.payment_purpose).replace(/_/g, " ")} · ` : ""}
                        {p.currency} {Number(p.total).toFixed(2)} · {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewToken(p.token)} title="Preview"><Eye className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(p.token)} title="Copy link"><Copy className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(`/qr-pay/${p.token}`, "_blank")} title="Open"><ExternalLink className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(p)} title="Delete"><Trash2 className="h-4 w-4"/></Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        )}

        {/* ── Orders ───────────────────────────────────────────── */}
        {section === "orders" && (
        <div className="qrp-sheet qrp-rise">
          <div className="qrp-sheet-head">
            <span>Orders &amp; customer details</span>
            <span className="normal-case tracking-normal">{recentTx.length} recent</span>
          </div>
          {recentTx.length === 0 ? <p className="p-6 text-center text-[15px] text-muted-foreground">No orders received yet.</p> : (
            <div className="divide-y divide-border/60">
              {recentTx.map(t => {
                const open = expanded === t.id;
                const items = itemsCache[t.qr_payment_id] || [];
                const linked = payments.find(p => p.id === t.qr_payment_id);
                return (
                  <div key={t.id}>
                    <button type="button" onClick={() => toggleExpand(t)} className="w-full px-3.5 py-3.5 text-left transition-colors hover:bg-muted/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-[var(--qrp-accent)]" />
                            <div className="truncate text-[15px] font-semibold text-foreground">{t.payer_name || "Customer"}</div>
                            <Badge variant={t.status === "succeeded" ? "default" : "secondary"} className="text-[12px] capitalize">{t.status}</Badge>
                          </div>
                          <div className="qrp-meta mt-1 truncate capitalize">
                            {linked?.title || "QR payment"} · {methodLabel(t.method)} · #{t.transaction_ref}
                          </div>
                          {(t.payer_email || t.payer_phone) && (
                            <div className="qrp-meta mt-0.5 truncate normal-case">
                              {[t.payer_email, t.payer_phone].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[15px] font-bold text-foreground">{t.currency} {Number(t.amount).toFixed(2)}</div>
                          <div className="qrp-meta mt-0.5">{t.paid_at ? new Date(t.paid_at).toLocaleString() : ""}</div>
                          <div className="mt-1 flex items-center justify-end gap-0.5 text-[13px] font-semibold text-[var(--qrp-accent)]">
                            {open ? <>Hide<ChevronUp className="h-3.5 w-3.5"/></> : <>Details<ChevronDown className="h-3.5 w-3.5"/></>}
                          </div>
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="border-t border-border/60 bg-[#f6f6f8] px-3.5 py-3.5 qrp-rise">
                        <div className="qrp-order-panel">
                          {/* Customer */}
                          <div className="qrp-order-card">
                            <div className="qrp-order-card-head">
                              <span>Customer</span>
                              {(t.payer_email || t.payer_phone) && (
                                <span className="normal-case tracking-normal text-[11px] font-medium text-emerald-600">Contact saved</span>
                              )}
                            </div>
                            <div className="qrp-order-card-body">
                              <div className="mb-2.5 flex items-center gap-3">
                                <span className="qrp-order-avatar">{customerInitials(t.payer_name, t.payer_email)}</span>
                                <div className="min-w-0">
                                  <div className="truncate text-[15px] font-semibold tracking-[-0.015em] text-foreground">
                                    {t.payer_name || "Guest customer"}
                                  </div>
                                  <div className="qrp-meta truncate">
                                    {t.payer_email || "No email on file"}
                                  </div>
                                </div>
                              </div>
                              <OrderField label="Name" value={t.payer_name} />
                              <OrderField label="Email" value={t.payer_email} />
                              <OrderField label="Phone" value={t.payer_phone} />
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {t.payer_email && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-full text-[12px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `mailto:${t.payer_email}?subject=Your OpenPay order ${t.transaction_ref}`;
                                    }}
                                  >
                                    <Mail className="mr-1 h-3.5 w-3.5" /> Email
                                  </Button>
                                )}
                                {t.payer_phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-full text-[12px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `tel:${t.payer_phone}`;
                                    }}
                                  >
                                    <Phone className="mr-1 h-3.5 w-3.5" /> Call
                                  </Button>
                                )}
                                {t.payer_email && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 rounded-full text-[12px]"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(t.payer_email || "");
                                      toast.success("Email copied");
                                    }}
                                  >
                                    Copy email
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Shipping + payment */}
                          <div className="space-y-3">
                            <div className="qrp-order-card">
                              <div className="qrp-order-card-head">
                                <span>Shipping / delivery</span>
                              </div>
                              <div className="qrp-order-card-body">
                                <OrderField label="Address" value={t.delivery_address} multiline />
                                <OrderField label="Notes" value={t.delivery_notes} multiline />
                                {!t.delivery_address && (
                                  <p className="mt-1 text-[11px] leading-snug text-[#8e8e93]">
                                    Enable “Collect delivery details” on the payment link to capture address at checkout.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="qrp-order-card">
                              <div className="qrp-order-card-head">
                                <span>Payment</span>
                              </div>
                              <div className="qrp-order-card-body">
                                <OrderField label="Status" value={t.status} />
                                <OrderField label="Method" value={methodLabel(t.method)} />
                                <OrderField label="Amount" value={`${t.currency} ${Number(t.amount).toFixed(2)}`} />
                                <OrderField label="Paid" value={t.paid_at ? new Date(t.paid_at).toLocaleString() : null} />
                                <OrderField label="Order ID" value={t.transaction_ref} />
                                {linked?.payment_purpose && (
                                  <OrderField label="Purpose" value={String(linked.payment_purpose).replace(/_/g, " ")} />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Line items */}
                          <div className="qrp-order-card qrp-order-items">
                            <div className="qrp-order-card-head">
                              <span>Order items</span>
                              <span className="normal-case tracking-normal text-[11px] font-medium text-[var(--qrp-muted)]">
                                {(items.length || 1)} item{(items.length || 1) === 1 ? "" : "s"}
                              </span>
                            </div>
                            <div className="qrp-order-card-body">
                              {(items.length > 0
                                ? items
                                : [{
                                    id: "synthetic",
                                    name: linked?.title || "OpenPay payment",
                                    quantity: 1,
                                    unit_price: Number(t.amount),
                                    line_total: Number(t.amount),
                                    image_url: null as string | null,
                                    description: linked?.payment_purpose
                                      ? String(linked.payment_purpose).replace(/_/g, " ")
                                      : "Checkout payment",
                                  }]
                              ).map((it) => (
                                <div key={it.id} className="qrp-order-line">
                                  {it.image_url ? (
                                    <img src={it.image_url} alt={it.name} className="qrp-order-thumb" />
                                  ) : (
                                    <div className="qrp-order-thumb-ph">
                                      <Package className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground">
                                      {it.name}
                                    </div>
                                    <div className="qrp-meta">
                                      Qty {it.quantity} · {t.currency} {Number(it.unit_price).toFixed(2)} each
                                      {"description" in it && it.description ? ` · ${it.description}` : ""}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-[14px] font-semibold text-foreground">
                                    {t.currency} {Number(it.line_total).toFixed(2)}
                                  </div>
                                </div>
                              ))}

                              <div className="qrp-order-totals">
                                <div className="qrp-order-total-row">
                                  <span>Subtotal</span>
                                  <span>{t.currency} {Number(t.amount).toFixed(2)}</span>
                                </div>
                                <div className="qrp-order-total-row">
                                  <span>Fees</span>
                                  <span className="text-emerald-600">No fee</span>
                                </div>
                                <div className="qrp-order-total-row is-grand">
                                  <span>Total paid</span>
                                  <span>{t.currency} {Number(t.amount).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {linked && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-full text-[13px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(`/qr-pay/${linked.token}`, "_blank");
                              }}
                            >
                              <ExternalLink className="mr-1 h-3.5 w-3.5" /> View checkout
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 rounded-full text-[13px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(t.transaction_ref);
                              toast.success("Order ID copied");
                            }}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" /> Copy order ID
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </div>


      {/* Preview dialog */}
      <Dialog open={!!previewToken} onOpenChange={(o) => !o && setPreviewToken(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-base">Checkout preview</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => previewToken && copy(previewToken)}><Copy className="h-3 w-3 mr-1"/>Copy link</Button>
            <Button size="sm" onClick={() => previewToken && window.open(`/qr-pay/${previewToken}`, "_blank")}><ExternalLink className="h-3 w-3 mr-1"/>Open</Button>
          </div>
          {previewToken && (
            <iframe src={previewUrl} title="QR Pay preview" className="w-full h-[560px] border-t bg-white" />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{confirmDelete?.title || "Untitled"}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the QR payment and its associated transaction records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QrPayGuideDialog open={guideOpen} onOpenChange={setGuideOpen} onCreate={() => navigate("/qr-pay/new")} />

      <BottomNav active="menu" />
    </div>
  );
}
