import { useCallback, useEffect, useState } from "react";
import { Plug, Loader2, Plus, Trash2, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

export type McpConnection = {
  id: string;
  name: string;
  url: string;
  state: "ready" | "authenticating" | "failed" | string;
  last_error: string | null;
};

const SUGGESTED = [
  { name: "OpenPay Pro Wallet", url: "https://openpaypromainnet.lovable.app/mcp" },
];

async function callMcpFn(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in first.");
  const { data, error } = await supabase.functions.invoke("mcp-connections", {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw new Error((data as any)?.error || error.message);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function McpConnectionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<McpConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [unauthenticated, setUnauthenticated] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState(SUGGESTED[0].url);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callMcpFn({ action: "list" });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUnauthenticated(false);
    } catch (e: any) {
      if (String(e?.message || "").toLowerCase().includes("sign in")) setUnauthenticated(true);
      else toast({ title: "Could not load connections", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const connect = async () => {
    if (!url.trim()) return;
    setConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/mcp/callback`;
      const data = await callMcpFn({ action: "connect", url: url.trim(), name: name.trim(), redirect_uri: redirectUri });
      if (data?.state === "ready") {
        toast({ title: "Connected", description: `${data.connection?.name ?? "Server"} is ready.` });
        await load();
      } else if (data?.authUrl) {
        sessionStorage.setItem("mcp_return_to", window.location.pathname + window.location.search);
        window.location.href = data.authUrl;
      }
    } catch (e: any) {
      toast({ title: "Connection failed", description: e?.message, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async (id: string) => {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      await callMcpFn({ action: "disconnect", id });
    } catch (e: any) {
      setItems(prev);
      toast({ title: "Could not disconnect", description: e?.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[220] max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-paypal-blue" />
            MCP Actions
          </DialogTitle>
          <DialogDescription>
            Connect external MCP servers so OpenPay AI can use their tools in chat.
          </DialogDescription>
        </DialogHeader>

        {unauthenticated ? (
          <p className="rounded-xl border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
            Sign in to manage MCP connections.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {!loading && items.length === 0 && (
                <p className="text-sm text-muted-foreground">No servers connected yet.</p>
              )}
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{item.url}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px]">
                      {item.state === "ready" ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-emerald-600 dark:text-emerald-400">Ready</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-amber-600 dark:text-amber-400">
                            {item.state === "authenticating" ? "Awaiting sign-in" : item.last_error || "Failed"}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => disconnect(item.id)}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Disconnect ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-border/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add a server</p>
              <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="https://example.com/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
              <div className="flex flex-wrap gap-1">
                {SUGGESTED.map((s) => (
                  <button
                    key={s.url}
                    type="button"
                    onClick={() => {
                      setName(s.name);
                      setUrl(s.url);
                    }}
                    className="rounded-full border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-muted"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <Button onClick={connect} disabled={connecting} className="w-full">
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Connect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
