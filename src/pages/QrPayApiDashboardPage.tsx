import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, KeyRound, Plus, Copy, Check, Trash2, Activity, Zap, AlertTriangle, Code2, BookOpen, Sparkles,
} from "lucide-react";

type ApiKey = {
  id: string; name: string; key_prefix: string; last4: string;
  scopes: string[]; is_active: boolean; last_used_at: string | null; created_at: string;
};

type Stats = {
  total_keys: number; active_keys: number; calls_24h: number; calls_7d: number;
  avg_latency_ms: number; error_rate: number;
  series: Array<{ day: string; calls: number }>;
};

type LogRow = {
  id: string; endpoint: string; method: string; status_code: number;
  qr_pay_token: string | null; latency_ms: number | null; created_at: string;
};

const API_BASE = `https://araojncyittkahvvpdrn.supabase.co/functions/v1/qr-pay-api`;

const CopyBtn = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm" variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true); setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
};

const CodeBlock = ({ code, lang }: { code: string; lang?: string }) => (
  <div className="relative group">
    <pre className="text-xs bg-slate-950 text-slate-100 rounded-lg p-4 overflow-x-auto max-h-[420px]">
      <code>{code}</code>
    </pre>
    <div className="absolute top-2 right-2 flex gap-2 items-center">
      {lang && <Badge variant="secondary" className="text-[10px] uppercase">{lang}</Badge>}
      <CopyBtn text={code} />
    </div>
  </div>
);

