import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Users, DollarSign, Timer, TrendingUp, Plus, ExternalLink, CheckCircle2, XCircle, Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface ReferralRewardRow {
  referred_user_id: string;
  reward_amount: number;
  status: "pending" | "claimed";
  created_at: string;
  claimed_at: string | null;
}

interface AffiliateTask {
  id: string;
  title: string;
  description: string;
  task_type: string;
  reward_amount: number;
  proof_required: boolean;
  recurrence: "once" | "daily";
  active: boolean;
}

interface SubmissionRow {
  id: string;
  task_id: string;
  status: "pending" | "approved" | "rejected";
  reward_amount: number;
  proof_url: string | null;
  created_at: string;
  review_note: string | null;
}

interface SocialRow {
  id: string;
  platform: string;
  handle: string;
  url: string | null;
}

const PLATFORMS = ["x", "instagram", "tiktok", "youtube", "facebook", "telegram", "threads", "linkedin", "reddit", "other"];

const AffiliatePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [rewards, setRewards] = useState<ReferralRewardRow[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [activeMiners, setActiveMiners] = useState(0);
  const [bonusEarned, setBonusEarned] = useState(0);
  const [tasks, setTasks] = useState<AffiliateTask[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [socials, setSocials] = useState<SocialRow[]>([]);
  const [newPlatform, setNewPlatform] = useState("x");
  const [newHandle, setNewHandle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [submitTask, setSubmitTask] = useState<AffiliateTask | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [proofNotes, setProofNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pendingAmount = useMemo(
    () => rewards.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.reward_amount, 0),
    [rewards],
  );
  const pendingCount = useMemo(() => rewards.filter((r) => r.status === "pending").length, [rewards]);
  const totalClaimed = useMemo(
    () => rewards.filter((r) => r.status === "claimed").reduce((sum, r) => sum + r.reward_amount, 0),
    [rewards],
  );
  const taskEarnings = useMemo(
    () => submissions.filter((s) => s.status === "approved").reduce((sum, s) => sum + Number(s.reward_amount || 0), 0),
    [submissions],
  );

  const inviteLink = referralCode ? `${window.location.origin}/auth?ref=${encodeURIComponent(referralCode)}` : "";

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const [profileRes, rewardsRes, miningBonusRes, tasksRes, subsRes, socialsRes] = await Promise.all([
        supabase.from("profiles").select("referral_code").eq("id", user.id).single(),
        supabase.from("referral_rewards").select("referred_user_id, reward_amount, status, created_at, claimed_at").eq("referrer_user_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("mining_rewards").select("amount").eq("user_id", user.id).eq("reward_type", "referral_bonus"),
        (supabase as any).from("affiliate_tasks").select("*").eq("active", true).order("reward_amount", { ascending: false }),
        (supabase as any).from("affiliate_task_submissions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        (supabase as any).from("affiliate_socials").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      setReferralCode(profileRes.data?.referral_code || "");
      const referralRows = (rewardsRes.data || []) as ReferralRewardRow[];
      setRewards(referralRows);
      setBonusEarned(miningBonusRes.data?.reduce((s: number, r: any) => s + Number(r.amount), 0) || 0);
      setTasks((tasksRes.data || []) as AffiliateTask[]);
      setSubmissions((subsRes.data || []) as SubmissionRow[]);
      setSocials((socialsRes.data || []) as SocialRow[]);

      const invitedIds = Array.from(new Set(referralRows.map((row) => row.referred_user_id)));
      if (invitedIds.length > 0) {
        const [{ data: invitedProfiles }, { data: miningSessions }] = await Promise.all([
          supabase.from("profiles").select("id, full_name, username").in("id", invitedIds),
          (supabase as any).from("mining_sessions").select("user_id").in("user_id", invitedIds).eq("is_active", true).gt("expires_at", new Date().toISOString()),
        ]);
        const nameMap: Record<string, string> = {};
        (invitedProfiles || []).forEach((p) => { nameMap[p.id] = p.full_name?.trim() || p.username?.trim() || "User"; });
        setUserNames(nameMap);
        setActiveMiners(new Set(miningSessions?.map((s: any) => s.user_id) || []).size);
      }
    } catch (e) {
      console.error(e); toast.error("Failed to load affiliate data");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCopy = async () => {
    if (!inviteLink) return;
    try { await navigator.clipboard.writeText(inviteLink); toast.success("Invite link copied"); }
    catch { toast.error("Failed to copy"); }
  };

  const handleClaim = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_referral_rewards");
    setClaiming(false);
    if (error) return toast.error(error.message);
    const r = data as any;
    if (r?.claimed) toast.success(`Claimed $${r.amount || 0} from ${r.count || 0} invite(s)`);
    else toast.message("No pending rewards");
    await loadData();
  };

  const handleAddSocial = async () => {
    if (!newHandle.trim()) return toast.error("Enter a handle");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await (supabase as any).from("affiliate_socials").insert({
      user_id: user.id, platform: newPlatform, handle: newHandle.trim(), url: newUrl.trim() || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Social linked");
    setNewHandle(""); setNewUrl("");
    await loadData();
  };

  const handleRemoveSocial = async (id: string) => {
    const { error } = await (supabase as any).from("affiliate_socials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await loadData();
  };

  const handleSubmitTask = async () => {
    if (!submitTask) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("submit_affiliate_task" as any, {
      p_task_id: submitTask.id, p_proof_url: proofUrl, p_notes: proofNotes || null,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Submitted for review");
    setSubmitTask(null); setProofUrl(""); setProofNotes("");
    await loadData();
  };

  const submissionsByTask = useMemo(() => {
    const map: Record<string, SubmissionRow[]> = {};
    submissions.forEach((s) => { (map[s.task_id] ||= []).push(s); });
    return map;
  }, [submissions]);

  return (
    <div className="min-h-screen bg-paypal-blue px-4 pt-4 pb-24 text-white">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate("/menu")} className="bg-white flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-paypal-blue" />
        </button>
        <h1 className="text-xl font-bold text-white">Affiliate</h1>
      </div>

      <Tabs defaultValue="invite" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/20 p-1 rounded-2xl h-auto gap-1">
          <TabsTrigger value="invite" className="rounded-xl text-white/90 font-semibold data-[state=active]:bg-white data-[state=active]:text-paypal-blue data-[state=active]:shadow-md">Invite</TabsTrigger>
          <TabsTrigger value="tasks" className="rounded-xl text-white/90 font-semibold data-[state=active]:bg-white data-[state=active]:text-paypal-blue data-[state=active]:shadow-md">Tasks</TabsTrigger>
          <TabsTrigger value="socials" className="rounded-xl text-white/90 font-semibold data-[state=active]:bg-white data-[state=active]:text-paypal-blue data-[state=active]:shadow-md">Socials</TabsTrigger>
        </TabsList>

        <TabsContent value="invite" className="grid gap-3 mt-3">
          <div className="paypal-surface rounded-3xl p-5">
            <p className="text-sm text-muted-foreground">Your referral code</p>
            <p className="mt-1 text-2xl font-bold text-paypal-dark">{loading ? "..." : referralCode || "-"}</p>
            <p className="mt-2 text-xs text-muted-foreground">Earn $1 on signup + mining bonuses when your referrals are active.</p>
            <div className="mt-4 rounded-2xl border border-border/70 bg-white px-3 py-2 text-xs text-muted-foreground break-all">
              {inviteLink || "Invite link will appear after your code is ready."}
            </div>
            <Button onClick={handleCopy} disabled={!inviteLink} className="mt-3 h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
              <Copy className="mr-2 h-4 w-4" /> Copy Invite Link
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="paypal-surface rounded-2xl p-4 text-center">
              <Users className="mx-auto h-5 w-5 text-paypal-blue" />
              <p className="mt-2 text-lg font-bold text-foreground">{rewards.length}</p>
              <p className="text-xs text-muted-foreground">Total Invites</p>
            </div>
            <div className="paypal-surface rounded-2xl p-4 text-center">
              <Timer className="mx-auto h-5 w-5" />
              <p className="mt-2 text-lg font-bold text-foreground">{activeMiners}</p>
              <p className="text-xs text-muted-foreground">Active Miners</p>
            </div>
            <div className="paypal-surface rounded-2xl p-4 text-center">
              <DollarSign className="mx-auto h-5 w-5 text-paypal-blue" />
              <p className="mt-2 text-lg font-bold text-foreground">${totalClaimed.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Claimed</p>
            </div>
            <div className="paypal-surface rounded-2xl p-4 text-center">
              <TrendingUp className="mx-auto h-5 w-5 text-paypal-blue" />
              <p className="mt-2 text-lg font-bold text-foreground">{(bonusEarned + taskEarnings).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Bonus + Tasks</p>
            </div>
          </div>

          <div className="paypal-surface rounded-3xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-foreground">Pending signup rewards</p>
              <p className="text-sm font-semibold text-paypal-blue">${pendingAmount.toFixed(2)}</p>
            </div>
            <Button onClick={handleClaim} disabled={claiming || pendingCount === 0}
              className="h-11 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]">
              {claiming ? "Claiming..." : `Claim $${pendingAmount.toFixed(2)}`}
            </Button>
          </div>

          <div className="paypal-surface rounded-3xl p-5">
            <p className="mb-3 font-semibold text-foreground">Invite history</p>
            {loading ? <p className="text-sm text-muted-foreground">Loading...</p>
              : rewards.length === 0 ? <p className="text-sm text-muted-foreground">No invites yet.</p>
              : <div className="divide-y divide-border/70">
                {rewards.map((row) => (
                  <div key={`${row.referred_user_id}-${row.created_at}`} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{userNames[row.referred_user_id] || row.referred_user_id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{row.status === "claimed" ? "Claimed" : "Pending"}</p>
                    </div>
                    <p className={`text-sm font-semibold ${row.status === "claimed" ? "text-paypal-success" : "text-paypal-blue"}`}>
                      ${Number(row.reward_amount || 0).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>}
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="grid gap-3 mt-3">
          <div className="rounded-3xl border border-white/20 bg-white/10 p-4 text-sm text-white/90">
            Promote OpenPay daily to earn extra rewards. Tag <b>@OpenPay</b> on your posts and submit the public URL as proof. Admin approves payouts.
          </div>
          {loading ? <p className="text-sm text-white/80">Loading...</p> : tasks.map((t) => {
            const subs = submissionsByTask[t.id] || [];
            const latest = subs[0];
            const todayDone = t.recurrence === "daily" && subs.some(s => new Date(s.created_at).toDateString() === new Date().toDateString());
            const onceDone = t.recurrence === "once" && subs.some(s => s.status !== "rejected");
            const disabled = todayDone || onceDone;
            return (
              <div key={t.id} className="paypal-surface rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{t.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      <span className="rounded-full bg-paypal-blue/10 px-2 py-0.5 text-[10px] font-semibold text-paypal-blue uppercase">{t.task_type}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">{t.recurrence}</span>
                      <span className="rounded-full bg-paypal-success/10 px-2 py-0.5 text-[10px] font-semibold text-paypal-success">+${Number(t.reward_amount).toFixed(2)}</span>
                    </div>
                    {latest && (
                      <div className="mt-2 flex items-center gap-1 text-[11px]">
                        {latest.status === "approved" && <><CheckCircle2 className="h-3 w-3 text-paypal-success" /><span className="text-paypal-success">Approved</span></>}
                        {latest.status === "rejected" && <><XCircle className="h-3 w-3 text-destructive" /><span className="text-destructive">Rejected{latest.review_note ? ` — ${latest.review_note}` : ""}</span></>}
                        {latest.status === "pending" && <><Clock className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Pending review</span></>}
                      </div>
                    )}
                  </div>
                  <Button size="sm" disabled={disabled} onClick={() => { setSubmitTask(t); setProofUrl(""); setProofNotes(""); }}
                    className="rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5]">
                    {disabled ? "Done" : "Submit"}
                  </Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="socials" className="grid gap-3 mt-3">
          <div className="paypal-surface rounded-3xl p-5">
            <p className="font-semibold text-foreground">Link your socials</p>
            <p className="mt-1 text-xs text-muted-foreground">Connect your accounts so we know where you'll promote OpenPay.</p>
            <div className="mt-3 grid gap-2">
              <Select value={newPlatform} onValueChange={setNewPlatform}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
              <Input className="h-11 rounded-xl" placeholder="@handle" value={newHandle} onChange={(e) => setNewHandle(e.target.value)} />
              <Input className="h-11 rounded-xl" placeholder="Profile URL (optional)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <Button onClick={handleAddSocial} className="h-11 rounded-xl bg-paypal-blue text-white hover:bg-[#004dc5]">
                <Plus className="mr-2 h-4 w-4" /> Add social
              </Button>
            </div>
          </div>
          <div className="paypal-surface rounded-3xl p-5">
            <p className="mb-3 font-semibold text-foreground">Linked accounts</p>
            {socials.length === 0 ? <p className="text-sm text-muted-foreground">No socials linked yet.</p> : (
              <div className="divide-y divide-border/70">
                {socials.map(s => (
                  <div key={s.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground uppercase">{s.platform}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.handle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="text-paypal-blue"><ExternalLink className="h-4 w-4" /></a>}
                      <button onClick={() => handleRemoveSocial(s.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!submitTask} onOpenChange={(o) => !o && setSubmitTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{submitTask?.title}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{submitTask?.description}</p>
          <div className="grid gap-2 mt-2">
            <Input placeholder="Proof URL (post link)" value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} />
            <Textarea placeholder="Notes (optional)" value={proofNotes} onChange={(e) => setProofNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitTask(null)}>Cancel</Button>
            <Button onClick={handleSubmitTask} disabled={submitting} className="bg-paypal-blue text-white hover:bg-[#004dc5]">
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav active="menu" />
    </div>
  );
};

export default AffiliatePage;
