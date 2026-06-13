import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Copy, ExternalLink, QrCode, TrendingUp, Wallet, CreditCard, Eye, Trash2, BarChart3, Users, ChevronDown, ChevronUp, Package, Mail, Phone, MapPin, StickyNote, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
interface Tx {
  id: string;
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

interface Analytics {
  daily: { date: string; label: string; revenue: number; payments: number }[];
  top: { id: string; token: string; title: string; currency: string; revenue: number; payments: number }[];
  by_method: Record<string, number>;
  totals: { total_revenue: number; total_payments: number; avg_payment: number; unique_customers: number };
}

export default function QrPayDashboardPage() {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [stats, setStats] = useState<{ total: number; today: number; week: number; month: number; count: number; by_method: Record<string, number> } | null>(null);
  const [payments, setPayments] = useState<QrPay[]>([]);
  const [recentTx, setRecentTx] = useState<Tx[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QrPay | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: s }, { data: list }, { data: txs }, { data: an }] = await Promise.all([
      (supabase as any).rpc("qr_pay_merchant_stats"),
      (supabase as any).from("qr_payments")
        .select("id,token,title,currency,total,status,created_at")
        .eq("merchant_user_id", user.id)
        .order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("qr_payment_transactions")
        .select("id,amount,currency,method,status,transaction_ref,paid_at,payer_name,payer_email,payer_phone,delivery_address,delivery_notes")
        .eq("merchant_user_id", user.id)
        .order("created_at", { ascending: false }).limit(25),
      (supabase as any).rpc("qr_pay_analytics"),
    ]);
    setStats(s as any);
    setPayments((list as any) || []);
    setRecentTx((txs as any) || []);
    setAnalytics(an as any);
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await load();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const channel = supabase.channel("qr-pay-tx")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "qr_payment_transactions", filter: `merchant_user_id=eq.${user.id}` },
          (payload: any) => {
            setRecentTx(prev => [payload.new as Tx, ...prev].slice(0, 25));
            toast.success(`New payment: ${payload.new.currency} ${Number(payload.new.amount).toFixed(2)}`);
            load();
          })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="min-h-screen bg-background pb-28">
      <div className="bg-gradient-to-r from-paypal-blue to-[#0073e6] text-primary-foreground">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/20" onClick={() => navigate("/dashboard")}><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">QR Pay</h1>
            <p className="text-sm opacity-90">Accept payments with sharable QR codes</p>
          </div>
          <Button size="sm" className="bg-white text-paypal-blue hover:bg-white/90" onClick={() => navigate("/qr-pay/new")}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Revenue cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3"/>Total revenue</div>
            <div className="text-2xl font-bold mt-1">{format(stats?.total || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{stats?.count || 0} payments</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Today</div>
            <div className="text-2xl font-bold mt-1">{format(stats?.today || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">This month: {format(stats?.month || 0)}</div>
          </CardContent></Card>
        </div>

        {/* Method breakdown */}
        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-3">By method</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-xs text-muted-foreground">Pi</div><div className="font-semibold">{format(stats?.by_method?.pi || 0)}</div></div>
            <div><div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Wallet className="h-3 w-3"/>Wallet</div><div className="font-semibold">{format(stats?.by_method?.wallet || 0)}</div></div>
            <div><div className="text-xs text-muted-foreground flex items-center justify-center gap-1"><CreditCard className="h-3 w-3"/>Card</div><div className="font-semibold">{format(stats?.by_method?.virtual_card || 0)}</div></div>
          </div>
        </CardContent></Card>

        {/* Analytics */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-paypal-blue" />
                <h2 className="text-sm font-semibold">Analytics — last 30 days</h2>
              </div>
            </div>

            {analytics?.totals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Revenue</div>
                  <div className="font-semibold text-sm">{format(Number(analytics.totals.total_revenue) || 0)}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Payments</div>
                  <div className="font-semibold text-sm">{analytics.totals.total_payments}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground">Avg payment</div>
                  <div className="font-semibold text-sm">{format(Number(analytics.totals.avg_payment) || 0)}</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/>Customers</div>
                  <div className="font-semibold text-sm">{analytics.totals.unique_customers}</div>
                </div>
              </div>
            )}

            <div className="h-40 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.daily || []} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="qrRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0070ba" stopOpacity={0.5}/>
                      <stop offset="95%" stopColor="#0070ba" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    formatter={(v: any, name: string) => [name === "revenue" ? format(Number(v) || 0) : v, name === "revenue" ? "Revenue" : "Payments"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0070ba" fill="url(#qrRev)" strokeWidth={2}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {analytics?.top && analytics.top.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold mb-2 text-muted-foreground">Top performing</div>
                <div className="space-y-1">
                  {analytics.top.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between text-xs bg-muted/30 rounded-md p-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-muted-foreground">#{i+1}</span>
                        <span className="truncate font-medium">{t.title || "Untitled"}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted-foreground">{t.payments}×</span>
                        <span className="font-semibold">{t.currency} {Number(t.revenue).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Your QR payments */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Your QR payments</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/qr-pay/new")}><Plus className="h-4 w-4 mr-1"/>Create</Button>
          </div>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            payments.length === 0 ? (
              <Card><CardContent className="p-6 text-center">
                <QrCode className="h-10 w-10 mx-auto text-muted-foreground mb-2"/>
                <p className="text-sm text-muted-foreground mb-3">No QR payments yet</p>
                <Button onClick={() => navigate("/qr-pay/new")}>Create your first</Button>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <Card key={p.id}><CardContent className="p-3 flex items-center gap-2">
                    <div className="bg-muted rounded-lg p-2 shrink-0"><QrCode className="h-5 w-5"/></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{p.title || "Untitled"}</div>
                        <Badge variant={p.status === "active" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">{p.currency} {Number(p.total).toFixed(2)}</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setPreviewToken(p.token)} title="Preview"><Eye className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => copy(p.token)} title="Copy link"><Copy className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => window.open(`/qr-pay/${p.token}`, "_blank")} title="Open"><ExternalLink className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(p)} title="Delete" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                  </CardContent></Card>
                ))}
              </div>
            )
          }
        </div>

        {/* Recent transactions */}
        <div>
          <h2 className="text-sm font-semibold mb-2">Recent payments received</h2>
          {recentTx.length === 0 ? <p className="text-xs text-muted-foreground">No payments received yet.</p> : (
            <div className="space-y-2">
              {recentTx.map(t => (
                <Card key={t.id}><CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.payer_name || "Customer"}</div>
                      <div className="text-xs text-muted-foreground capitalize">{t.method.replace("_"," ")} · {t.transaction_ref}</div>
                      {t.payer_email && <div className="text-xs text-muted-foreground truncate">✉ {t.payer_email}</div>}
                      {t.payer_phone && <div className="text-xs text-muted-foreground">☎ {t.payer_phone}</div>}
                      {t.delivery_address && <div className="text-xs text-muted-foreground whitespace-pre-line mt-1">📦 {t.delivery_address}</div>}
                      {t.delivery_notes && <div className="text-xs text-muted-foreground italic">“{t.delivery_notes}”</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">{t.currency} {Number(t.amount).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{t.paid_at ? new Date(t.paid_at).toLocaleString() : ""}</div>
                    </div>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          )}
        </div>
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

      <BottomNav active="menu" />
    </div>
  );
}
