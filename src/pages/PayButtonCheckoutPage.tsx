import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";


type Charge = {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  status: "created" | "paid" | "canceled" | "expired";
  expires_at: string;
  success_url: string | null;
  cancel_url: string | null;
  partner_app_id: string;
  partner_app_name: string;
  partner_app_website: string | null;
  owner_user_id: string;
  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
};

export default function PayButtonCheckoutPage() {
  const { chargeId } = useParams<{ chargeId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [done, setDone] = useState<null | "paid" | "canceled">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);


  async function loadAll() {
    if (!chargeId) return;
    setLoading(true);
    const { data: sess } = await supabase.auth.getSession();
    const isAuthed = !!sess.session?.user;
    setAuthed(isAuthed);

    const { data, error } = await supabase.rpc("partner_charge_get_public", { p_charge_id: chargeId });
    if (error) toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    setCharge((row as Charge) || null);

    if (isAuthed) {
      const { data: w } = await supabase.from("wallets").select("balance").eq("user_id", sess.session!.user.id).maybeSingle();
      setBalance(Number(w?.balance ?? 0));
    }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, [chargeId]);

  async function signIn() {
    // Preserve return path
    sessionStorage.setItem("postAuthRedirect", `/paybutton/${chargeId}`);
    navigate("/auth");
  }

  async function pay() {
    // Idempotency guard: block double submits / already-settled charges
    if (!chargeId || paying || done === "paid" || charge?.status !== "created") return;
    setPaying(true);
    setConfirmOpen(false);
    const { data, error } = await supabase.rpc("partner_charge_approve", { p_charge_id: chargeId });
    if (error) {
      setPaying(false);
      // If the charge was already settled, reflect that instead of retrying
      if (/cannot be paid|paid/i.test(error.message)) {
        setDone("paid");
        await loadAll();
        return toast.info("This charge was already paid — no new charge was made.");
      }
      return toast.error(error.message);
    }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success("Payment successful");
    setDone("paid");
    if (typeof (row as any)?.buyer_balance === "number") setBalance(Number((row as any).buyer_balance));
    setPaying(false);
    const successUrl = (row as any)?.success_url || charge?.success_url;
    if (successUrl) setTimeout(() => { window.location.href = successUrl; }, 1400);
  }


  async function cancel() {
    if (!chargeId) return;
    const { error } = await supabase.rpc("partner_charge_cancel", { p_charge_id: chargeId });
    if (error) return toast.error(error.message);
    setDone("canceled");
    if (charge?.cancel_url) setTimeout(() => { window.location.href = charge.cancel_url!; }, 1000);
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!charge) {
    return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Charge not found.</div>;
  }

  const insufficient = authed && balance !== null && balance < Number(charge.amount);
  const status = done ?? charge.status;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-background dark:from-blue-950/20">
      <header className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => (charge.cancel_url ? (window.location.href = charge.cancel_url) : navigate(-1))}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <ShieldCheck className="h-4 w-4" /> Secure OpenPay Checkout
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-10">
        <Card className="overflow-hidden border-blue-100 dark:border-blue-900/40 shadow-xl">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6">
            <p className="text-xs uppercase tracking-wide opacity-80">Pay to</p>
            <p className="text-lg font-bold">{charge.partner_app_name}</p>
            {charge.owner_username && <p className="text-xs opacity-80">@{charge.owner_username}</p>}
            <div className="mt-6">
              <p className="text-xs uppercase tracking-wide opacity-80">Amount</p>
              <p className="text-4xl font-black">{Number(charge.amount).toFixed(2)} <span className="text-lg font-semibold">{charge.currency}</span></p>
            </div>
            {charge.description && <p className="text-sm mt-3 opacity-90">{charge.description}</p>}
          </div>

          <CardContent className="p-6 space-y-4">
            {status === "paid" && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-600" />
                <p className="font-semibold">Payment complete</p>
                {charge.success_url && <p className="text-xs text-muted-foreground">Redirecting you back to {charge.partner_app_name}…</p>}
              </div>
            )}
            {(status === "canceled" || status === "expired") && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <XCircle className="h-14 w-14 text-red-600" />
                <p className="font-semibold capitalize">{status}</p>
              </div>
            )}

            {status === "created" && !authed && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Sign in to OpenPay to pay <span className="font-semibold text-foreground">{charge.partner_app_name}</span> from your OpenPay balance.
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={signIn}>
                  Sign in to OpenPay
                </Button>
              </>
            )}

            {status === "created" && authed && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your OpenPay balance</span>
                  <span className="font-semibold">{(balance ?? 0).toFixed(2)} OUSD</span>
                </div>
                {insufficient ? (
                  <>
                    <p className="text-xs text-red-600">Insufficient balance. Top up to complete this payment.</p>
                    <Button className="w-full" onClick={() => navigate("/top-up")}>Top up OpenPay</Button>
                  </>
                ) : (
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={paying} onClick={pay}>
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay ${Number(charge.amount).toFixed(2)} ${charge.currency}`}
                  </Button>
                )}
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={cancel}>Cancel</Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground mt-4">
          Powered by OpenPay · Charges expire {new Date(charge.expires_at).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
