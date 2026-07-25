import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, ArrowLeft, CheckCircle2, XCircle, User, Wallet } from "lucide-react";
import { toast } from "sonner";

type Client = {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  redirect_uris: string[];
  is_active: boolean;
  owner_full_name: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
};

const SCOPE_LABELS: Record<string, { icon: any; label: string; desc: string }> = {
  profile: { icon: User, label: "Your OpenPay profile", desc: "Name, username, avatar and account number" },
  balance: { icon: Wallet, label: "Your OpenPay balance", desc: "Read your current OUSD balance" },
};

export default function PartnerConnectPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const scope = params.get("scope") || "profile balance";
  const state = params.get("state") || "";

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [client, setClient] = useState<Client | null>(null);
  const [approving, setApproving] = useState(false);
  const [done, setDone] = useState<null | "approved" | "denied">(null);

  const requestedScopes = useMemo(() => scope.split(/\s+/).filter(Boolean), [scope]);
  const redirectAllowed = !!client && client.redirect_uris.includes(redirectUri);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      setAuthed(!!sess.session?.user);
      if (clientId) {
        const { data, error } = await supabase.rpc("partner_oauth_get_client", { p_app_id: clientId });
        if (error) toast.error(error.message);
        const row = Array.isArray(data) ? data[0] : data;
        setClient((row as Client) || null);
      }
      setLoading(false);
    })();
  }, [clientId]);

  function backToClient(extra: Record<string, string>) {
    const u = new URL(redirectUri);
    Object.entries(extra).forEach(([k, v]) => u.searchParams.set(k, v));
    if (state) u.searchParams.set("state", state);
    window.location.href = u.toString();
  }

  async function approve() {
    if (!client) return;
    setApproving(true);
    const { data, error } = await supabase.rpc("partner_oauth_approve", {
      p_app_id: client.id, p_redirect_uri: redirectUri, p_scope: scope,
    });
    setApproving(false);
    if (error) return toast.error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    setDone("approved");
    setTimeout(() => backToClient({ code: (row as any).code }), 800);
  }

  function deny() {
    setDone("denied");
    if (redirectAllowed) {
      setTimeout(() => backToClient({ error: "access_denied" }), 500);
    }
  }

  function signIn() {
    sessionStorage.setItem("postAuthRedirect", `/connect?${params.toString()}`);
    navigate("/auth");
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!clientId || !redirectUri) {
    return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Missing client_id or redirect_uri.</div>;
  }
  if (!client || !client.is_active) {
    return <div className="min-h-screen grid place-items-center bg-background text-sm text-muted-foreground">Unknown or inactive partner app.</div>;
  }
  if (!redirectAllowed) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6 text-center">
        <div>
          <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
          <p className="font-semibold">redirect_uri not registered</p>
          <p className="text-xs text-muted-foreground mt-1 break-all">{redirectUri}</p>
          <p className="text-xs text-muted-foreground mt-2">Ask the app owner to add this exact URL to their OpenPay partner app.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-background dark:from-blue-950/20">
      <header className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={deny}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
          <ShieldCheck className="h-4 w-4" /> Connect with OpenPay
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-10">
        <Card className="overflow-hidden border-blue-100 dark:border-blue-900/40 shadow-xl">
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 text-center">
            <p className="text-xs uppercase tracking-wide opacity-80">Authorize</p>
            <p className="text-xl font-bold mt-1">{client.name}</p>
            {client.website && <p className="text-xs opacity-80 mt-1 truncate">{client.website}</p>}
            <p className="text-sm opacity-90 mt-4">
              wants to connect to your OpenPay account
            </p>
          </div>

          <CardContent className="p-6 space-y-4">
            {done === "approved" && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CheckCircle2 className="h-14 w-14 text-green-600" />
                <p className="font-semibold">Connected</p>
                <p className="text-xs text-muted-foreground">Sending you back to {client.name}…</p>
              </div>
            )}
            {done === "denied" && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <XCircle className="h-14 w-14 text-red-600" />
                <p className="font-semibold">Cancelled</p>
              </div>
            )}

            {!done && !authed && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Sign in to your OpenPay account to review what <span className="font-semibold text-foreground">{client.name}</span> is requesting.
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={signIn}>
                  Sign in to OpenPay
                </Button>
              </>
            )}

            {!done && authed && (
              <>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">This app will access</p>
                <ul className="space-y-2">
                  {requestedScopes.map((s) => {
                    const meta = SCOPE_LABELS[s] || { icon: ShieldCheck, label: s, desc: "Additional permission" };
                    const Icon = meta.icon;
                    return (
                      <li key={s} className="flex items-start gap-3 rounded-lg border p-3">
                        <Icon className="h-4 w-4 mt-0.5 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">{meta.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-muted-foreground">
                  {client.name} will not see your password. You can revoke access anytime from your OpenPay settings.
                  Redirects to <span className="font-mono break-all">{redirectUri}</span>.
                </p>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={approving} onClick={approve}>
                  {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : `Allow ${client.name}`}
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={deny}>Cancel</Button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-[10px] text-center text-muted-foreground mt-4">
          Powered by OpenPay · Secure OAuth 2.0 Authorization Code flow
        </p>
      </main>
    </div>
  );
}
