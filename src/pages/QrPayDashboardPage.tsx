import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Copy, ExternalLink, QrCode, TrendingUp, Wallet, CreditCard, Eye, Trash2, BarChart3, Users, ChevronDown, ChevronUp, Package, Mail, Phone, MapPin, StickyNote, RefreshCw, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import QrPayHeader from "@/components/qrpay/QrPayHeader";
import QrPayGuideDialog from "@/components/qrpay/QrPayGuideDialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
}
interface QrItem { id: string; name: string; quantity: number; unit_price: number; line_total: number; image_url: string | null; }
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
        .select("id,token,title,currency,total,status,created_at")
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
        .select("id,name,quantity,unit_price,line_total,image_url")
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
            <Button size="sm" className="qrp-hero-btn rounded-full h-9 px-3 text-xs font-semibold" onClick={() => navigate("/qr-pay/api")} title="QR Pay API">
              API
            </Button>
            <Button size="sm" className="qrp-hero-cta rounded-full h-9 px-4" onClick={() => navigate("/qr-pay/new")}>
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
              <Icon className="h-3.5 w-3.5" />
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
            <div className="text-[11px] uppercase tracking-[0.14em] opacity-90 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5"/>Available balance</div>
            <div className="qrp-display mt-2 text-[2.35rem] leading-none sm:text-[2.85rem]">{format(stats?.available_balance || 0)}</div>
            <div className="text-[11px] opacity-80 mt-2.5">Updates in realtime</div>
          </div>
          <div className="qrp-sheet p-4 sm:p-6">
            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5"/>Total revenue</div>
            <div className="qrp-display mt-2 text-[2.35rem] leading-none text-foreground sm:text-[2.85rem]">{format(stats?.total || 0)}</div>
            <div className="text-xs text-muted-foreground mt-2.5">{stats?.count || 0} payments settled</div>
          </div>
        </div>

        <div className="qrp-dash-grid cols-4">
          {([["today","Today",stats?.today],["week","Week",stats?.week],["month","Month",stats?.month],["year","Year",stats?.year]] as const).map(([k,label,val]) => (
            <div key={k} className="qrp-kpi">
              <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
              <div className="text-base font-semibold tracking-[-0.02em] text-foreground mt-1">{format(Number(val) || 0)}</div>
            </div>
          ))}
        </div>

        {/* Method breakdown */}
        <div className="qrp-sheet">
          <div className="qrp-sheet-head"><span>Revenue by method</span><span className="normal-case tracking-normal">All time</span></div>
          <div className="grid grid-cols-3 divide-x divide-border/70">
            {([["Pi", stats?.by_method?.pi, "bg-black/[0.05] text-[var(--qrp-ink)]"], ["Wallet", stats?.by_method?.wallet, "bg-black/[0.05] text-[var(--qrp-accent)]"], ["Card", stats?.by_method?.virtual_card, "bg-slate-500/10 text-slate-600"]] as const).map(([label, val, tone], i) => (
              <div key={label} className="p-4 text-center">
                <span className={`mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full ${tone}`}>
                  {i === 0 ? <span className="text-sm font-bold">π</span> : i === 1 ? <Wallet className="h-4 w-4"/> : <CreditCard className="h-4 w-4"/>}
                </span>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-0.5 font-bold text-foreground">{format(Number(val) || 0)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics */}
        <div className="qrp-sheet">
          <div className="qrp-sheet-head">
            <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-[var(--qrp-accent)]" /> Analytics — <span className="normal-case tracking-normal">{rangeLabel}</span></span>
            <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
              <TabsList className="h-8">
                {(["today","week","month","year","all"] as Range[]).map(r => (
                  <TabsTrigger key={r} value={r} className="h-6 px-2 text-[11px] capitalize">{r}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="p-4">
            {analytics?.totals && (
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Revenue</div>
                  <div className="text-sm font-bold">{format(Number(analytics.totals.total_revenue) || 0)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Payments</div>
                  <div className="text-sm font-bold">{analytics.totals.total_payments}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Avg payment</div>
                  <div className="text-sm font-bold">{format(Number(analytics.totals.avg_payment) || 0)}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>Customers</div>
                  <div className="text-sm font-bold">{analytics.totals.unique_customers}</div>
                </div>
              </div>
            )}

            <div className="h-44 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.daily || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="qrRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d1d1f" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#1d1d1f" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
                    <div key={t.id} className="flex items-center justify-between gap-3 bg-card px-3 py-2.5 text-xs">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/[0.05] font-mono text-[10px] font-bold text-[var(--qrp-accent)]">{i+1}</span>
                        <span className="truncate font-semibold text-foreground">{t.title || "Untitled"}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-muted-foreground">{t.payments}×</span>
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
            <Button variant="ghost" size="sm" className="h-7 text-xs normal-case tracking-normal text-[var(--qrp-accent)]" onClick={() => navigate("/qr-pay/new")}>
              <Plus className="mr-1 h-3.5 w-3.5"/>Create
            </Button>
          </div>
          {loading ? <p className="p-4 text-sm text-muted-foreground">Loading…</p> :
            payments.length === 0 ? (
              <div className="p-8 text-center">
                <QrCode className="mx-auto mb-2 h-10 w-10 text-muted-foreground"/>
                <p className="mb-3 text-sm text-muted-foreground">No QR payments yet</p>
                <Button className="qrp-primary-btn" onClick={() => navigate("/qr-pay/new")}>Create your first</Button>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40">
                    <div className="shrink-0 rounded-xl bg-muted p-2.5"><QrCode className="h-5 w-5"/></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-foreground">{p.title || "Untitled"}</div>
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">{p.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.currency} {Number(p.total).toFixed(2)} · {new Date(p.created_at).toLocaleDateString()}</div>
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
          {recentTx.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">No orders received yet.</p> : (
            <div className="divide-y divide-border/60">
              {recentTx.map(t => {
                const open = expanded === t.id;
                const items = itemsCache[t.qr_payment_id] || [];
                const linked = payments.find(p => p.id === t.qr_payment_id);
                return (
                  <div key={t.id}>
                    <button type="button" onClick={() => toggleExpand(t)} className="w-full px-3 py-3 text-left transition-colors hover:bg-muted/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 shrink-0 text-[var(--qrp-accent)]" />
                            <div className="truncate text-sm font-semibold text-foreground">{t.payer_name || "Customer"}</div>
                            <Badge variant={t.status === "succeeded" ? "default" : "secondary"} className="text-[10px] capitalize">{t.status}</Badge>
                          </div>
                          <div className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
                            {linked?.title || "QR payment"} · {t.method.replace("_"," ")} · #{t.transaction_ref}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-foreground">{t.currency} {Number(t.amount).toFixed(2)}</div>
                          <div className="text-[11px] text-muted-foreground">{t.paid_at ? new Date(t.paid_at).toLocaleString() : ""}</div>
                          <div className="mt-0.5 flex items-center justify-end gap-0.5 text-[11px] font-semibold text-[var(--qrp-accent)]">
                            {open ? <>Hide<ChevronUp className="h-3 w-3"/></> : <>Details<ChevronDown className="h-3 w-3"/></>}
                          </div>
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-border/60 bg-muted/30 px-3 py-3 qrp-rise">
                        {/* Customer */}
                        <div>
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Customer</div>
                          <div className="space-y-1 text-xs text-foreground">
                            {t.payer_email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground"/>{t.payer_email}</div>}
                            {t.payer_phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground"/>{t.payer_phone}</div>}
                            {t.delivery_address && <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3 w-3 text-muted-foreground"/><span className="whitespace-pre-line">{t.delivery_address}</span></div>}
                            {t.delivery_notes && <div className="flex items-start gap-2"><StickyNote className="mt-0.5 h-3 w-3 text-muted-foreground"/><span className="italic">{t.delivery_notes}</span></div>}
                            {!t.payer_email && !t.payer_phone && !t.delivery_address && !t.delivery_notes && (
                              <div className="text-muted-foreground">No customer details captured.</div>
                            )}
                          </div>
                        </div>
                        {/* Items */}
                        <div>
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Items</div>
                          {items.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No itemized line items.</div>
                          ) : (
                            <div className="space-y-1">
                              {items.map(it => (
                                <div key={it.id} className="flex items-center gap-2 text-xs">
                                  {it.image_url ? (
                                    <img src={it.image_url} alt={it.name} className="h-8 w-8 rounded border object-cover" />
                                  ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted"><Package className="h-3 w-3 text-muted-foreground"/></div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium text-foreground">{it.name}</div>
                                    <div className="text-muted-foreground">{it.quantity} × {t.currency} {Number(it.unit_price).toFixed(2)}</div>
                                  </div>
                                  <div className="font-semibold text-foreground">{t.currency} {Number(it.line_total).toFixed(2)}</div>
                                </div>
                              ))}
                              <div className="mt-1 flex justify-between border-t pt-1 text-xs">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-bold text-foreground">{t.currency} {Number(t.amount).toFixed(2)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          {linked && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); window.open(`/qr-pay/${linked.token}`, "_blank"); }}>
                              <ExternalLink className="mr-1 h-3 w-3"/>View checkout
                            </Button>
                          )}
                          {t.payer_email && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${t.payer_email}?subject=Your order ${t.transaction_ref}`; }}>
                              <Mail className="mr-1 h-3 w-3"/>Email customer
                            </Button>
                          )}
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