const Kpi = ({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </CardContent>
  </Card>
);

export default function QrPayApiDashboardPage() {
  const nav = useNavigate();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: k }, { data: l }, { data: s }] = await Promise.all([
      supabase.from("qr_pay_api_keys").select("*").order("created_at", { ascending: false }),
      supabase.from("qr_pay_api_logs").select("id, endpoint, method, status_code, qr_pay_token, latency_ms, created_at").order("created_at", { ascending: false }).limit(30),
      supabase.rpc("qr_pay_api_stats"),
    ]);
    setKeys((k as ApiKey[]) || []);
    setLogs((l as LogRow[]) || []);
    setStats((s as Stats) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase.rpc("qr_pay_api_create_key", { p_name: newKeyName });
    setCreating(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setNewSecret(row?.api_key || null);
    setNewKeyName("");
    await load();
  };

  const revokeKey = async (id: string) => {
    if (!confirm("Revoke this API key? Apps using it will stop working.")) return;
    const { error } = await supabase.rpc("qr_pay_api_revoke_key", { p_id: id });
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Key revoked" });
    load();
  };

  const sampleKey = useMemo(() => newSecret || (keys[0] ? `${keys[0].key_prefix}_••••••••${keys[0].last4}` : "qpk_live_YOUR_KEY"), [newSecret, keys]);

  const snippets = {
    curl: `curl -X GET "${API_BASE}/qr/QR_TOKEN" \\
  -H "x-api-key: ${sampleKey}"`,
    js: `// Fetch QR Pay info (works in any frontend)
const res = await fetch("${API_BASE}/qr/QR_TOKEN", {
  headers: { "x-api-key": "${sampleKey}" }
});
const data = await res.json();
console.log(data.qr_pay, data.items);`,
    node: `// Node.js / Next.js / Express
import fetch from "node-fetch";

export async function getQrPay(token) {
  const r = await fetch("${API_BASE}/qr/" + token, {
    headers: { "x-api-key": process.env.OPENPAY_QR_API_KEY }
  });
  if (!r.ok) throw new Error("OpenPay error " + r.status);
  return r.json();
}`,
    python: `import requests, os

def get_qr_pay(token):
    r = requests.get(
        f"${API_BASE}/qr/{token}",
        headers={"x-api-key": os.environ["OPENPAY_QR_API_KEY"]},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()`,
    php: `<?php
$ch = curl_init("${API_BASE}/qr/" . $token);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["x-api-key: " . getenv("OPENPAY_QR_API_KEY")]);
$data = json_decode(curl_exec($ch), true);
curl_close($ch);
return $data;`,
    checkout: `// Create a hosted checkout (Stripe/PayPal style)
const res = await fetch("${API_BASE}/checkout-session", {
  method: "POST",
  headers: {
    "x-api-key": "${sampleKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    qr_pay_token: "QR_TOKEN",
    customer_email: "buyer@example.com",
    customer_name: "Jane Doe",
    success_url: "https://yourshop.com/thank-you",
    cancel_url: "https://yourshop.com/cart",
  }),
});
const { checkout_url } = await res.json();
window.location.href = checkout_url; // redirect like Stripe Checkout`,
    react: `import { useEffect, useState } from "react";

export function OpenPayButton({ token }) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    fetch("${API_BASE}/qr/" + token, {
      headers: { "x-api-key": import.meta.env.VITE_OPENPAY_QR_API_KEY }
    }).then(r => r.json()).then(d => setQr(d.qr_pay));
  }, [token]);

  if (!qr) return <button disabled>Loading…</button>;
  return (
    <a href={"https://openpay.lovable.app/qr-pay/" + token}
       className="bg-[#0070BA] text-white px-5 py-3 rounded-lg font-semibold">
      Pay {qr.currency} {qr.amount} with OpenPay
    </a>
  );
}`,
    aiPrompt: `Integrate OpenPay QR Pay into my app.

API base: ${API_BASE}
Auth: header "x-api-key: ${sampleKey}"

Endpoints:
- GET  /qr/{token}                    → returns { qr_pay, items }
- GET  /qr                            → list my QR payments
- POST /checkout-session              → body { qr_pay_token, customer_email, customer_name, success_url, cancel_url } returns { checkout_url }
- GET  /transactions                  → list my paid transactions
- GET  /transactions/{id}             → verify one transaction

Build a React component called <OpenPayCheckout token="..." /> that:
1. Fetches /qr/{token} on mount
2. Renders product title, price (currency + amount) and items
3. On click, calls POST /checkout-session and redirects to checkout_url
4. Stores the api key in VITE_OPENPAY_QR_API_KEY env var (never hardcode)

Style it with Tailwind, primary color #0070BA (PayPal blue). Include error + loading states.`,
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-gradient-to-br from-[#003087] to-[#0070BA] text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button onClick={() => nav("/qr-pay")} className="inline-flex items-center text-white/80 hover:text-white text-sm mb-3">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to QR Pay
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
                <Code2 className="h-7 w-7" /> QR Pay API
              </h1>
              <p className="text-white/80 text-sm mt-1">
                Smart-contract style API to let Stripe, PayPal, Instapay or any app read &amp; pay your QR codes.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="bg-white text-[#003087] hover:bg-white/90">
              <Plus className="h-4 w-4 mr-1" /> New API key
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi icon={KeyRound} label="Active keys" value={stats?.active_keys ?? "—"} hint={`${stats?.total_keys ?? 0} total`} />
          <Kpi icon={Activity} label="Calls 24h" value={stats?.calls_24h ?? "—"} hint={`${stats?.calls_7d ?? 0} this week`} />
          <Kpi icon={Zap} label="Avg latency" value={`${stats?.avg_latency_ms ?? 0} ms`} />
          <Kpi icon={AlertTriangle} label="Error rate" value={`${stats?.error_rate ?? 0}%`} />
        </div>

        {/* Keys */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">API keys</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : keys.length === 0 ? (
              <div className="text-center py-8">
                <KeyRound className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No API keys yet. Create one to start integrating.</p>
                <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create your first key</Button>
              </div>
            ) : (
              <div className="divide-y">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {k.name}
                        {k.is_active ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                                     : <Badge variant="secondary">Revoked</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {k.key_prefix}_••••••••{k.last4}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {k.last_used_at ? `Last used ${new Date(k.last_used_at).toLocaleString()}` : "Never used"}
                      </div>
                    </div>
                    {k.is_active && (
                      <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Integration — copy &amp; paste
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Drop these into Lovable, Cursor, Bolt, Claude, ChatGPT or any codebase. Replace <code>QR_TOKEN</code> with one of your QR Pay tokens.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ai">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" />AI prompt</TabsTrigger>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="js">JavaScript</TabsTrigger>
                <TabsTrigger value="node">Node</TabsTrigger>
                <TabsTrigger value="react">React</TabsTrigger>
                <TabsTrigger value="checkout">Checkout</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
                <TabsTrigger value="php">PHP</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="space-y-2">
                <p className="text-xs text-muted-foreground">Paste this prompt into Lovable / Cursor / Claude and it will scaffold the integration for you:</p>
                <CodeBlock code={snippets.aiPrompt} lang="prompt" />
              </TabsContent>
              <TabsContent value="curl"><CodeBlock code={snippets.curl} lang="bash" /></TabsContent>
              <TabsContent value="js"><CodeBlock code={snippets.js} lang="js" /></TabsContent>
              <TabsContent value="node"><CodeBlock code={snippets.node} lang="ts" /></TabsContent>
              <TabsContent value="react"><CodeBlock code={snippets.react} lang="tsx" /></TabsContent>
              <TabsContent value="checkout"><CodeBlock code={snippets.checkout} lang="js" /></TabsContent>
              <TabsContent value="python"><CodeBlock code={snippets.python} lang="py" /></TabsContent>
              <TabsContent value="php"><CodeBlock code={snippets.php} lang="php" /></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Endpoints reference */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">Endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["GET", "/health", "Service status (public)"],
              ["GET", "/qr", "List your QR payments"],
              ["GET", "/qr/{token}", "Read one QR pay + line items"],
              ["GET", "/qr/{token}/checkout-url", "Hosted checkout URL"],
              ["POST", "/checkout-session", "Create a checkout session (Stripe-style)"],
              ["GET", "/transactions", "List your QR Pay transactions"],
              ["GET", "/transactions/{id}", "Verify a transaction"],
            ].map(([m, p, d]) => (
              <div key={p} className="flex items-center gap-3 py-1 border-b last:border-0">
                <Badge className={m === "GET" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"}>{m}</Badge>
                <code className="text-foreground font-mono text-xs">{p}</code>
                <span className="text-muted-foreground text-xs">{d}</span>
              </div>
            ))}
            <div className="mt-3 text-xs text-muted-foreground">
              Base URL: <code className="text-foreground">{API_BASE}</code>
            </div>
          </CardContent>
        </Card>

        {/* Logs */}
        <Card>
          <CardHeader><CardTitle className="text-foreground">Recent requests</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No API calls yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center justify-between gap-2 py-1 border-b last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="text-[10px]">{l.method}</Badge>
                      <code className="text-foreground truncate">{l.endpoint || "/"}</code>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                      <span className={l.status_code >= 400 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>{l.status_code}</span>
                      <span>{l.latency_ms ?? 0}ms</span>
                      <span>{new Date(l.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4 text-sm text-foreground">
            <p className="font-semibold mb-1">🛡️ Security notes</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Treat keys like passwords — never commit them. Use <code>.env</code> / server-side only.</li>
              <li>Each key is scoped to <strong>your</strong> QR payments only. Revoke anytime.</li>
              <li>All requests are logged for auditing. CORS is enabled.</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Create key dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setNewSecret(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newSecret ? "Save your API key" : "Create new API key"}</DialogTitle>
          </DialogHeader>
          {newSecret ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This is the only time you can copy this key. Store it somewhere safe.
              </p>
              <div className="bg-slate-950 text-emerald-300 p-3 rounded font-mono text-xs break-all">{newSecret}</div>
              <div className="flex justify-end gap-2">
                <CopyBtn text={newSecret} label="Copy key" />
                <Button onClick={() => { setNewSecret(null); setShowCreate(false); }}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Key name</Label>
                <Input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="My Shopify store" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
                  {creating ? "Creating…" : "Create key"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
