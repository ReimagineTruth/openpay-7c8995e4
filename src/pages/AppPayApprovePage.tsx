import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ShieldCheck, Smartphone, XCircle, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import AuthMark from "@/components/AuthMark";

const db = supabase as any;

type ScanInfo = {
  id: string;
  status: string;
  link_token: string;
  expires_at: string;
};

type LinkInfo = {
  link_name: string;
  link_description?: string;
  app_payment_plans: {
    plan_name: string;
    plan_type: string;
    plan_description?: string;
    amount: number;
    currency: string;
    setup_fee: number;
    trial_days: number;
  };
  app_registry: {
    app_name: string;
    app_logo_url?: string;
  };
};

const AppPayApprovePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState<ScanInfo | null>(null);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [acting, setActing] = useState<null | "approve" | "reject">(null);
  const [finalStatus, setFinalStatus] = useState<null | "approved" | "rejected" | "failed" | "expired">(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      setAuthed(!!sess.session);

      if (!id) {
        setLoading(false);
        return;
      }

      const { data: scanRows, error } = await db.rpc("get_app_payment_scan", { p_scan_id: id });
      if (error || !scanRows || scanRows.length === 0) {
        toast.error("Scan request not found");
        setLoading(false);
        return;
      }
      const s: ScanInfo = scanRows[0];
      setScan(s);

      if (s.status !== "pending") {
        setFinalStatus(s.status as any);
      } else if (new Date(s.expires_at).getTime() < Date.now()) {
        setFinalStatus("expired");
      }

      // Load payment link details
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
        const r = await fetch(`${supabaseUrl}/functions/v1/app-payments/get-payment-link?token=${s.link_token}`, {
          headers: { Authorization: `Bearer ${supabaseAnonKey}` },
        });
        const j = await r.json();
        if (j?.success && j.data) setLink(j.data);
      } catch (e) {
        // ignore
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onApprove = async () => {
    if (!id) return;
    setActing("approve");
    try {
      const { data, error } = await db.rpc("approve_app_payment_scan", {
        p_scan_id: id,
        p_payment_method: "wallet",
      });
      if (error) {
        toast.error(error.message || "Failed to approve");
        setActing(null);
        return;
      }
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.status === "approved") {
        toast.success("Payment approved");
        setFinalStatus("approved");
      } else {
        toast.error(r?.message || "Payment failed");
        setFinalStatus((r?.status as any) || "failed");
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to approve");
    } finally {
      setActing(null);
    }
  };

  const onReject = async () => {
    if (!id) return;
    setActing("reject");
    try {
      const { data, error } = await db.rpc("reject_app_payment_scan", { p_scan_id: id });
      if (error) {
        toast.error(error.message || "Failed to reject");
        setActing(null);
        return;
      }
      const r = Array.isArray(data) ? data[0] : data;
      toast.success("Payment request rejected");
      setFinalStatus("rejected");
    } catch (e: any) {
      toast.error(e?.message || "Failed to reject");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gradient-to-b from-paypal-blue to-[#072a7a]">
        <div className="text-center">
          <AuthMark className="mx-auto mb-6 h-16 w-16" />
          <p className="text-3xl font-bold tracking-tight text-white">OpenPay</p>
          <p className="mt-1 text-sm text-white/80">Loading approval...</p>
          <div className="mx-auto mt-6 h-8 w-8 rounded-full border-2 border-white/35 border-t-white animate-spin" />
        </div>
      </div>
    );
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <ShieldCheck className="h-12 w-12 text-paypal-blue mb-3" />
        <h1 className="text-2xl font-bold text-foreground">Sign in to approve</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          You must be signed in to your OpenPay account to approve or reject this payment request.
        </p>
        <Button
          className="mt-6 h-12 rounded-full bg-paypal-blue text-white hover:bg-[#004dc5] px-8"
          onClick={() => navigate(`/auth?redirect=/app-pay-approve/${id}`)}
        >
          Sign in to OpenPay
        </Button>
      </div>
    );
  }

  if (!scan || !link) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <XCircle className="h-12 w-12 text-destructive mb-3" />
        <h1 className="text-2xl font-bold text-foreground">Request not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This scan request is invalid or has been removed.</p>
        <Button className="mt-6" variant="outline" onClick={() => navigate("/dashboard")}>Back to dashboard</Button>
      </div>
    );
  }

  const plan = link.app_payment_plans;
  const total = plan.amount + (plan.setup_fee || 0);

  const planIcon =
    plan.plan_type === "one_time" ? <DollarSign className="h-5 w-5" /> :
    plan.plan_type === "recurring_monthly" || plan.plan_type === "recurring_yearly" ? <Calendar className="h-5 w-5" /> :
    <Smartphone className="h-5 w-5" />;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-14 items-center border-b border-border bg-card px-4">
        <button onClick={() => navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="mx-3 h-7 w-px bg-border" />
        <p className="flex items-center gap-2 text-xl font-medium text-foreground">
          <Smartphone className="h-5 w-5" /> Approve Payment
        </p>
      </div>

      <div className="mx-auto w-full max-w-md px-4 py-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            {link.app_registry.app_logo_url ? (
              <img src={link.app_registry.app_logo_url} alt={link.app_registry.app_name} className="h-12 w-12 rounded-xl border border-border object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-paypal-blue/10 flex items-center justify-center">
                <Smartphone className="h-6 w-6 text-paypal-blue" />
              </div>
            )}
            <div>
              <p className="text-base font-semibold text-foreground">{link.app_registry.app_name}</p>
              <p className="text-xs text-muted-foreground">is requesting a payment</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-foreground">
              {planIcon}
              <p className="font-semibold">{plan.plan_name}</p>
            </div>
            {plan.plan_description && (
              <p className="mt-1 text-sm text-muted-foreground">{plan.plan_description}</p>
            )}
            {plan.trial_days > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {plan.trial_days} days free trial
              </p>
            )}
          </div>

          <div className="mt-5 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
            <p className="text-4xl font-bold text-foreground">{plan.currency} {total.toFixed(2)}</p>
            {plan.setup_fee > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Includes {plan.currency} {plan.setup_fee.toFixed(2)} setup fee</p>
            )}
          </div>

          {finalStatus ? (
            <div className="mt-6 rounded-xl border border-border bg-muted/30 p-5 text-center">
              {finalStatus === "approved" && (
                <>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <p className="mt-2 text-base font-semibold text-foreground">Payment approved</p>
                  <p className="mt-1 text-sm text-muted-foreground">The merchant has been notified. You can close this page.</p>
                </>
              )}
              {finalStatus === "rejected" && (
                <>
                  <XCircle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="mt-2 text-base font-semibold text-foreground">Request rejected</p>
                  <p className="mt-1 text-sm text-muted-foreground">No payment was made.</p>
                </>
              )}
              {finalStatus === "failed" && (
                <>
                  <XCircle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="mt-2 text-base font-semibold text-foreground">Payment failed</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please try again.</p>
                </>
              )}
              {finalStatus === "expired" && (
                <>
                  <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-2 text-base font-semibold text-foreground">Request expired</p>
                  <p className="mt-1 text-sm text-muted-foreground">Please scan a fresh QR from the merchant.</p>
                </>
              )}
              <Button className="mt-4" variant="outline" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              <Button
                onClick={onApprove}
                disabled={acting !== null}
                className="h-12 w-full rounded-full bg-paypal-blue text-white hover:bg-[#004dc5]"
              >
                {acting === "approve" ? "Approving..." : `Approve & pay ${plan.currency} ${total.toFixed(2)}`}
              </Button>
              <Button
                onClick={onReject}
                disabled={acting !== null}
                variant="outline"
                className="h-12 w-full rounded-full"
              >
                {acting === "reject" ? "Rejecting..." : "Reject"}
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground inline-flex items-center justify-center gap-1 w-full">
                <ShieldCheck className="h-3.5 w-3.5" /> Approved with your signed-in OpenPay account
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppPayApprovePage;
