import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function McpOAuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const ran = useRef(false);
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error_description") || params.get("error");
      if (oauthError) {
        setStatus("error");
        setMessage(oauthError);
        return;
      }
      if (!code || !state) {
        setStatus("error");
        setMessage("Missing authorization code.");
        return;
      }
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Your OpenPay session expired. Sign in and try again.");
        const { data, error } = await supabase.functions.invoke("mcp-connections", {
          body: {
            action: "complete",
            code,
            state,
            redirect_uri: `${window.location.origin}/mcp/callback`,
          },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
        setStatus("done");
        setMessage(`Connected to ${(data as any)?.name ?? "the MCP server"}.`);
        const returnTo = sessionStorage.getItem("mcp_return_to") || "/ai";
        sessionStorage.removeItem("mcp_return_to");
        setTimeout(() => navigate(returnTo, { replace: true }), 1200);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message ?? "Could not complete the connection.");
      }
    })();
  }, [params, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
        {status === "working" && <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-paypal-blue" />}
        {status === "done" && <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" />}
        {status === "error" && <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />}
        <h1 className="text-lg font-semibold">MCP connection</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {status === "error" && (
          <button
            type="button"
            onClick={() => navigate("/ai", { replace: true })}
            className="mt-4 rounded-xl bg-paypal-blue px-4 py-2 text-sm font-semibold text-white"
          >
            Back to OpenPay AI
          </button>
        )}
      </div>
    </main>
  );
}
