import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type PiverifyRow = {
  session_id: string;
  status: string;
  hosted_flow_url: string | null;
  rejection_reason: string | null;
  allowed_action: string | null;
  updated_at: string;
};

const statusStyle: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  pending_review: "bg-blue-50 text-blue-700 ring-blue-200",
  started: "bg-blue-50 text-blue-700 ring-blue-200",
  created: "bg-muted text-muted-foreground ring-border",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

const PiVerifyKycPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [latest, setLatest] = useState<PiverifyRow | null>(null);

  const loadLatest = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/signin"); return; }
    const { data } = await (supabase as any)
      .from("piverify_sessions")
      .select("session_id,status,hosted_flow_url,rejection_reason,allowed_action,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest(data || null);
    setLoading(false);
  };

  useEffect(() => { loadLatest(); }, []);

  const startVerification = async () => {
    setStarting(true);
    try {
      const { data, error } = await supabase.functions.invoke("piverify-create-session", { body: {} });
      if (error) throw error;
      if (!data?.hosted_flow_url) throw new Error("No hosted flow URL returned");
      window.location.href = data.hosted_flow_url;
    } catch (e: any) {
      toast.error(e?.message || "Could not start PiVerify session");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 pt-4 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="paypal-surface flex h-10 w-10 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-paypal-dark">PiVerify KYC</h1>
      </div>

      <div className="paypal-surface rounded-3xl p-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paypal-light-blue/20">
            <ShieldCheck className="h-5 w-5 text-paypal-blue" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground">Verify with PiVerify</p>
            <p className="text-sm text-muted-foreground">
              Complete a quick ID + selfie check powered by PiVerify. Standalone from your other KYC options.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        ) : latest ? (
          <div className="mb-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Latest session</p>
                <p className="text-xs font-mono text-foreground/70 break-all">{latest.session_id}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ${statusStyle[latest.status] || statusStyle.created}`}>
                {latest.status}
              </span>
            </div>
            {latest.rejection_reason && (
              <p className="mt-2 text-sm text-red-700">Reason: {latest.rejection_reason}</p>
            )}
            {latest.hosted_flow_url && (latest.status === "created" || latest.status === "started" || latest.allowed_action) && (
              <a
                href={latest.hosted_flow_url}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-paypal-blue"
              >
                Resume verification <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ) : null}

        <Button
          onClick={startVerification}
          disabled={starting}
          className="h-12 w-full rounded-2xl bg-paypal-blue text-white hover:bg-[#004dc5]"
        >
          {starting ? "Starting…" : latest?.status === "approved" ? "Re-verify with PiVerify" : "Start PiVerify KYC"}
        </Button>

        <p className="mt-3 text-xs text-muted-foreground">
          You will be redirected to PiVerify's hosted flow to upload ID and take a selfie. Results return automatically.
        </p>
      </div>
    </div>
  );
};

export default PiVerifyKycPage;
