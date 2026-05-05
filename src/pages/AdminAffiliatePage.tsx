import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface SubmissionRow {
  id: string;
  user_id: string;
  task_id: string;
  status: "pending" | "approved" | "rejected";
  reward_amount: number;
  proof_url: string | null;
  notes: string | null;
  created_at: string;
  review_note: string | null;
}

const AdminAffiliatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [subs, setSubs] = useState<SubmissionRow[]>([]);
  const [tasks, setTasks] = useState<Record<string, { title: string; task_type: string }>>({});
  const [users, setUsers] = useState<Record<string, { full_name: string | null; username: string | null }>>({});
  const [socials, setSocials] = useState<any[]>([]);
  const [referralStats, setReferralStats] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: isAdmin } = await supabase.rpc("is_openpay_core_admin" as any);
    if (!isAdmin) { setAllowed(false); setLoading(false); return; }
    setAllowed(true);

    const [subsRes, tasksRes, socialsRes, refRes] = await Promise.all([
      (supabase as any).from("affiliate_task_submissions").select("*").order("created_at", { ascending: false }).limit(500),
      (supabase as any).from("affiliate_tasks").select("id, title, task_type"),
      (supabase as any).from("affiliate_socials").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("referral_rewards").select("referrer_user_id, status, reward_amount").limit(2000),
    ]);

    const taskMap: Record<string, any> = {};
    (tasksRes.data || []).forEach((t: any) => { taskMap[t.id] = t; });
    setTasks(taskMap);

    const subRows = (subsRes.data || []) as SubmissionRow[];
    setSubs(subRows);
    setSocials(socialsRes.data || []);

    const userIds = Array.from(new Set([
      ...subRows.map(s => s.user_id),
      ...(socialsRes.data || []).map((s: any) => s.user_id),
      ...(refRes.data || []).map((r: any) => r.referrer_user_id),
    ]));
    if (userIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, username").in("id", userIds);
      const um: Record<string, any> = {};
      (profiles || []).forEach((p) => { um[p.id] = { full_name: p.full_name, username: p.username }; });
      setUsers(um);
    }

    // referral stats
    const stats: Record<string, { count: number; pending: number; claimed: number }> = {};
    (refRes.data || []).forEach((r: any) => {
      const k = r.referrer_user_id;
      if (!stats[k]) stats[k] = { count: 0, pending: 0, claimed: 0 };
      stats[k].count++;
      if (r.status === "pending") stats[k].pending += Number(r.reward_amount);
      else stats[k].claimed += Number(r.reward_amount);
    });
    setReferralStats(Object.entries(stats).map(([uid, v]) => ({ user_id: uid, ...v })).sort((a, b) => b.count - a.count));

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const review = async (id: string, approve: boolean) => {
    const note = approve ? null : prompt("Reason for rejection?") || "Rejected";
    const { error } = await supabase.rpc("review_affiliate_submission" as any, {
      p_submission_id: id, p_approve: approve, p_note: note,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Approved & paid" : "Rejected");
    await load();
  };

  const userLabel = (uid: string) => {
    const u = users[uid];
    return u?.full_name || u?.username || uid.slice(0, 8);
  };

  const pending = useMemo(() => subs.filter(s => s.status === "pending"), [subs]);
  const reviewed = useMemo(() => subs.filter(s => s.status !== "pending"), [subs]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (!allowed) return <div className="p-6 text-destructive">Forbidden — admin only.</div>;

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-24">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft className="h-6 w-6" /></button>
        <h1 className="text-lg font-semibold">Affiliate Admin</h1>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="referrers">Referrers</TabsTrigger>
          <TabsTrigger value="socials">Socials</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-3">
          {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending submissions.</p>}
          {pending.map((s) => (
            <div key={s.id} className="rounded-2xl border bg-white p-4">
              <div className="flex justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{tasks[s.task_id]?.title || "Task"} <span className="text-xs text-muted-foreground">· ${Number(s.reward_amount).toFixed(2)}</span></p>
                  <p className="text-xs text-muted-foreground">By {userLabel(s.user_id)} · {new Date(s.created_at).toLocaleString()}</p>
                  {s.proof_url && <a href={s.proof_url} target="_blank" rel="noreferrer" className="text-xs text-paypal-blue inline-flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" />{s.proof_url}</a>}
                  {s.notes && <p className="text-xs mt-1">{s.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => review(s.id, true)} className="bg-paypal-success text-white"><CheckCircle2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => review(s.id, false)}><XCircle className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="history" className="space-y-2 mt-3">
          {reviewed.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-3 text-sm">
              <div className="flex justify-between">
                <span>{tasks[s.task_id]?.title} — {userLabel(s.user_id)}</span>
                <span className={s.status === "approved" ? "text-paypal-success" : "text-destructive"}>{s.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">${Number(s.reward_amount).toFixed(2)} · {new Date(s.created_at).toLocaleDateString()}{s.review_note ? ` · ${s.review_note}` : ""}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="referrers" className="space-y-2 mt-3">
          {referralStats.map((r) => (
            <div key={r.user_id} className="rounded-xl border bg-white p-3 flex justify-between text-sm">
              <span>{userLabel(r.user_id)}</span>
              <span>{r.count} invites · ${r.claimed.toFixed(2)} claimed · ${r.pending.toFixed(2)} pending</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="socials" className="space-y-2 mt-3">
          {socials.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-3 flex justify-between text-sm">
              <span>{userLabel(s.user_id)} · <b className="uppercase">{s.platform}</b> {s.handle}</span>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-paypal-blue"><ExternalLink className="h-4 w-4" /></a>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAffiliatePage;
