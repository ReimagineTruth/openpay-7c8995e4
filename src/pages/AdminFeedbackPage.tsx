import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ArrowLeft, RefreshCw, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_USERNAMES = new Set(["openpay", "wainfoundation"]);
const STATUSES = ["new", "reviewed", "in_progress", "resolved", "dismissed"] as const;

type Row = {
  id: string;
  user_id: string | null;
  category: string;
  rating: number;
  feature: string | null;
  message: string;
  contact_email: string | null;
  status: string;
  admin_note: string;
  created_at: string;
  profile?: { full_name: string | null; username: string | null } | null;
};

const AdminFeedbackPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        navigate("/sign-in?mode=signin", { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", auth.user.id)
        .maybeSingle();
      const uname = (profile?.username || "").trim().toLowerCase().replace(/^@+/, "");
      if (!ADMIN_USERNAMES.has(uname)) {
        toast.error("Admin only");
        navigate("/dashboard", { replace: true });
        return;
      }

      let q = supabase
        .from("openpay_feedback" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      const list = ((data as unknown as Row[]) || []);

      // Fetch profiles in one shot
      const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
      let profileMap: Record<string, { full_name: string | null; username: string | null }> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, username")
          .in("id", ids);
        (profs || []).forEach((p: any) => {
          profileMap[p.id] = { full_name: p.full_name, username: p.username };
        });
      }
      setRows(list.map((r) => ({ ...r, profile: r.user_id ? profileMap[r.user_id] : null })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const updateRow = async (row: Row, patch: { status?: string; admin_note?: string }) => {
    setSavingId(row.id);
    try {
      const { error } = await supabase
        .from("openpay_feedback" as any)
        .update({
          ...patch,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingId(null);
    }
  };

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    rows.forEach((r) => { acc[r.status] = (acc[r.status] || 0) + 1; });
    return acc;
  }, [rows]);

  return (
    <div className="min-h-screen bg-background px-4 py-4 pb-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/admin-dashboard")} aria-label="Back">
              <ArrowLeft className="h-6 w-6 text-foreground" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-paypal-dark">Feedback Review</h1>
              <p className="text-xs text-muted-foreground">User feedback about OpenPay features</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {rows.length} shown • new {counts.new || 0} • in_progress {counts.in_progress || 0} • resolved {counts.resolved || 0}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No feedback for this filter.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const noteValue = notes[r.id] ?? r.admin_note;
              const who = r.profile?.full_name || (r.profile?.username ? `@${r.profile.username}` : (r.user_id || "unknown").slice(0, 8));
              return (
                <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{who}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(r.created_at), "MMM d, yyyy h:mm a")} • {r.category.replace(/_/g, " ")}
                        {r.feature ? ` • ${r.feature}` : ""}
                      </p>
                      {r.contact_email && (
                        <p className="text-xs text-muted-foreground">Contact: {r.contact_email}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>

                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{r.message}</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-start">
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateRow(r, { status: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Textarea
                      value={noteValue}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Admin note (visible to user)"
                      rows={2}
                    />
                    <Button
                      onClick={() => updateRow(r, { admin_note: noteValue })}
                      disabled={savingId === r.id}
                    >
                      Save note
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeedbackPage;
